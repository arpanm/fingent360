import {
  test,
  expect,
  positioningInput,
  positioningReview,
  indiaActors,
  retentionHeaders,
} from '../../helpers/participant-positioning';
test.use({ namedOperators: true });
test('E2E-WEB-1391 reviewed actual stored positioning opens keyboard breakdown and distinguishes contracts from cash flows @SRC-011 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = positioningInput();
    expect(
      (
        await request.post('/api/v1/ops/positioning/capture', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/positioning/review', {
          headers: retentionHeaders,
          data: positioningReview(input.requestId),
        })
      ).status(),
    ).toBe(201);
    await page.goto('/#positioning');
    const view = page.getByRole('main', { name: 'Participant positioning' });
    await expect(view).toContainText('2025-06-06');
    await expect(view).toContainText('not cash flows');
    const summary = view.getByText('FII contract breakdown', { exact: true });
    await summary.focus();
    await summary.press('Enter');
    await expect(
      summary.locator('..').getByText('Future Index Long', { exact: true }),
    ).toBeVisible();
    await expect(
      view.getByRole('link', { name: 'Original dated NSE OI file' }),
    ).toHaveAttribute('href', input.sourceUrl);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await view.getByRole('link', { name: 'Back to Explore' }).click();
    await expect(page).toHaveURL(/#explore$/);
  } finally {
    await reviewer.dispose();
  }
});
