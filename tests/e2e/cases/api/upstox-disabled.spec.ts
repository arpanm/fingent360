import { test, expect } from '../../helpers/feedback-fixture';
import { registerRecoverable, authHeaders } from '../../helpers/auth-wait';
test('E2E-API-1453 unconfigured broker activation is explicit and cannot start a provider flow @DEV-028', async ({
  request,
}) => {
  await registerRecoverable(request);
  const read = await request.get('/api/v1/account/broker-connections/upstox');
  expect(read.status()).toBe(200);
  expect((await read.json()).state).toBe('unconfigured');
  expect(
    (
      await request.post('/api/v1/account/broker-connections/upstox/start', {
        headers: authHeaders,
        data: { consent: true },
      })
    ).status(),
  ).toBe(503);
});
