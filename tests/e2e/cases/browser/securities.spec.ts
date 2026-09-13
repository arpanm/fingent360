import { test, expect } from '../../helpers/app-fixture';
import { operatorKey } from '../../helpers/operator';

const isin = 'INE002A01018';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('E2E-WEB-230 operator refresh connects real identity search history evidence reload and keyboard Back @IDENTITY-001 @real-provider', async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()));
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Security identities', exact: true })
    .click();
  const operations = page.getByRole('region', { name: 'Identity operations' });
  await operations.getByLabel('Public ISINs', { exact: true }).fill(isin);
  await operations
    .getByRole('button', { name: 'Refresh identities', exact: true })
    .click();
  await expect(
    operations.getByRole('heading', { name: 'Refresh complete', exact: true }),
  ).toBeVisible({ timeout: 120000 });
  await expect(operations).toContainText(`${isin}: matched`);
  await operations
    .getByRole('link', { name: 'Open security directory', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Security directory', exact: true }),
  ).toBeVisible();
  const search = page.getByLabel('Search name, ticker or ISIN', {
    exact: true,
  });
  await search.fill('reliance');
  await search.press('Enter');
  const match = page.locator(`a[href="#securities/${isin}"]`);
  await expect(match).toContainText(/RELIANCE/i);
  await match.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#securities/${isin}$`));
  const detail = page.getByRole('article', {
    name: 'Security identity detail',
  });
  await expect(detail).toContainText(
    'One India common-stock mapping was returned.',
  );
  await expect(detail).toContainText('Source edition retrieved');
  await expect(detail).toContainText('Last successful check');
  await expect(
    page.getByText(
      'Identity metadata does not include a current price, prove ownership or confirm current exchange listing. Your recorded cost stays separate.',
      { exact: true },
    ),
  ).toBeVisible();
  const history = detail.getByRole('button', {
    name: 'Identity history',
    exact: true,
  });
  await history.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('region', { name: 'Identity history' }),
  ).toContainText('Edition 1');
  const evidenceButton = detail.getByRole('button', {
    name: 'Original identity evidence',
    exact: true,
  });
  await evidenceButton.focus();
  await page.keyboard.press('Enter');
  const evidence = page.getByRole('region', {
    name: 'Original identity evidence',
  });
  await expect(evidence).toContainText('SHA-256');
  await expect(evidence.locator('pre')).toContainText('RELIANCE');
  await evidence.locator('pre').focus();
  await expect(evidence.locator('pre')).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.reload();
  await expect(detail).toContainText('EDITION 1');
  await expect(
    page.getByRole('region', { name: 'Original identity evidence' }),
  ).toHaveCount(0);
  const back = page.getByRole('button', { name: '← Back', exact: true });
  await back.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Security directory', exact: true }),
  ).toBeVisible();
  await page.locator(`a[href="#securities/${isin}"]`).click();
  await page.getByRole('link', { name: 'My holdings', exact: true }).click();
  await expect(page).toHaveURL(/#holdings/);
  await expect(
    page.getByRole('heading', { name: 'My holdings', exact: true }),
  ).toBeVisible();
});

test('E2E-WEB-231 simulated read interruption recovers to the real empty directory and missing identity state @IDENTITY-001 @simulated', async ({
  page,
  context,
}) => {
  let interrupted = true;
  await context.route(/\/api\/v1\/securities(?:\?|$)/, async (route) => {
    if (interrupted) return route.abort('connectionfailed');
    await route.fallback();
  });
  await page.goto('/#more');
  await page.getByRole('link', { name: /Security directory/ }).click();
  const alert = page.getByRole('alert');
  await expect(
    alert.getByRole('button', { name: 'Retry identity lookup', exact: true }),
  ).toBeVisible();
  interrupted = false;
  await alert
    .getByRole('button', { name: 'Retry identity lookup', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'No stored match yet.', exact: true }),
  ).toBeVisible();
  const search = page.getByLabel('Search name, ticker or ISIN', {
    exact: true,
  });
  await search.fill(isin);
  await search.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'No stored match yet.', exact: true }),
  ).toBeVisible();
  await page.goto(`/#securities/${isin}`);
  await expect(page.getByRole('alert')).toContainText(
    'No stored identity for this ISIN. Your holdings remain unchanged.',
  );
  await expect(
    page.getByRole('article', { name: 'Security identity detail' }),
  ).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Back to holdings', exact: true })
    .click();
  await expect(page).toHaveURL(/#holdings/);
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', { name: 'Operations sign-in', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Identity operations' }),
  ).toHaveCount(0);
});
