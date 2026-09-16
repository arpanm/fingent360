import {
  test,
  expect,
  indiaActors,
  retainPriceHistory,
} from '../../helpers/equity-price-history';
test.use({ namedOperators: true });
test('E2E-WEB-1800 price range form next previous source details and missing calendar dates on desktop mobile @SRC-002 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    await retainPriceHistory(request, reviewer);
    await page.goto('/?equity=INE002A01018#equities');
    const region = page.getByRole('region', {
      name: 'Price history',
      exact: true,
    });
    await region.getByLabel('Price history from').fill('2025-01-01');
    await region.getByLabel('Price history through').fill('2025-01-19');
    await region.getByRole('button', { name: 'Load price history' }).click();
    await expect(
      region.getByRole('heading', { name: '2025-01-17', exact: true }),
    ).toBeVisible();
    await region.getByRole('button', { name: 'More price dates' }).click();
    await expect(
      region.getByRole('heading', { name: '2025-01-01', exact: true }),
    ).toBeVisible();
    await expect(region).toContainText('Conflicting same-exchange revisions');
    const provenance = region
      .getByText('Price provenance', { exact: true })
      .first();
    await provenance.focus();
    await provenance.press('Enter');
    await expect(region).toContainText('original hash');
    await region.getByRole('button', { name: 'Previous price dates' }).click();
    await expect(
      region.getByRole('heading', { name: '2025-01-17', exact: true }),
    ).toBeVisible();
    await region
      .getByText('Dates without retained price evidence (2)', { exact: true })
      .click();
    await expect(region).toContainText('not a verified trading calendar');
    await region.getByLabel('Price history from').fill('2023-01-01');
    await region.getByRole('button', { name: 'Load price history' }).click();
    await expect(region.getByRole('alert')).toBeVisible();
  } finally {
    await reviewer.dispose();
  }
});
