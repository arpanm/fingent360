import { readFile } from 'node:fs/promises';
import {
  test,
  expect,
  indiaActors,
  retentionHeaders as headers,
  indexLevelInput,
  indexLevelReview,
} from '../../helpers/index-levels';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({
  namedOperators: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});

test('E2E-WEB-1950 reviewed index history shows exact source identities decimals provenance and keyboard detail @INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = indexLevelInput();
    expect(
      (
        await request.post('/api/v1/ops/index-levels/capture', {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/index-levels/review', {
          headers,
          data: indexLevelReview(input.requestId),
        })
      ).status(),
    ).toBe(201);
    let unavailable = true;
    await page.route('**/api/v1/index-levels', (route) =>
      unavailable
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Synthetic index history outage' }),
          })
        : route.continue({
            url: feedbackSandbox.apiOrigin + '/api/v1/index-levels',
          }),
    );
    await page.goto('/#sources');
    await page
      .getByRole('link', { name: 'Daily price-index history', exact: true })
      .click();
    const view = page.getByRole('main', { name: 'Daily index history' });
    await expect(view.getByRole('alert')).toContainText(
      'Synthetic index history outage',
    );
    unavailable = false;
    await view
      .getByRole('button', { name: 'Refresh index history', exact: true })
      .click();
    await expect(view).toContainText('2026-09-18');
    await expect(view).toContainText('not total returns');
    const summary = view.getByText('Nifty Bank · close 100.25 points', {
      exact: true,
    });
    await summary.focus();
    await summary.press('Enter');
    await expect(summary.locator('..')).toContainText('Turnover (INR crore)');
    await expect(
      summary.locator('..').getByText('0.25', { exact: true }),
    ).toHaveCount(2);
    await expect(
      view.getByRole('link', { name: 'Original dated index snapshot' }),
    ).toHaveAttribute('href', input.sourceUrl);
    await view.getByText('Source provenance', { exact: true }).click();
    await expect(view).toContainText('SHA-256 of original CSV');
    await page.setViewportSize({ width: 390, height: 844 });
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

test('E2E-WEB-1951 original index upload resets attestation and uses independent review through withdrawal @INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const input = indexLevelInput();
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Daily index history',
    );
    const panel = page.getByRole('region', {
      name: 'Index levels source review',
    });
    await panel.getByLabel('Original daily index CSV').setInputFiles({
      name: input.filename,
      mimeType: 'text/csv',
      buffer: Buffer.from(input.csv),
    });
    await panel
      .getByLabel('Source permission evidence')
      .fill(input.rightsEvidence);
    const consent = panel.getByRole('checkbox', {
      name: /I have confirmed retention/,
    });
    await consent.check();
    await panel
      .getByLabel('Source permission evidence')
      .fill(input.rightsEvidence + ' Updated scope.');
    await expect(consent).not.toBeChecked();
    await consent.check();
    await panel
      .getByRole('button', { name: 'Retain index snapshot', exact: true })
      .click();
    await expect(
      panel
        .getByRole('status')
        .filter({ hasText: 'Original capture retained' }),
    ).toBeVisible();
    await expect(panel).toContainText('Status: draft');
    const downloaded = page.waitForEvent('download');
    await panel
      .getByRole('button', {
        name: 'Download retained index evidence',
        exact: true,
      })
      .click();
    const file = await downloaded;
    const path = await file.path();
    expect(path).not.toBeNull();
    const retained = JSON.parse(await readFile(path!, 'utf8'));
    expect(retained.csv).toBe(input.csv);
    expect(retained.filename).toBe(input.filename);
    expect(retained.rightsEvidence).toBe(
      input.rightsEvidence + ' Updated scope.',
    );
    await expect(panel.getByRole('status')).toContainText(
      'Retained index evidence downloaded.',
    );
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Daily index history',
    );
    await panel
      .getByLabel('Independent review reason')
      .fill(
        'TEST-SIMULATION: original names, date, ranges and permission verified independently.',
      );
    await panel
      .getByRole('checkbox', { name: /I independently checked/ })
      .check();
    await panel
      .getByRole('button', { name: 'Publish index snapshot', exact: true })
      .click();
    await expect(panel).toContainText('Status: publish');
    await page.goto('/#index-levels');
    await expect(
      page.getByRole('main', { name: 'Daily index history' }),
    ).toContainText('Nifty IT');
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Daily index history',
    );
    await panel
      .getByLabel('Independent review reason')
      .fill('TEST-SIMULATION: withdrawing the reviewed daily original.');
    await panel
      .getByRole('button', { name: 'Withdraw index snapshot', exact: true })
      .click();
    await expect(panel).toContainText('Status: withdraw');
    await page.goto('/#index-levels');
    await expect(
      page.getByText(
        'No permitted and independently reviewed index snapshots are available.',
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    await reviewer.dispose();
  }
});

test('E2E-WEB-1952 Operations discovers older unreviewed index captures and returns to the previous page @INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const { seedIndexQueue } = await import('../../helpers/index-levels');
    const ids = await seedIndexQueue(request, feedbackSandbox);
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Daily index history',
    );
    const panel = page.getByRole('region', {
      name: 'Index levels source review',
    });
    const captures = panel.locator('article[data-capture-id]');
    await expect(captures).toHaveCount(20);
    expect(
      await captures.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute('data-capture-id')),
      ),
    ).toEqual(ids.slice(0, 20));
    await panel
      .getByRole('button', { name: 'Next capture page', exact: true })
      .click();
    await expect(captures).toHaveCount(1);
    await expect(captures.first()).toHaveAttribute('data-capture-id', ids[20]!);
    await expect(
      panel.getByRole('button', { name: 'Next capture page', exact: true }),
    ).toBeDisabled();
    await panel
      .getByRole('button', { name: 'Previous capture page', exact: true })
      .click();
    await expect(captures).toHaveCount(20);
    expect(
      await captures.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute('data-capture-id')),
      ),
    ).toEqual(ids.slice(0, 20));
    await expect(
      panel.getByRole('button', { name: 'Previous capture page', exact: true }),
    ).toBeDisabled();
  } finally {
    await reviewer.dispose();
  }
});
