import {
  test,
  expect,
  publishNav,
  fundAccount,
} from '../../helpers/funds-bonds';
test('E2E-WEB-1080 actual sourced NAV list detail missing look-through and back @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await publishNav(request);
  await page.goto('/#funds-bonds');
  await page
    .getByRole('button', { name: /Synthetic Test Fund Direct Growth/ })
    .click();
  await expect(
    page.getByRole('region', { name: 'Fund NAV history' }),
  ).toContainText('₹123.456700');
  await expect(
    page.getByRole('region', {
      name: 'Fund portfolio disclosure',
      exact: true,
    }),
  ).toContainText(
    'No currently admitted portfolio mapping is available for this scheme.',
  );
  await page.getByText('Source and retrieval edition', { exact: true }).click();
  await expect(page.getByText(/Source row/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: /Synthetic Test Fund Regular Growth/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('E2E-WEB-1081 review save reload and remove exact private bond comparison @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await fundAccount(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/#funds-bonds');
  await page
    .getByRole('button', { name: 'Bond & deposit comparison', exact: true })
    .click();
  const panel = page.getByRole('region', {
    name: 'Bond and deposit workbench',
  });
  for (const [name, value] of [
    ['Comparison name', 'Synthetic mobile bond'],
    [
      'Source of bond terms, quote and cashflows',
      'Synthetic explicit instrument document',
    ],
    ['Purchase settlement date', '2025-04-01'],
    ['Clean purchase amount (₹)', '1000'],
    ['Previous coupon date', '2025-01-01'],
    ['Next coupon date', '2025-07-01'],
    ['Coupon amount for this interval (₹)', '100'],
    ['Purchase fees (₹)', '1'],
    ['Deposit annual simple interest (%)', '5'],
    ['Assumed deduction from deposit interest (%)', '10'],
    ['Receipt date 1', '2026-01-01'],
    ['Receipt amount 1 (₹)', '1200'],
  ])
    await panel.getByLabel(name!, { exact: true }).fill(value!);
  await panel.getByRole('checkbox').check();
  await panel
    .getByRole('button', { name: 'Review comparison', exact: true })
    .click();
  await expect(
    panel.getByRole('region', { name: 'Bond comparison review' }),
  ).toContainText('₹1050.72');
  await panel
    .getByRole('button', { name: 'Save comparison', exact: true })
    .click();
  await expect(panel.getByRole('status')).toContainText('Comparison saved');
  await page.reload();
  await page
    .getByRole('button', { name: 'Bond & deposit comparison', exact: true })
    .click();
  await panel.getByRole('button', { name: /Synthetic mobile bond ·/ }).click();
  await expect(
    panel.getByRole('region', { name: 'Bond comparison review' }),
  ).toContainText('₹1050.72');
  await panel
    .getByRole('button', { name: 'Remove Synthetic mobile bond', exact: true })
    .click();
  await expect(panel.getByText('No saved comparisons yet.')).toBeVisible();
});

test('E2E-WEB-1084 current NAV plan and option distinguish similar scheme names in list and detail @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  const { publishNavV2 } = await import('../../helpers/funds-bonds');
  await publishNavV2(request);
  await page.goto('/#funds-bonds');
  await page
    .getByRole('button', { name: /Synthetic new format fund.*Direct Plan/ })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Synthetic new format fund',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Direct Plan.*Growth Option/)).toBeVisible();
  await expect(page.getByText(/123.4500/)).toBeVisible();
});
