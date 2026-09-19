import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../../helpers/app-fixture';
import {
  registerRecoverable,
  authPassword,
  authGoal,
} from '../../helpers/auth-wait';
import { consentWrite } from '../../helpers/consent-fixture';
import {
  connectionDatabase,
  connectionHeaders as headers,
} from '../../helpers/research-connection-fixture';
import {
  AssistanceResultSchema,
  PrivateAiHistorySchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import type { FeedbackSandbox } from '../../helpers/feedback-fixture';
import type { APIRequestContext } from '@playwright/test';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const historyPath = '/api/v1/account/ai-history';
async function history(request: APIRequestContext) {
  const response = await request.get(historyPath);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  return PrivateAiHistorySchema.parse(await response.json());
}
async function helpers() {
  const moduleUrl = new URL(
    '../../../../apps/api/dist/private-ai-history.js',
    import.meta.url,
  ).href;
  return await import(moduleUrl);
}
async function capture(
  sandbox: FeedbackSandbox,
  userId: string,
  label: string,
) {
  const pool = await connectionDatabase(sandbox),
    client = await pool.connect();
  try {
    const { startPrivateAiHistory, finishPrivateAiHistory } = await helpers();
    await client.query('BEGIN');
    const id = await startPrivateAiHistory(
      client,
      userId,
      'synthetic',
      'synthetic-lifecycle',
      'Synthetic history instructions',
      label,
      sandbox.privateDataKeys,
    );
    if (!id) throw Error('Explicit history grant required for this fixture.');
    await finishPrivateAiHistory(
      client,
      userId,
      id,
      {
        raw: 'Synthetic retained raw output',
        text: 'Synthetic retained answer',
        status: 'succeeded',
        outcome:
          'TEST-SIMULATION retained lifecycle fixture, not provider execution.',
      },
      sandbox.privateDataKeys,
    );
    await client.query('COMMIT');
    return id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

test('E2E-API-1118 private history enforces seven-day expiry consent cutoff and newest50 encrypted entries with complete export @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(120000);
  const owner = await registerRecoverable(request);
  await consentWrite(request, 'private-ai-history', 'grant');
  const before = Date.now();
  const oldest = await capture(
    feedbackSandbox,
    owner.id,
    'Synthetic oldest entry',
  );
  const after = Date.now();
  const initial = await history(request);
  expect(initial.retentionDays).toBe(7);
  expect(initial.entries).toHaveLength(1);
  const first = initial.entries[0];
  if (!first) throw Error('Missing actual retained entry');
  expect(Date.parse(first.expiresAt)).toBeGreaterThanOrEqual(
    before + 7 * 86400000,
  );
  expect(Date.parse(first.expiresAt)).toBeLessThanOrEqual(after + 7 * 86400000);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    // Explicit owned clock fixture makes oldest identity deterministic even at timestamp ties.
    await pool.query(
      "UPDATE private_ai_history SET created_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
      [oldest],
    );
    const retained: string[] = [];
    for (let index = 0; index < 50; index++)
      retained.push(
        await capture(
          feedbackSandbox,
          owner.id,
          'Synthetic bounded entry ' + index,
        ),
      );
    const bounded = await history(request);
    expect(bounded.entries).toHaveLength(50);
    expect(bounded.entries.map((v) => v.id).sort()).toEqual(
      [...retained].sort(),
    );
    expect(
      (
        await pool.query('SELECT 1 FROM private_ai_history WHERE id=$1', [
          oldest,
        ])
      ).rows,
    ).toHaveLength(0);
    const encrypted = await pool.query(
      `SELECT count(*)::int AS n FROM private_ai_history WHERE user_id=$1
      AND encrypted_payload IS NOT NULL AND instructions='' AND input='' AND raw_output IS NULL AND text_output IS NULL`,
      [owner.id],
    );
    expect(encrypted.rows[0].n).toBe(50);
    const exportedResponse = await request.get(
      '/api/v1/account/privacy/export',
    );
    expect(exportedResponse.status()).toBe(200);
    const exported = PrivacyExportSchema.parse(await exportedResponse.json());
    expect(exported.privateAiHistory.entries).toEqual(bounded.entries);
    const expired = retained[0];
    await pool.query(
      "UPDATE private_ai_history SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [expired],
    );
    const visible = await history(request);
    expect(visible.entries).toHaveLength(49);
    expect(visible.entries.some((v) => v.id === expired)).toBe(false);
    expect(
      (
        await pool.query('SELECT 1 FROM private_ai_history WHERE id=$1', [
          expired,
        ])
      ).rows,
    ).toHaveLength(0);
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    await consentWrite(request, 'private-ai-history', 'renew', { expiresAt });
    const capped = await capture(
      feedbackSandbox,
      owner.id,
      'Synthetic consent-limited entry',
    );
    expect(
      (await history(request)).entries.find((v) => v.id === capped)?.expiresAt,
    ).toBe(expiresAt);
  } finally {
    await pool.end();
  }
});

test('E2E-API-1119 private history deletion requires owner and Origin preserves consent rejects late resurrection and cascades account removal @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  await consentWrite(request, 'private-ai-history', 'grant');
  const id = await capture(
    feedbackSandbox,
    owner.id,
    'Synthetic owner-only transcript',
  );
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  const guest = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    expect((await guest.get(historyPath)).status()).toBe(401);
    expect((await guest.delete(historyPath, { headers })).status()).toBe(401);
    await registerRecoverable(other);
    expect((await history(other)).entries).toEqual([]);
    expect((await other.delete(historyPath, { headers })).status()).toBe(200);
    expect((await history(request)).entries.map((v) => v.id)).toEqual([id]);
    expect(
      (
        await request.delete(historyPath, {
          headers: { Origin: 'https://invalid.example' },
        })
      ).status(),
    ).toBe(403);
    expect((await history(request)).entries).toHaveLength(1);
    const removed = await request.delete(historyPath, { headers });
    expect(removed.status()).toBe(200);
    expect(PrivateAiHistorySchema.parse(await removed.json())).toMatchObject({
      enabled: true,
      entries: [],
    });
    const { finishPrivateAiHistory } = await helpers();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await finishPrivateAiHistory(
        client,
        owner.id,
        id,
        { text: 'Late synthetic result must not resurrect deleted history' },
        feedbackSandbox.privateDataKeys,
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    expect((await history(request)).entries).toEqual([]);
    await capture(
      feedbackSandbox,
      owner.id,
      'Synthetic entry before account deletion',
    );
    const deletion = await request.delete('/api/v1/account', {
      headers,
      data: { password: authPassword },
    });
    expect(deletion.status()).toBe(200);
    expect(
      (
        await pool.query('SELECT 1 FROM private_ai_history WHERE user_id=$1', [
          owner.id,
        ])
      ).rows,
    ).toHaveLength(0);
    expect((await request.get(historyPath)).status()).toBe(401);
  } finally {
    await pool.end();
    await other.dispose();
    await guest.dispose();
  }
});

