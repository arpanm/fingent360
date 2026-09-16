import { test, expect } from '../../helpers/app-fixture';
import { registerRecoverable } from '../../helpers/auth-wait';
test.use({ manualWorkers: true });
for (const [id, mode, expected] of [
  [1660, 'complete', 'Export accepted by the selected destination.'],
  [1661, 'cancel', 'Export cancelled. No destination was confirmed.'],
  [1662, 'fail', 'Synthetic protected storage unavailable.'],
] as const) {
  test(`E2E-WEB-${id} actual private account export respects simulated iOS ${mode} result @DEV-029 @TEST-SIMULATION`, async ({
    page,
    request,
  }) => {
    await registerRecoverable(request);
    await page.context().addCookies((await request.storageState()).cookies);
    await page.addInitScript(
      ({ mode }) => {
        Object.assign(window, {
          FingentIOS: {
            saveFile: async (
              filename: string,
              mime: string,
              base64: string,
            ) => {
              if (
                filename !== 'fingent360-account.json' ||
                mime !== 'application/json'
              )
                throw Error('Unexpected export format');
              const exported = JSON.parse(atob(base64));
              if (!exported.account || !exported.sessions)
                throw Error('Missing actual account export');
              if (mode === 'fail')
                throw Error('Synthetic protected storage unavailable.');
              return { completed: mode === 'complete' };
            },
          },
        });
      },
      { mode },
    );
    await page.goto('/#privacy');
    await page
      .getByRole('button', { name: 'Download account JSON', exact: true })
      .click();
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
    if (mode !== 'complete')
      await expect(
        page.getByText('Export accepted by the selected destination.', {
          exact: true,
        }),
      ).toHaveCount(0);
  });
}
