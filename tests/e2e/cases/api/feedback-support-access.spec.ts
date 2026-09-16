import { randomBytes, randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/feedback-fixture';
import { FeedbackReportSchema } from '../../../../packages/contracts/src/index';

test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
const submission = () => ({
  id: randomUUID(),
  receiptToken: randomBytes(32).toString('hex'),
  text: 'Synthetic support access privacy check',
  image: null,
  audio: null,
  consent: true,
  context: {
    screen: 'today',
    runtime: 'web',
    appVersion: 'synthetic-e2e',
    viewport: { width: 390, height: 844 },
    capturedAt: new Date().toISOString(),
  },
});

test('E2E-API-1251 support reads are admin-only and expose dated identity-free history to the receipt holder @DEV-017', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const data = submission();
  expect(
    (await request.post('/api/v1/feedback', { headers, data })).status(),
  ).toBe(201);
  const read = () =>
    request.get(`/api/v1/feedback/${data.id}`, {
      headers: { 'X-Feedback-Token': data.receiptToken },
    });
  expect(
    FeedbackReportSchema.parse(await (await read()).json()).supportAccess
      ?.total,
  ).toBe(0);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  const password = 'Synthetic-support-viewer-2026';
  const username = `viewer_${randomUUID().slice(0, 8)}`;
  expect(
    (
      await request.post('/api/v1/ops/operators', {
        headers,
        data: { username, password, role: 'viewer' },
      })
    ).status(),
  ).toBe(201);
  const viewer = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    expect(
      (
        await viewer.post('/api/v1/ops/session', {
          headers,
          data: { username, password },
        })
      ).status(),
    ).toBe(200);
    expect((await viewer.get('/api/v1/ops/feedback')).status()).toBe(403);
    expect((await viewer.get(`/api/v1/ops/feedback/${data.id}`)).status()).toBe(
      403,
    );
    expect(
      FeedbackReportSchema.parse(await (await read()).json()).supportAccess
        ?.total,
    ).toBe(0);
    expect((await request.get('/api/v1/ops/feedback')).status()).toBe(200);
    const detail = await request.get(`/api/v1/ops/feedback/${data.id}`);
    expect(detail.status()).toBe(200);
    expect(detail.headers()['cache-control']).toContain('no-store');
    const owner = await read();
    const report = FeedbackReportSchema.parse(await owner.json());
    expect(report.supportAccess?.total).toBe(2);
    expect(report.supportAccess?.events.map((event) => event.action)).toEqual([
      'support:detail',
      'support:list',
    ]);
    expect(JSON.stringify(report.supportAccess)).not.toContain(username);
    expect(
      (
        await viewer.get(`/api/v1/feedback/${data.id}`, {
          headers: { 'X-Feedback-Token': randomBytes(32).toString('hex') },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.delete('/api/v1/feedback/' + data.id, {
          headers: { ...headers, 'X-Feedback-Token': data.receiptToken },
        })
      ).ok(),
    ).toBe(true);
    expect((await read()).status()).toBe(410);
  } finally {
    await viewer.dispose();
  }
});

test('E2E-API-1252 signed-out support sessions cannot open feedback or create successful access events @DEV-017', async ({
  request,
  feedbackSandbox,
}) => {
  const data = submission();
  expect(
    (await request.post('/api/v1/feedback', { headers, data })).status(),
  ).toBe(201);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers,
        data: feedbackSandbox.namedCredentials,
      })
    ).status(),
  ).toBe(200);
  expect((await request.delete('/api/v1/ops/session', { headers })).ok()).toBe(
    true,
  );
  expect((await request.get(`/api/v1/ops/feedback/${data.id}`)).status()).toBe(
    401,
  );
  const result = await request.get(`/api/v1/feedback/${data.id}`, {
    headers: { 'X-Feedback-Token': data.receiptToken },
  });
  expect(
    FeedbackReportSchema.parse(await result.json()).supportAccess?.total,
  ).toBe(0);
});

test('E2E-API-1253 unavailable support audit fails closed without returning private report content @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const db = await connectionDatabase(feedbackSandbox);
  const data = submission();
  try {
    expect(
      (await request.post('/api/v1/feedback', { headers, data })).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/session', {
          headers,
          data: feedbackSandbox.namedCredentials,
        })
      ).status(),
    ).toBe(200);
    // Only the fixture-owned schema is modified; real audit inserts fail, no response mocks.
    await db.query(
      "ALTER TABLE feedback_audit ADD CONSTRAINT simulated_support_audit_failure CHECK(action NOT IN ('support:list','support:detail')) NOT VALID",
    );
    const failed = await request.get(`/api/v1/ops/feedback/${data.id}`);
    expect(failed.status()).toBe(503);
    expect(await failed.text()).not.toContain(data.text);
    expect((await request.get('/api/v1/ops/feedback')).status()).toBe(503);
    const owner = await request.get(`/api/v1/feedback/${data.id}`, {
      headers: { 'X-Feedback-Token': data.receiptToken },
    });
    expect(
      FeedbackReportSchema.parse(await owner.json()).supportAccess?.total,
    ).toBe(0);
  } finally {
    try {
      await db.query(
        'ALTER TABLE feedback_audit DROP CONSTRAINT IF EXISTS simulated_support_audit_failure',
      );
    } finally {
      await db.end();
    }
  }
});