async function simulatedFallback(
  sandbox: FeedbackSandbox,
  request: APIRequestContext,
  userId: string,
) {
  const cookie = (await request.storageState()).cookies.find(
    (v) => v.name === 'f360_session',
  );
  if (!cookie) throw Error('Owned session required');
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL(
          '../../helpers/private-history-dispatch-process.mjs',
          import.meta.url,
        ),
      ),
    ],
    { stdio: ['pipe', 'pipe', 'ignore'] },
  );
  let output = '';
  child.stdout.on('data', (value: Buffer) => {
    output += value.toString('utf8');
  });
  const completed = new Promise<void>((resolve, reject) => {
    child.once('error', () =>
      reject(Error('Private-history subprocess failed')),
    );
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(Error('Owned history simulation exited unsuccessfully')),
    );
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
  try {
    child.stdin.end(
      JSON.stringify({
        databaseUrl: sandbox.databaseUrl,
        schema: sandbox.schema,
        origin: headers.Origin,
        privateDataKeys: sandbox.privateDataKeys,
        userId,
        cookie: 'f360_session=' + cookie.value,
      }) + '\n',
    );
    await completed;
    const value: unknown = JSON.parse(output.trim());
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'calls,network,result'
    )
      throw Error('History simulation returned an invalid result envelope');
    const envelope = value as Record<string, unknown>;
    if (
      typeof envelope.calls !== 'number' ||
      !Number.isSafeInteger(envelope.calls) ||
      envelope.calls < 0 ||
      typeof envelope.network !== 'number' ||
      !Number.isSafeInteger(envelope.network) ||
      envelope.network < 0
    )
      throw Error('History simulation returned invalid transport counts');
    return {
      calls: envelope.calls,
      network: envelope.network,
      result: AssistanceResultSchema.parse(envelope.result),
    };
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
  }
}

