import {
  test,
  expect,
  fundAccount,
  retentionHeaders as headers,
} from '../../helpers/funds-bonds';
import { indiaActors } from '../../helpers/india-macro';
import {
  corporateRatingInput,
  corporateRatingReview,
} from '../../helpers/corporate-rating';
test.use({ namedOperators: true });
test('E2E-WEB-1980 select actual historical ISIN evidence and save immutable valuation boundaries across reload @FUNDS-BONDS-001', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const source = await corporateRatingInput();
    expect(
      (
        await request.post('/api/v1/ops/corporate-ratings/import', {
          headers,
          data: source,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post(
          '/api/v1/ops/corporate-ratings/' + source.requestId + '/review',
          { headers, data: corporateRatingReview() },
        )
      ).status(),
    ).toBe(201);
    await fundAccount(request);
    await page.context().addCookies((await request.storageState()).cookies);
    await page.route(/\/api\/v1\/corporate-ratings(?:[/?]|$)/, (route) => {
      const u = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + u.pathname + u.search,
      });
    });
    await page.goto('/#funds-bonds');
    await page
      .getByRole('button', { name: 'Bond & deposit comparison', exact: true })
      .click();
    const panel = page.getByRole('region', {
      name: 'Bond and deposit workbench',
    });
    for (const [label, value] of [
      ['Comparison name', 'Historical credit attachment'],
      [
        'Source of bond terms, quote and cashflows',
        'Explicit illustrative inputs; ICRA credit evidence attached separately',
      ],
      ['Purchase settlement date', '2026-05-14'],
      ['Clean purchase amount (₹)', '1000'],
      ['Previous coupon date', '2026-02-12'],
      ['Next coupon date', '2026-08-12'],
      ['Coupon amount for this interval (₹)', '100'],
      ['Purchase fees (₹)', '1'],
      ['Deposit annual simple interest (%)', '5'],
      ['Assumed deduction from deposit interest (%)', '10'],
      ['Receipt date 1', '2035-02-12'],
      ['Receipt amount 1 (₹)', '1200'],
    ])
      await panel.getByLabel(label!, { exact: true }).fill(value!);
    await panel
      .getByLabel('Optional historical credit evidence')
      .selectOption(source.requestId + '|INE031A08939');
    await panel.getByRole('checkbox').check();
    await panel
      .getByRole('button', { name: 'Review comparison', exact: true })
      .click();
    await expect(
      panel.getByRole('region', { name: 'Saved bond evidence policy' }),
    ).toContainText('INE031A08939');
    await panel
      .getByRole('button', { name: 'Save comparison', exact: true })
      .click();
    await expect(panel.getByRole('status')).toContainText('Comparison saved');
    await page.reload();
    await page
      .getByRole('button', { name: 'Bond & deposit comparison', exact: true })
      .click();
    await panel
      .getByRole('button', { name: /Historical credit attachment ·/ })
      .click();
    await expect(
      panel.getByRole('region', { name: 'Saved bond evidence policy' }),
    ).toContainText(source.requestId);
    await expect(
      panel.getByRole('region', { name: 'Saved bond evidence policy' }),
    ).toContainText('evaluated price not supplied');
  } finally {
    await reviewer.dispose();
  }
});
