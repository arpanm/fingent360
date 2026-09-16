import { test, expect } from '../../helpers/funds-bonds';
import { publishConflictingFundHistory } from '../../helpers/fund-history';

test('E2E-WEB-1460 conflicting retained NAVs show review and original editions with Back @SRC-015 @TEST-SIMULATION', async ({
  page,
  request,
}) => {
  await publishConflictingFundHistory(request);
  await page.goto('/#funds-bonds');
  await page
    .getByRole('button', { name: /Synthetic Test Fund Direct Growth/ })
    .click();
  const region = page.getByRole('region', { name: 'NAV history consistency' });
  await expect(region).toContainText('History needs review');
  await expect(region).toContainText('2025-01-31');
  await expect(region).toContainText('growth/payout ISIN');
  await expect(
    page
      .getByRole('region', { name: 'Fund NAV history' })
      .getByText('Source and retrieval edition', { exact: true }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: '← All funds', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Synthetic Test Fund Direct Growth/ }),
  ).toBeVisible();
});
