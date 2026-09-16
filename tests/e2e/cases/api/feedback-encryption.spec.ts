import { randomBytes, randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/feedback-fixture';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { operatorKey } from '../../helpers/operator';
import {
  FeedbackReportSchema,
  FeedbackEncryptionResultSchema,
} from '../../../../packages/contracts/src/index';
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const submission = () => ({
  id: randomUUID(),
  receiptToken: randomBytes(32).toString('hex'),
  text: 'Synthetic encrypted feedback',
  image: null,
  audio: null,
  consent: true,
  context: {
    screen: 'today',
    runtime: 'web',
    appVersion: 'synthetic',
    viewport: { width: 390, height: 844 },
    capturedAt: new Date().toISOString(),
  },
});
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-1256 feedback persists ciphertext and fails closed on unknown key while deletion still erases content @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const data = submission(),
    db = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (await request.post('/api/v1/feedback', { headers, data })).status(),
    ).toBe(201);
    const row = (
      await db.query('SELECT * FROM feedback_reports WHERE id=$1', [data.id])
    ).rows[0];
    expect(row.text).toBeNull();
    expect(row.context).toBeNull();
    expect(row.encrypted_payload.keyId).toBe(
      feedbackSandbox.privateDataKeys.PRIVATE_DATA_ACTIVE_KEY,
    );
    expect(JSON.stringify(row.encrypted_payload)).not.toContain(data.text);
    const read = () =>
      request.get('/api/v1/feedback/' + data.id, {
        headers: { 'X-Feedback-Token': data.receiptToken },
      });
    expect(FeedbackReportSchema.parse(await (await read()).json()).text).toBe(
      data.text,
    );
    await db.query(
      "UPDATE feedback_reports SET encrypted_payload=jsonb_set(encrypted_payload,'{keyId}','\"missing_key\"') WHERE id=$1",
      [data.id],
    );
    const failed = await read();
    expect(failed.status()).toBe(503);
    expect(await failed.text()).not.toContain(data.text);
    expect(
      (
        await request.delete('/api/v1/feedback/' + data.id, {
          headers: { ...headers, 'X-Feedback-Token': data.receiptToken },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await db.query(
          'SELECT encrypted_payload FROM feedback_reports WHERE id=$1',
          [data.id],
        )
      ).rows[0].encrypted_payload,
    ).toBeNull();
  } finally {
    await db.end();
  }
});
test('E2E-API-1257 confirmed bounded support maintenance upgrades legacy fields without disclosing report bodies @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const data = submission(),
    db = await connectionDatabase(feedbackSandbox);
  try {
    expect(
      (await request.post('/api/v1/feedback', { headers, data })).status(),
    ).toBe(201);
    await db.query(
      'UPDATE feedback_reports SET encrypted_payload=NULL,text=$2,context=$3 WHERE id=$1',
      [data.id, data.text, data.context],
    );
    expect(
      (
        await request.post('/api/v1/ops/session', {
          headers,
          data: { key: await operatorKey() },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/feedback/encryption', {
          headers,
          data: { confirm: false },
        })
      ).status(),
    ).toBe(400);
    const response = await request.post('/api/v1/ops/feedback/encryption', {
      headers,
      data: { confirm: true },
    });
    expect(response.status()).toBe(201);
    expect(FeedbackEncryptionResultSchema.parse(await response.json())).toEqual(
      { processed: 1, remaining: 0 },
    );
    const row = (
      await db.query('SELECT * FROM feedback_reports WHERE id=$1', [data.id])
    ).rows[0];
    expect(row.text).toBeNull();
    expect(row.context).toBeNull();
    expect(row.encrypted_payload).not.toBeNull();
    expect(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM feedback_audit WHERE report_id=$1 AND action='maintenance:encryption'",
          [data.id],
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    await db.end();
  }
});
