import { test, expect } from '../../helpers/app-fixture';
import { registerRecoverable, authHeaders } from '../../helpers/auth-wait';
test.use({ kiteSimulation: true, manualWorkers: true });
test('E2E-WEB-1420 connected broker consent opens verified authorization then actual preview and confirmation @DEV-028 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await registerRecoverable(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#holdings');
  const connection = page.getByRole('region', { name: 'Connect Zerodha' });
  await expect(connection).toContainText('State: disconnected');
  await connection.getByRole('checkbox').check();
  await connection
    .getByRole('button', { name: 'Prepare Zerodha connection' })
    .click();
  const link = connection.getByRole('link', { name: 'Continue on Zerodha' });
  await expect(link).toBeVisible();
  const url = new URL((await link.getAttribute('href'))!),
    state = new URLSearchParams(url.searchParams.get('redirect_params')!).get(
      'state',
    )!;
  expect(url.origin).toBe('https://kite.zerodha.com');
  expect(
    (
      await request.post('/api/v1/account/broker-connections/kite/complete', {
        headers: authHeaders,
        data: { state, request_token: 'synthetic_request_token' },
        maxRedirects: 0,
      })
    ).status(),
  ).toBe(303);
  await connection
    .getByRole('button', { name: 'Refresh broker status' })
    .click();
  await expect(connection).toContainText('State: connected');
  await connection
    .getByRole('button', { name: 'Fetch and review broker holdings' })
    .click();
  await expect(
    page.getByRole('region', { name: 'Changes to your holdings' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Confirm replacement', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'My entered holdings', exact: true }),
  ).toContainText('Saved revision 1');
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('INE002A01018');
  await connection
    .getByRole('button', { name: 'Revoke broker connection' })
    .click();
  await expect(connection).toContainText('State: revoked');
});
test('E2E-WEB-1421 simulated native callback handback completes only through the actual owner-bound API @DEV-028 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await registerRecoverable(request);
  await page.context().addCookies((await request.storageState()).cookies);
  const started = await request.post(
      '/api/v1/account/broker-connections/kite/start',
      { headers: authHeaders, data: { consent: true } },
    ),
    url = new URL((await started.json()).loginUrl),
    state = new URLSearchParams(url.searchParams.get('redirect_params')!).get(
      'state',
    )!;
  await page.goto('/#holdings');
  await expect(
    page.getByRole('region', { name: 'Connect Zerodha' }),
  ).toContainText('State: pending');
  await page.evaluate(
    ({ state }) => {
      let value: { state: string; requestToken: string } | null = {
        state,
        requestToken: 'synthetic_request_token',
      };
      Object.assign(window, {
        FingentAndroid: {
          takeKiteCallback: async () => {
            const returned = value;
            value = null;
            return returned;
          },
        },
      });
      window.dispatchEvent(new Event('f360-kite-ready'));
    },
    { state },
  );
  const connection = page.getByRole('region', { name: 'Connect Zerodha' });
  await connection
    .getByRole('button', { name: 'Complete returned authorization' })
    .click();
  await expect(connection).toContainText('State: connected');
  await expect(
    connection.getByRole('button', { name: 'Complete returned authorization' }),
  ).toHaveCount(0);
});
