import { randomBytes, randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { registerRecoverable } from '../../helpers/auth-wait';
import { consentWrite, consentView } from '../../helpers/consent-fixture';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { PrivateAiHistorySchema } from '../../../../packages/contracts/src/index';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-1254 private history upgrades legacy plaintext, rotates configured keys, fails closed on unknown keys and retains ownership @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  await consentWrite(request, 'private-ai-history', 'grant');
  const consent = (await consentView(request)).purposes.find(
    (entry) => entry.record.purpose === 'private-ai-history',
  );
  expect(consent?.status).toBe('active');
  if (!consent) throw Error('Expected private history consent.');
  const db = await connectionDatabase(feedbackSandbox);
  const id = randomUUID();
  const keys = feedbackSandbox.privateDataKeys;
  const url = new URL(
    '../../../../apps/api/dist/private-ai-history.js',
    import.meta.url,
  ).href;
  const {
    exportPrivateAiHistory,
    startPrivateAiHistory,
    finishPrivateAiHistory,
  } = await import(url);
  const cryptoUrl = new URL(
    '../../../../apps/api/dist/private-data-crypto.js',
    import.meta.url,
  ).href;
  const { openPrivatePayload } = await import(cryptoUrl);
  try {
    // Representative old-format row, isolated fixture schema only.
    await db.query(
      "INSERT INTO private_ai_history(id,user_id,provider,model,instructions,input,raw_output,text_output,status,expires_at,consent_version) VALUES($1,$2,'openai','synthetic','Synthetic instructions','Synthetic private input','Synthetic raw','Synthetic answer','succeeded',now()+interval '1 day',$3)",
      [id, owner.id, consent.record.version],
    );
    const response = await request.get('/api/v1/account/ai-history');
    expect(response.status()).toBe(200);
    expect(
      PrivateAiHistorySchema.parse(await response.json()).entries[0]?.input,
    ).toBe('Synthetic private input');
    let row = (
      await db.query('SELECT * FROM private_ai_history WHERE id=$1', [id])
    ).rows[0];
    expect(row.instructions).toBe('');
    expect(row.input).toBe('');
    expect(row.raw_output).toBeNull();
    expect(row.text_output).toBeNull();
    expect(JSON.stringify(row.encrypted_payload)).not.toContain(
      'Synthetic private input',
    );
    expect(() =>
      openPrivatePayload(randomUUID(), id, row.encrypted_payload, keys),
    ).toThrow();
    expect(() =>
      openPrivatePayload(owner.id, randomUUID(), row.encrypted_payload, keys),
    ).toThrow();
    const rotated = {
      PRIVATE_DATA_ACTIVE_KEY: 'next_key',
      PRIVATE_DATA_KEYS: JSON.stringify({
        ...JSON.parse(keys.PRIVATE_DATA_KEYS),
        next_key: randomBytes(32).toString('base64'),
      }),
    };
    await exportPrivateAiHistory(db, owner.id, rotated);
    row = (await db.query('SELECT * FROM private_ai_history WHERE id=$1', [id]))
      .rows[0];
    expect(row.encrypted_payload.keyId).toBe('next_key');
    // API has only its old configured key: no plaintext fallback or partial export.
    const unavailable = await request.get('/api/v1/account/ai-history');
    expect(unavailable.status()).toBe(503);
    expect(await unavailable.text()).not.toContain('Synthetic private input');
    await exportPrivateAiHistory(db, owner.id, {
      ...rotated,
      PRIVATE_DATA_ACTIVE_KEY: keys.PRIVATE_DATA_ACTIVE_KEY,
    });
    expect((await request.get('/api/v1/account/ai-history')).status()).toBe(
      200,
    );
    const created = await startPrivateAiHistory(
      db,
      owner.id,
      'openai',
      'synthetic',
      'New instructions',
      'New private input',
      keys,
    );
    await finishPrivateAiHistory(
      db,
      owner.id,
      created,
      { raw: 'New raw', text: 'New answer', status: 'succeeded' },
      keys,
    );
    const fresh = (
      await db.query('SELECT * FROM private_ai_history WHERE id=$1', [created])
    ).rows[0];
    expect(fresh.input).toBe('');
    expect(
      openPrivatePayload(owner.id, created, fresh.encrypted_payload, keys).text,
    ).toBe('New answer');
    await expect(
      startPrivateAiHistory(
        db,
        owner.id,
        'openai',
        'synthetic',
        'instructions',
        'private',
        {},
      ),
    ).rejects.toThrow();
  } finally {
    await db.end();
  }
});
