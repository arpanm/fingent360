import { test, expect } from '@playwright/test';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-123 only failed operator authentication consumes the allowance @UX-002', async ({
  request,
}) => {
  test.setTimeout(90000);
  const headers = {
    Origin: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
  };
  const key = await operatorKey();
  for (const data of [{}, { key: 'bad-format' }, { key, extra: true }])
    expect(
      (await request.post('/api/v1/ops/session', { headers, data })).status(),
    ).toBe(400);
  try {
    for (let attempt = 0; attempt < 22; attempt++) {
      const response = await request.post('/api/v1/ops/session', {
        headers,
        data: { key },
      });
      expect(response.status(), `Valid operations sign-in ${attempt + 1}`).toBe(
        200,
      );
      expect(
        (await request.delete('/api/v1/ops/session', { headers })).status(),
      ).toBe(200);
    }
  } finally {
    await request.delete('/api/v1/ops/session', { headers });
  }
});
