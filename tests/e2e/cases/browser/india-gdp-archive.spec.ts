import { test, expect, indiaActors } from '../../helpers/india-gdp';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true, indiaGdpArchiveSimulation: true });
test('E2E-WEB-1790 actual archive month form retains a GDP draft and reaches review queue @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'India macro');
    const form = page.getByRole('region', { name: 'GDP archive pickup' });
    await form.getByLabel('Archive publication month').fill('2026-08');
    await form
      .getByLabel('PIB archive retention permission')
      .fill('Synthetic archive permission evidence for browser regression.');
    await form.getByRole('checkbox').check();
    await form
      .getByRole('button', { name: 'Fetch month into GDP review' })
      .click();
    await expect(form.getByRole('status')).toContainText(
      '1 quarterly originals retained or quarantined',
    );
    await expect(form).toContainText('retained');
    await page
      .getByRole('button', { name: 'Refresh India queue', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'India macro onboarding' }),
    ).toContainText('QUARTERLY ESTIMATES OF GROSS DOMESTIC PRODUCT');
  } finally {
    await reviewer.dispose();
  }
});
