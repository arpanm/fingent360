import { test, expect } from '../../helpers/app-fixture';
import { registerRecoverable, authHeaders } from '../../helpers/auth-wait';
test.use({ angelSimulation: true, manualWorkers: true });
test('E2E-WEB-1490 connected broker consent opens verified authorization then actual preview and confirmation @DEV-028 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await registerRecoverable(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#holdings');
  const connection = page.getByRole('region', { name: 'Connect Angel One' });
  await expect(connection).toContainText('State: disconnected');
  await connection.getByRole('checkbox').check();
  await connection
    .getByRole('button', { name: 'Prepare Angel One connection' })
    .click();
  const link = connection.getByRole('link', { name: 'Continue on Angel One' });
  await expect(link).toBeVisible();
  const url = new URL((await link.getAttribute('href'))!),
    state = url.searchParams.get('state')!;
  expect(url.origin).toBe('https://smartapi.angelone.in');
  expect(
    (
      await request.post('/api/v1/account/broker-connections/angel/complete', {
        headers: authHeaders,
        data: { state, auth_token: 'synthetic_access_token' },
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
  await expect(page.getByText(/Holdings saved as revision 1/)).toBeVisible();
  await connection
    .getByRole('button', { name: 'Revoke broker connection' })
    .click();
  await expect(connection).toContainText('State: revoked');
});
test('E2E-WEB-1491 simulated native callback handback completes only through the actual owner-bound API @DEV-028 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await registerRecoverable(request);
  await page.context().addCookies((await request.storageState()).cookies);
  const started = await request.post(
      '/api/v1/account/broker-connections/angel/start',
      { headers: authHeaders, data: { consent: true } },
    ),
    url = new URL((await started.json()).loginUrl),
    state = url.searchParams.get('state')!;
  await page.goto('/#holdings');
  await expect(
    page.getByRole('region', { name: 'Connect Angel One' }),
  ).toContainText('State: pending');
  await page.evaluate(
    ({ state }) => {
      let value: { state: string; authToken: string } | null = {
        state,
        authToken: 'synthetic_access_token',
      };
      Object.assign(window, {
        FingentAndroid: {
          takeAngelCallback: async () => {
            const returned = value;
            value = null;
            return returned;
          },
        },
      });
      window.dispatchEvent(new Event('f360-angel-ready'));
    },
    { state },
  );
  const connection = page.getByRole('region', { name: 'Connect Angel One' });
  await connection
    .getByRole('button', { name: 'Complete returned authorization' })
    .click();
  await expect(connection).toContainText('State: connected');
  await expect(
    connection.getByRole('button', { name: 'Complete returned authorization' }),
  ).toHaveCount(0);
});
