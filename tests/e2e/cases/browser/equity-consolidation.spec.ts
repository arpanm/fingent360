import {
  test,
  expect,
  consolidationActors,
  consolidationInput,
  consolidationPdf,
} from '../../helpers/equity-consolidation';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true });
test('E2E-WEB-1780 actual original-notice form and independent review reach both company views @SRC-003 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { reviewer } = await consolidationActors(
    request,
    playwright,
    feedbackSandbox,
  );
  try {
    const input = consolidationInput();
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Security consolidations',
    );
    const region = page.getByRole('region', { name: 'Consolidation review' });
    for (const [label, value] of Object.entries({
      'Old ISIN': input.oldIsin,
      'New ISIN': input.newIsin,
      'Last old trading date': input.lastOldTradeOn,
      'Suspension date': input.suspendedOn,
      'Record date': input.recordOn,
      'Resumption date': input.resumedOn,
      'Old face value': input.oldFaceValue,
      'New face value': input.newFaceValue,
      'Full transition coverage evidence': input.coverageEvidence,
      'Source permission evidence': input.rightsEvidence,
    }))
      await region.getByLabel(label, { exact: true }).fill(value);
    for (const d of input.documents) {
      await region
        .getByLabel(`${d.role} source URL`, { exact: true })
        .fill(d.url);
      await region
        .getByLabel(`${d.role} publication date`, { exact: true })
        .fill(d.publishedOn);
      await region
        .getByLabel(`${d.role} original PDF`, { exact: true })
        .setInputFiles({
          name: 'synthetic-notice.pdf',
          mimeType: 'application/pdf',
          buffer: consolidationPdf,
        });
      await region
        .getByLabel(`${d.role} exact terms`, { exact: true })
        .fill(d.transcription);
    }
    await region.getByRole('checkbox', { name: /I verified a pure/ }).check();
    await region
      .getByRole('button', {
        name: 'Prepare consolidation bridge',
        exact: true,
      })
      .click();
    await expect(
      region.getByText('Consolidation status: draft', { exact: true }),
    ).toBeVisible();
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Security consolidations',
    );
    await region
      .getByLabel('Consolidation independent review reason', { exact: true })
      .fill(
        'Synthetic independent review of original terms and source permission.',
      );
    await region
      .getByRole('checkbox', { name: /I independently inspected all original/ })
      .check();
    await region
      .getByRole('button', {
        name: 'Publish consolidation bridge',
        exact: true,
      })
      .click();
    await expect(
      region.getByText('Consolidation status: publish', { exact: true }),
    ).toBeVisible();
    for (const isin of [input.oldIsin, input.newIsin]) {
      await page.goto(`/?equity=${isin}#equities`);
      const reader = page.getByRole('region', {
        name: 'Reviewed share consolidations',
      });
      await expect(
        reader.getByText(/expressed per new share ₹123.45/),
      ).toBeVisible();
      const details = reader.getByText('Original notices and review', {
        exact: true,
      });
      await details.focus();
      await details.press('Enter');
      await expect(
        reader.getByRole('link', { name: 'resumption original notice' }),
      ).toHaveAttribute('href', input.documents[1]!.url);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  } finally {
    await reviewer.dispose();
  }
});
