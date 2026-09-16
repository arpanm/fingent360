import {
  test,
  expect,
  flowInput,
  flowActors,
  flowReview,
  retentionHeaders,
} from '../../helpers/institutional-flows';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1432 reviewed institutional reports keep cash scopes reporting dates and derivatives separate with keyboard Back @SRC-010 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await flowActors(request, playwright, feedbackSandbox);
  try {
    for (const source of ['nse-cash-html', 'cdsl-daily-html'] as const) {
      const input = await flowInput(source);
      expect(
        (
          await request.post('/api/v1/ops/institutional-flows/capture', {
            headers: retentionHeaders,
            data: input,
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await reviewer.post('/api/v1/ops/institutional-flows/review', {
            headers: retentionHeaders,
            data: flowReview(input.requestId),
          })
        ).status(),
      ).toBe(201);
    }
    await page.goto('/#institutional-flows');
    const view = page.getByRole('main', { name: 'Institutional flows' });
    await expect(view).toContainText('Do not add these overlapping reports');
    await expect(
      view.getByRole('link', { name: 'Read this reviewed report' }),
    ).toHaveCount(2);
    await expect(
      view.getByRole('region', { name: 'custodian-reported-investment' }),
    ).toContainText('2024-08-30');
    const derivatives = view.getByRole('region', {
      name: 'exchange-reported-derivatives',
    });
    await expect(derivatives).toContainText('2026-09-10');
    const summary = derivatives.getByText(
      'INDEX_FUTURES activity and open interest',
      { exact: true },
    );
    await summary.focus();
    await summary.press('Enter');
    await expect(summary.locator('..')).toContainText(
      'Open interest is a stock, not daily cash flow',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await view.getByRole('link', { name: 'Back to Explore' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#explore$/);
  } finally {
    await reviewer.dispose();
  }
});
