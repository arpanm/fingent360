import { test, expect } from '../../helpers/app-fixture';
import { operatorKey } from '../../helpers/operator';
test('E2E-WEB-630 current quality empty error retry and publishing navigation @QUALITY-OVERVIEW-001', async ({
  page,
}, testInfo) => {
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()));
  const signIn = page.getByRole('button', {
    name: 'Sign in to operations',
    exact: true,
  });
  await signIn.focus();
  await expect(signIn).toBeFocused();
  await page.keyboard.press('Enter');
  const qualityTab = page.getByRole('button', {
    name: 'Data quality',
    exact: true,
  });
  await qualityTab.focus();
  await expect(qualityTab).toBeFocused();
  await page.keyboard.press('Enter');
  const region = page.getByRole('region', {
    name: 'Data quality',
    exact: true,
  });
  await expect(region).toContainText('No stored publications yet.');
  await page.route(
    '**/api/v1/ops/quality',
    async (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic storage fault' }),
      }),
    { times: 1 },
  );
  const refresh = region.getByRole('button', {
    name: 'Refresh quality overview',
    exact: true,
  });
  await refresh.focus();
  await expect(refresh).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(region.getByRole('alert')).toContainText(
    'Quality overview unavailable',
  );
  await expect(region).not.toContainText('No stored publications yet.');
  const retry = region.getByRole('button', {
    name: 'Retry quality overview',
    exact: true,
  });
  await retry.focus();
  await expect(retry).toBeFocused();
  await expect
    .poll(() =>
      region.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left >= 0 &&
          box.right <= innerWidth + 1 &&
          element.scrollWidth <= element.clientWidth + 1 &&
          document.documentElement.scrollWidth <= innerWidth + 1
        );
      }),
    )
    .toBe(true);
  // Region-only capture excludes the operator credential form and app account UI.
  await testInfo.attach('quality-overview-keyboard-error', {
    body: await region.screenshot(),
    contentType: 'image/png',
  });
  await page.keyboard.press('Enter');
  await expect(region).toContainText('No stored publications yet.');
  await expect(refresh).toBeEnabled();
  await refresh.focus();
  await expect(refresh).toBeFocused();
  await page.keyboard.press('Tab');
  const publishing = region.getByRole('button', {
    name: 'Open publishing review',
    exact: true,
  });
  await expect(publishing).toBeFocused();
  await expect
    .poll(() =>
      region.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left >= 0 &&
          box.right <= innerWidth + 1 &&
          element.scrollWidth <= element.clientWidth + 1 &&
          document.documentElement.scrollWidth <= innerWidth + 1
        );
      }),
    )
    .toBe(true);
  await testInfo.attach('quality-overview-keyboard-recovered', {
    body: await region.screenshot(),
    contentType: 'image/png',
  });
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Publishing', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
