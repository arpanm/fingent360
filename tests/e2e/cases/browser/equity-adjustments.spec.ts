import {
  test,
  expect,
  adjustmentActors,
  adjustmentInput,
  adjustmentReview,
  retentionHeaders,
} from '../../helpers/equity-adjustments';
test.use({ namedOperators: true });
test('E2E-WEB-1340 company normalization shows actual raw-versus-adjusted price comparison and source factors @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer } = await adjustmentActors(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const input = adjustmentInput();
    expect(
      (
        await request.post('/api/v1/ops/equity-adjustments/prepare', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equity-adjustments/review', {
          headers: retentionHeaders,
          data: adjustmentReview(input.requestId),
        })
      ).status(),
    ).toBe(201);
    await page.goto(`/?equity=${input.isin}#equities`);
    const section = page.getByRole('region', {
      name: 'Reviewed price normalization',
    });
    await expect(section).toBeVisible();
    const details = section.getByText('Compare raw and normalized closes', {
      exact: true,
    });
    await details.focus();
    await expect(details).toBeFocused();
    await details.press('Enter');
    await expect(
      section.getByText('2025-01-02: raw ₹200 → normalized ₹100'),
    ).toBeVisible();
    await section
      .getByText('Adjustment factors and source coverage', { exact: true })
      .click();
    await expect(
      section.getByText(/historical factor1\/2|historical factor 1\/2/),
    ).toBeVisible();
    await expect(
      section.getByRole('link', { name: 'Exchange corporate-action source' }),
    ).toHaveAttribute('href', input.sourceUrl);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await reviewer.dispose();
  }
});
