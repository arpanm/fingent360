import {
  test,
  expect,
  indiaMacroInput,
  indiaActors,
  indiaReview,
  retentionHeaders,
} from '../../helpers/india-macro';
test.use({ namedOperators: true });
test('E2E-WEB-1320 actual India macro reader shows publication vintages and recovers from empty cutoff @SRC-007 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = indiaMacroInput();
    expect(
      (
        await request.post('/api/v1/ops/india-macro/import', {
          headers: retentionHeaders,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/india-macro/review', {
          headers: retentionHeaders,
          data: indiaReview(input.requestId),
        })
      ).status(),
    ).toBe(201);
    await page.goto('/#india-macro');
    await expect(
      page.getByText(/Combined index101.03|Combined index 101.03/),
    ).toBeVisible();
    await page
      .getByText('Release vintages for 2026-06', { exact: true })
      .click();
    await expect(
      page
        .locator('details')
        .filter({
          has: page.getByText('Release vintages for 2026-06', { exact: true }),
        })
        .getByText(/matches-current-capture/),
    ).toBeVisible();
    await page.getByLabel('Published by (UTC)').fill('2026-07-12T00:00');
    await page
      .getByRole('button', { name: 'Apply publication cutoff' })
      .click();
    await expect(
      page.getByText('No reviewed release is available for this cutoff.'),
    ).toBeVisible();
    await page.getByLabel('Published by (UTC)').fill('');
    await page
      .getByRole('button', { name: 'Apply publication cutoff' })
      .click();
    await expect(
      page.getByRole('link', { name: 'Original MoSPI release' }).first(),
    ).toHaveAttribute('href', input.releaseUrl);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const back = page.getByRole('link', { name: 'Back to More', exact: true });
    await back.focus();
    await expect(back).toBeFocused();
    await back.press('Enter');
    await expect(page).toHaveURL(/#more$/);
  } finally {
    await reviewer.dispose();
  }
});
