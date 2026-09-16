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

test('E2E-WEB-904 corporate action dates and source remain readable through company navigation @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  const { publishActions } = await import('../../helpers/equity-coverage');
  await publishActions(request);
  await page.goto('/#equities');
  await page
    .getByRole('button', { name: /Synthetic coverage company/ })
    .click();
  const actions = page.getByRole('region', {
    name: 'Corporate actions',
    exact: true,
  });
  await expect(actions).toContainText('ex-date 2025-02-03');
  await expect(actions).toContainText('record date 2025-02-04');
  await expect(actions).toContainText('no portfolio adjustment applied');
  await actions.getByText('Source & edition', { exact: true }).first().click();
  await expect(
    actions.getByRole('link', { name: 'Original source' }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: /Synthetic coverage company/ }),
  ).toBeVisible();
});

test('E2E-WEB-906 exact Ind AS period scale and negative profit render in company financials @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  const { publishIndas } = await import('../../helpers/equity-coverage');
  await publishIndas(request);
  await page.goto('/#equities');
  await page.getByRole('button', { name: /INE002A01018/ }).click();
  const financials = page.getByRole('region', {
    name: 'Reported financials',
    exact: true,
  });
  await expect(financials).toContainText('revenue: 1234.5600 lakhs');
  await expect(financials).toContainText('profit after tax: -12.3400 lakhs');
  await expect(financials).toContainText('2025-01-01–2025-03-31');
  await expect(financials).toContainText('2024-04-01–2025-03-31');
});