test('E2E-API-1120 actual query assistance leaves transcripts absent while opted-in simulated provider fallback retains encrypted raw and final outcome @EVAL-LINEAGE-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request);
  expect(
    (
      await request.post('/api/v1/account/goals', { headers, data: authGoal })
    ).status(),
  ).toBe(201);
  const query = {
    query: authGoal.name,
    scope: 'goals',
    provider: 'query',
    useHistory: true,
  };
  const before = await request.post('/api/v1/account/assistance', {
    headers,
    data: query,
  });
  expect(before.status()).toBe(200);
  const queryResult = AssistanceResultSchema.parse(await before.json());
  expect(queryResult.provider).toBe('query');
  expect(queryResult.usedHistory).toBe(true);
  expect(queryResult.suggestions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: authGoal.name,
        type: 'goal_name',
        source: expect.objectContaining({ private: true, href: '#my-goals' }),
      }),
    ]),
  );
  expect(await history(request)).toMatchObject({ enabled: false, entries: [] });
  await consentWrite(request, 'private-ai-history', 'grant');
  const optedInQuery = await request.post('/api/v1/account/assistance', {
    headers,
    data: query,
  });
  expect(optedInQuery.status()).toBe(200);
  expect(await history(request)).toMatchObject({ enabled: true, entries: [] });
  await consentWrite(request, 'external-ai-private-context', 'grant');
  const fallback = await simulatedFallback(feedbackSandbox, request, owner.id);
  expect(fallback.calls).toBe(1);
  expect(fallback.network).toBe(0);
  expect(fallback.result).toMatchObject({ provider: 'query', fallback: true });
  // An empty provider selection must preserve the actual admitted query results,
  // including the exact owned goal name; it cannot replace fallback with [].
  expect(fallback.result.suggestions).toEqual(queryResult.suggestions);
  expect(
    fallback.result.suggestions.some((v) => v.text === authGoal.name),
  ).toBe(true);
  const saved = await history(request);
  expect(saved.entries).toHaveLength(1);
  expect(saved.entries[0]).toMatchObject({
    provider: 'openai',
    model: 'synthetic-history-fallback',
    status: 'failed',
    textOutput: '{"suggestions":[]}',
    outcome:
      'Provider output rejected or unavailable; query fallback returned.',
  });
  expect(saved.entries[0]?.rawOutput).toContain('output_text');
  expect(saved.entries[0]?.input).toContain(authGoal.name);
  expect(JSON.stringify(saved)).not.toContain('synthetic-never-sent');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    const rows = await pool.query(
      'SELECT instructions,input,raw_output,text_output,encrypted_payload IS NOT NULL AS encrypted FROM private_ai_history WHERE user_id=$1',
      [owner.id],
    );
    expect(rows.rows).toEqual([
      {
        instructions: '',
        input: '',
        raw_output: null,
        text_output: null,
        encrypted: true,
      },
    ]);
  } finally {
    await pool.end();
  }
});
