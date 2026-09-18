import {
  test,
  expect,
  indiaActors,
  filingRights,
  runFilingTick,
} from '../../helpers/filing-watch';
import {
  companyCohortInput,
  loadCompanyCohort,
} from '../../helpers/equity-company-cohort';
import { sourceOpsBrowser } from '../../helpers/source-ops-browser';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-WEB-1990 original filing permission schedule and independent publication use actual Operations forms @SRC-004 @TEST-SIMULATION', async ({
  page,
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    entry = (await loadCompanyCohort())[0]!,
    input = await companyCohortInput(entry);
  try {
    await sourceOpsBrowser(
      page,
      request,
      feedbackSandbox,
      'Original filing watch',
    );
    let ops = page.getByRole('region', {
      name: 'Original financial filing watch',
    });
    await expect(ops).toContainText('No filing watch attempts yet.');
    await expect(
      ops.getByRole('button', { name: 'Save filing watch permission' }),
    ).toBeDisabled();
    await ops.getByLabel('Filing source permission').fill(filingRights);
    await ops
      .getByRole('checkbox', {
        name: 'Enable selected original watch',
        exact: true,
      })
      .check();
    await ops
      .getByRole('checkbox', {
        name: 'I verified permitted retention, display and offline use of these originals.',
        exact: true,
      })
      .check();
    await ops
      .getByRole('button', { name: 'Save filing watch permission' })
      .click();
    await expect(ops).toContainText('Original watch permission saved.');
    await page
      .getByRole('button', { name: 'Automatic research', exact: true })
      .click();
    const automaticResearch = page.getByRole('region', {
      name: 'Automatic research',
      exact: true,
    });
    await expect(
      automaticResearch.getByRole('heading', {
        name: 'equity-filing-watch',
        exact: true,
      }),
    ).toBeVisible();
    await automaticResearch
      .getByRole('button', { name: 'Enable equity-filing-watch', exact: true })
      .click();
    await expect(
      automaticResearch.getByRole('button', {
        name: 'Pause equity-filing-watch',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await runFilingTick(feedbackSandbox, { [entry.sourceUrl]: input.body }),
    ).toBe(1);
    await sourceOpsBrowser(
      page,
      reviewer,
      feedbackSandbox,
      'Original filing watch',
    );
    ops = page.getByRole('region', { name: 'Original financial filing watch' });
    await expect(ops).toContainText('Current review state: draft');
    await ops
      .getByRole('button', { name: 'Inspect retained filing', exact: true })
      .click();
    await expect(ops.locator('pre')).toContainText(entry.isin);
    await ops.getByRole('button', { name: 'Close retained filing' }).click();
    await ops
      .getByLabel('Filing review reason')
      .fill(
        'Independent registered issuer, reported cells and permitted source checked.',
      );
    await ops
      .getByRole('checkbox', {
        name: 'I independently inspected original cells, issuer and source permission.',
        exact: true,
      })
      .check();
    await ops.getByRole('button', { name: 'Publish watched filing' }).click();
    await expect(ops).toContainText('Current review state: published');
    await ops.getByRole('link', { name: 'Open company', exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp('equity=' + entry.isin + '#equities'),
    );
    await expect(page.getByText(/revenue: 3438.76 lakhs/)).toBeVisible();
  } finally {
    await reviewer.dispose();
  }
});
