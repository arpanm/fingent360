import {
  test,
  expect,
  indiaActors,
  indiaGdpInput,
} from '../../helpers/india-gdp';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true });
test('E2E-WEB-1770 actual original GDP upload independent review and mobile publication-vintage reader @SRC-007 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    input = indiaGdpInput();
  try {
    await sourceOpsBrowser(page, request, feedbackSandbox, 'India macro');
    const ops = page.getByRole('region', { name: 'India macro onboarding' });
    await ops.getByLabel('Source type').selectOption('gdp');
    await ops.getByLabel('Original source URL').fill(input.releaseUrl);
    await ops.getByLabel('Original source file').setInputFiles({
      name: 'reconstructed-gdp.html',
      mimeType: 'text/html',
      buffer: Buffer.from(input.releaseHtml),
    });
    await ops
      .getByLabel('Source permission evidence')
      .fill(input.rightsEvidence);
    await ops
      .getByRole('checkbox', {
        name: 'I verified attribution, display, retention and offline usage rights.',
        exact: true,
      })
      .check();
    await ops
      .getByRole('button', { name: 'Retain for independent review' })
      .click();
    await expect(ops.locator('article')).toContainText('draft');
    await sourceOpsBrowser(page, reviewer, feedbackSandbox, 'India macro');
    await ops
      .getByLabel('Independent review reason')
      .fill('Reconstructed original GDP reviewed independently.');
    await ops
      .getByRole('button', { name: 'Publish independently checked edition' })
      .click();
    await expect(ops.locator('article')).toContainText('publish');
    await page.goto('/#india-macro');
    const reader = page.getByRole('region', { name: 'India quarterly GDP' });
    await expect(reader).toContainText('81.36 lakh crore INR');
    await expect(reader).toContainText('2022-23');
    await expect(reader).toContainText('2026-11-30');
    const details = reader.getByText('GDP publication vintages', {
      exact: true,
    });
    await details.focus();
    await details.press('Enter');
    await expect(reader).toContainText('retained hash');
    await page.getByLabel('Published by (UTC)').fill('2026-08-31T10:29');
    await page
      .getByRole('button', { name: 'Apply publication cutoff' })
      .click();
    await expect(reader).toContainText('No reviewed original quarterly GDP');
  } finally {
    await reviewer.dispose();
  }
});
