import { test, expect } from '../../helpers/app-fixture';
import { registerRecoverable, authHeaders } from '../../helpers/auth-wait';
test.use({
  kiteSimulation: true,
  upstoxSimulation: true,
  angelSimulation: true,
  manualWorkers: true,
});
for (const [index, broker, label, field, credential] of [
  [0, 'kite', 'Zerodha', 'requestToken', 'synthetic_request_token'],
  [1, 'upstox', 'Upstox', 'code', 'synthetic_code'],
  [2, 'angel', 'Angel One', 'authToken', 'synthetic_access_token'],
] as const) {
  test(`E2E-WEB-${1640 + index} iOS structured ${broker} return requires explicit completion and real owner admission @DEV-029 @TEST-SIMULATION`, async ({
    page,
    request,
  }) => {
    await registerRecoverable(request);
    await page.context().addCookies((await request.storageState()).cookies);
    const response = await request.post(
      `/api/v1/account/broker-connections/${broker}/start`,
      { headers: authHeaders, data: { consent: true } },
    );
    expect(response.status()).toBe(201);
    const login = new URL((await response.json()).loginUrl),
      state =
        broker === 'kite'
          ? new URLSearchParams(login.searchParams.get('redirect_params')!).get(
              'state',
            )!
          : login.searchParams.get('state')!;
    await page.goto('/#holdings');
    const region = page.getByRole('region', { name: `Connect ${label}` });
    await expect(region).toContainText('State: pending');
    // Structured bridge simulation only; actual URI admission is physical IOS1644–1649.
    await page.evaluate(
      ({ broker, field, credential, state }) => {
        let returned: Record<string, string> | null = {
          state,
          [field]: credential,
        };
        const method =
          broker === 'kite'
            ? 'takeKiteCallback'
            : broker === 'upstox'
              ? 'takeUpstoxCallback'
              : 'takeAngelCallback';
        Object.assign(window, {
          FingentIOS: {
            [method]: async () => {
              const value = returned;
              returned = null;
              return value;
            },
            clearBroker: async () => ({ cleared: true }),
          },
        });
        window.dispatchEvent(new Event('f360-broker-ready'));
      },
      { broker, field, credential, state },
    );
    await expect(
      region.getByRole('button', { name: 'Complete returned authorization' }),
    ).toBeVisible();
    expect(
      (
        await (
          await request.get(`/api/v1/account/broker-connections/${broker}`)
        ).json()
      ).state,
    ).toBe('pending');
    await region
      .getByRole('button', { name: 'Complete returned authorization' })
      .click();
    await expect(region).toContainText('State: connected');
    await expect(
      region.getByRole('button', { name: 'Complete returned authorization' }),
    ).toHaveCount(0);
  });
}
test('E2E-WEB-1643 iOS insecure native return preparation fails visibly without an authorization link @DEV-029 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await registerRecoverable(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#holdings');
  await page.evaluate(() =>
    Object.assign(window, {
      FingentIOS: {
        armBroker: async () => ({ armed: true }),
        clearBroker: async () => ({ cleared: true }),
      },
    }),
  );
  const region = page.getByRole('region', { name: 'Connect Zerodha' });
  await expect(region).toContainText('State: disconnected');
  await region.getByRole('checkbox').check();
  await region
    .getByRole('button', { name: 'Prepare Zerodha connection' })
    .click();
  await expect(region).toContainText(
    'iOS broker return requires an HTTPS deployment serving its API on the same origin',
  );
  await expect(
    region.getByRole('link', { name: 'Continue on Zerodha' }),
  ).toHaveCount(0);
});
