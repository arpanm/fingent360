import { test, expect } from '../../helpers/feedback-fixture';
import { randomBytes, randomUUID } from 'node:crypto';
import { FeedbackReceiptSchema } from '../../../../packages/contracts/src/index';
test('E2E-API-1610 iOS native marker admits actual private receipt lifecycle while lookalikes fail @DEV-029 @FEEDBACK-001', async ({
  request,
}) => {
  const origin = 'https://ios.fingent360.invalid',
    body = {
      id: randomUUID(),
      receiptToken: randomBytes(32).toString('hex'),
      text: 'Synthetic iOS native feedback',
      image: null,
      audio: null,
      context: {
        screen: 'today',
        runtime: 'offline',
        appVersion: 'synthetic-ios',
        viewport: { width: 390, height: 844 },
        capturedAt: new Date().toISOString(),
      },
      consent: true,
    };
  const options = await request.fetch('/api/v1/feedback', {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
  });
  expect(options.headers()['access-control-allow-origin']).toBe(origin);
  const denied = await request.post('/api/v1/feedback', {
    headers: { Origin: 'https://ios.fingent360.invalid.evil.example' },
    data: body,
  });
  expect(denied.status()).toBe(403);
  const response = await request.post('/api/v1/feedback', {
    headers: { Origin: origin },
    data: body,
  });
  expect(response.status()).toBe(201);
  expect(FeedbackReceiptSchema.parse(await response.json()).id).toBe(body.id);
  const headers = { Origin: origin, 'X-Feedback-Token': body.receiptToken };
  expect(
    (await request.get('/api/v1/feedback/' + body.id, { headers })).status(),
  ).toBe(200);
  expect(
    (await request.delete('/api/v1/feedback/' + body.id, { headers })).status(),
  ).toBe(200);
});
