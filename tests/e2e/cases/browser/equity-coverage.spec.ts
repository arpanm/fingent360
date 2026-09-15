import {
  test,
  expect,
  publishEquity,
  publishUdiff,
} from '../../helpers/equity-coverage';
test('E2E-WEB-900 actual reviewed company navigation displays five families, evidence and back @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await publishEquity(request);
  await page.goto('/#equities');
  await page
    .getByRole('button', { name: /Synthetic coverage company/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Synthetic coverage company' }),
  ).toBeVisible();
  for (const name of [
    'Exchange identity',
    'Price & trading',
    'Corporate actions',
    'Reported financials',
    'Sector & index history',
  ])
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  await expect(page.getByText(/Close ₹123.4500/)).toBeVisible();
  await page.getByText('Source & edition', { exact: true }).first().click();
  await expect(
    page.getByRole('link', { name: 'Original source' }).first(),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: /Synthetic coverage company/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test('E2E-WEB-901 empty company search stays honest and recovers @EQUITY-COVERAGE-001', async ({
  page,
}) => {
  await page.goto('/#equities');
  await expect(page.getByText(/No reviewed evidence matches/)).toBeVisible();
  await page.getByLabel('Company, symbol or ISIN').fill('does not exist');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText(/No reviewed evidence matches/)).toBeVisible();
});

test('E2E-WEB-902 reviewed UDiFF price details retain OHLC and disclose missing master identity @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await publishUdiff(request);
  await page.goto('/#equities');
  await page.getByRole('button', { name: /Synthetic UDiFF company/ }).click();
  await expect(page.getByText(/open ₹123.100000/)).toBeVisible();
  await expect(
    page.getByText('No reviewed exchange identity available yet.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: /Synthetic UDiFF company/ }),
  ).toBeVisible();
});
