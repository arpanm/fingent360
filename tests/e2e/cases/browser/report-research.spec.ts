import { test, expect } from '../../helpers/app-fixture';
import {
  prepareReportResearchBrowser,
  chooseResearchReport,
  captureResearchReport,
  reportResearchNote,
  reportResearchBase as base,
} from '../../helpers/report-research-fixture';
import {
  connectionDatabase,
  connectionGoal,
  prepareConnectionBrowser,
  reviseConnectionSourceFixture,
} from '../../helpers/research-connection-fixture';
import { RecordReportV2Schema } from '../../../../packages/contracts/src/index';

async function openIssued(page: import('@playwright/test').Page) {
  await page
    .getByRole('button', { name: 'Open report', exact: true })
    .first()
    .click({ timeout: 15000 });
  return page.getByRole('dialog', {
    name: 'Issued record report',
    exact: true,
  });
}

test('E2E-WEB-290 opt-in exact receipts review issue open and durable v2 JSON use actual owned records @REPORTS-003', async ({
  page,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearchBrowser(page, feedbackSandbox);
  await page.goto('/#reports');
  await expect(
    page.getByRole('checkbox', {
      name: 'Include research connections in this report',
      exact: true,
    }),
  ).not.toBeChecked();
  await chooseResearchReport(page);
  const review = page.getByRole('dialog', {
    name: 'Review report selection',
    exact: true,
  });
  await expect(review).toContainText(reportResearchNote);
  await expect(
    review.getByText(setup.source.sourceHash!, { exact: false }),
  ).not.toBeVisible();
  const sourceReceipt = review
    .getByText('Verify source receipt', { exact: true })
    .first();
  await sourceReceipt.focus();
  await page.keyboard.press('Enter');
  await expect(
    review.getByText(setup.source.sourceHash!, { exact: false }),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await captureResearchReport(page);
  const reader = await openIssued(page);
  await expect(reader).toContainText(
    'v2 · includes selected research receipts',
  );
  await expect(reader).toContainText(
    'Current publication and record status are unknown',
  );
  await expect(reader).toContainText(reportResearchNote);
  await expect(reader).toContainText('not current market value');
  await expect(
    reader.getByRole('link', { name: 'Original source website' }),
  ).toHaveCount(0);
  const report = RecordReportV2Schema.parse(
    await page.evaluate(
      async (base) => (await (await fetch(base)).json()).jobs[0].report,
      base,
    ),
  );
  expect(report.snapshot.researchConnections.receipts).toHaveLength(1);
  const downloadPromise = page.waitForEvent('download');
  await reader
    .getByRole('button', { name: 'Download this report', exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(report.id);
  const path = await download.path();
  if (!path) throw Error('Missing actual JSON download');
  const { readFile } = await import('node:fs/promises');
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(report);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(await openIssued(page)).toContainText(reportResearchNote);
  await page.screenshot({
    path: test.info().outputPath('issued-research-report.png'),
    fullPage: false,
  });
});

test('E2E-WEB-291 disabled inclusion keeps exact v1 and contains no private research notes @REPORTS-003', async ({
  page,
  feedbackSandbox,
}) => {
  await prepareReportResearchBrowser(page, feedbackSandbox);
  await page.goto('/#reports');
  await page
    .getByRole('checkbox', { name: /Store a private snapshot/ })
    .check();
  await page
    .getByRole('button', { name: 'Create record report', exact: true })
    .click();
  const reader = await openIssued(page);
  await expect(reader).toContainText('v1 · financial records');
  await expect(reader).not.toContainText(reportResearchNote);
  const actual = await page.evaluate(
    async (base) => (await (await fetch(base)).json()).jobs[0].report,
    base,
  );
  expect(actual.policy).toBe('saved-record-review-v1');
  expect(actual.snapshot).not.toHaveProperty('researchConnections');
});

test('E2E-WEB-292 empty connections and simulated list error support reload and v1 fallback @REPORTS-003 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.goto('/');
  await prepareConnectionBrowser(page);
  await page.goto('/#reports');
  let fail = true;
  await page.route('**/api/v1/account/research-connections', (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{}',
        })
      : route.fallback(),
  );
  await page
    .getByRole('checkbox', {
      name: 'Include research connections in this report',
      exact: true,
    })
    .check();
  const selection = page.getByRole('region', {
    name: 'Research connection selection',
    exact: true,
  });
  await expect(selection.getByRole('alert')).toContainText('Could not load');
  fail = false;
  await selection
    .getByRole('button', { name: 'Reload research connections' })
    .click();
  await expect(selection).toContainText('No active research connections');
  await page
    .getByRole('checkbox', { name: /Store a private snapshot/ })
    .check();
  await expect(
    page.getByRole('button', { name: 'Review report selection', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('checkbox', {
      name: 'Include research connections in this report',
      exact: true,
    })
    .uncheck();
  await page
    .getByRole('checkbox', { name: /Store a private snapshot/ })
    .check();
  await page
    .getByRole('button', { name: 'Create record report', exact: true })
    .click();
  await expect(await openIssued(page)).toContainText('v1 · financial records');
});

test('E2E-WEB-293 360px keyboard review Back and cancelled navigation preserve the chosen draft @REPORTS-003', async ({
  page,
  feedbackSandbox,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await prepareReportResearchBrowser(page, feedbackSandbox);
  await chooseResearchReport(page);
  const dialog = page.getByRole('dialog', {
    name: 'Review report selection',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .getByRole('region', {
        name: 'Research connection selection',
        exact: true,
      })
      .getByRole('checkbox')
      .first(),
  ).toBeChecked();
  const button = page.getByRole('button', {
    name: 'Review report selection',
    exact: true,
  });
  await button.focus();
  await page.keyboard.press('Enter');
  await dialog
    .getByRole('button', { name: 'Back to report selection', exact: true })
    .click();
  await expect(button).toBeFocused();
  page.once('dialog', (d) => d.dismiss());
  await page
    .getByRole('link', { name: 'Manage research connections', exact: true })
    .click();
  await expect(page).toHaveURL(/#reports$/);
  await expect(page.getByLabel('Report label', { exact: true })).toHaveValue(
    'Selected research record review',
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('E2E-WEB-294 lost committed response retries the same selection and never infers current status from replay @REPORTS-003 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearchBrowser(page, feedbackSandbox);
  await chooseResearchReport(page);
  const writes: string[] = [];
  await page.route('**/api/v1/account/reports', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    writes.push(route.request().postData()!);
    if (writes.length !== 1) return route.fallback();
    const response = await route.fetch({
      url: `${feedbackSandbox.apiOrigin}${base}`,
    });
    expect(response.status()).toBe(201);
    await route.abort('failed');
  });
  const dialog = page.getByRole('dialog', {
    name: 'Review report selection',
    exact: true,
  });
  await dialog
    .getByRole('button', { name: 'Capture selected report', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await reviseConnectionSourceFixture(
    feedbackSandbox,
    setup.source,
    'withdrawn',
  );
  await dialog
    .getByRole('button', { name: 'Retry same request', exact: true })
    .click();
  await expect(
    page.getByRole('status', { name: 'Report status', exact: true }),
  ).toContainText('Snapshot stored');
  expect(writes).toHaveLength(2);
  expect(writes[1]).toBe(writes[0]);
  const reader = await openIssued(page);
  await expect(reader).toContainText(
    'Current publication and record status are unknown',
  );
  await expect(
    reader.getByRole('link', { name: 'Original source website' }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      async (base) => (await (await fetch(base)).json()).jobs.length,
      base,
    ),
  ).toBe(1);
});

test('E2E-WEB-295 changed selected revision conflicts then discard reload and review capture the edited reason @REPORTS-003', async ({
  page,
  feedbackSandbox,
}) => {
  await prepareReportResearchBrowser(page, feedbackSandbox);
  await chooseResearchReport(page);
  await page.evaluate(async () => {
    const state = await (
        await fetch('/api/v1/account/research-connections')
      ).json(),
      revision = state.connections[0].revision;
    const response = await fetch(
      `/api/v1/account/research-connections/${revision.id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          requestId: crypto.randomUUID(),
          expectedVersion: revision.version,
          note: 'Edited after choosing report receipts.',
          storageConsent: true,
        }),
      },
    );
    if (!response.ok) throw Error(`Edit ${response.status}`);
  });
  const dialog = page.getByRole('dialog', {
    name: 'Review report selection',
    exact: true,
  });
  await dialog
    .getByRole('button', { name: 'Capture selected report', exact: true })
    .click();
  await expect(dialog.getByRole('alert')).toContainText('changed');
  await dialog
    .getByRole('button', { name: 'Back to report selection', exact: true })
    .click();
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Discard report retry draft', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reload research connections', exact: true })
    .click();
  const selection = page.getByRole('region', {
    name: 'Research connection selection',
    exact: true,
  });
  await expect(selection).toContainText(
    'Edited after choosing report receipts.',
  );
  await selection.getByRole('checkbox').first().check();
  await page
    .getByRole('button', { name: 'Review report selection', exact: true })
    .click();
  await captureResearchReport(page);
  await expect(await openIssued(page)).toContainText(
    'Edited after choosing report receipts.',
  );
});

test('E2E-WEB-296 withdrawn source and removed goal show capture warnings and explicit navigation checks current context @REPORTS-003 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearchBrowser(page, feedbackSandbox);
  await reviseConnectionSourceFixture(
    feedbackSandbox,
    setup.source,
    'withdrawn',
  );
  await page.evaluate(async () => {
    const goals = await (await fetch('/api/v1/account/goals')).json();
    const response = await fetch(`/api/v1/account/goals/${goals.goals[0].id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    if (!response.ok) throw Error(`Remove goal ${response.status}`);
  });
  await page.goto('/#reports');
  await page
    .getByRole('checkbox', {
      name: 'Include research connections in this report',
      exact: true,
    })
    .check();
  const selection = page.getByRole('region', {
    name: 'Research connection selection',
    exact: true,
  });
  await selection
    .getByRole('checkbox', {
      name: new RegExp(`Include ${connectionGoal.name}`),
    })
    .check();
  await page
    .getByRole('checkbox', { name: /Store a private snapshot/ })
    .check();
  await page
    .getByRole('button', { name: 'Review report selection', exact: true })
    .click();
  await captureResearchReport(page);
  const reader = await openIssued(page);
  await expect(reader).toContainText('withdrawn');
  await expect(reader).toContainText('removed before capture');
  await expect(reader).not.toContainText(setup.source.title);
  await reader
    .getByRole('link', {
      name: 'Open research connections to check current context',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/#connections$/);
  await expect(
    page.getByRole('heading', {
      name: 'Your research connections',
      exact: true,
    }),
  ).toBeVisible();
});

test('E2E-WEB-297 print window contains only selected immutable report and escaped personal text @REPORTS-003', async ({
  page,
  context,
  feedbackSandbox,
}) => {
  await context.addInitScript(() => {
    const open = window.open.bind(window);
    window.open = (url, target, features) => {
      const popup = open(url, target, features);
      if (popup)
        popup.print = () => {
          popup.document.documentElement.dataset.printRequested = 'yes';
        };
      return popup;
    };
  });
  await prepareReportResearchBrowser(page, feedbackSandbox);
  const note = '<img src=x onerror="window.reportInjection=true">';
  await page.evaluate(async (note) => {
    const state = await (
      await fetch('/api/v1/account/research-connections')
    ).json();
    for (const { revision } of state.connections) {
      const r = await fetch(
        `/api/v1/account/research-connections/${revision.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'edit',
            requestId: crypto.randomUUID(),
            expectedVersion: 1,
            note,
            storageConsent: true,
          }),
        },
      );
      if (!r.ok) throw Error(`Edit ${r.status}`);
    }
  }, note);
  await chooseResearchReport(page);
  await captureResearchReport(page);
  const reader = await openIssued(page);
  await expect(reader).toContainText(note);
  const popupPromise = page.waitForEvent('popup');
  await reader
    .getByRole('button', { name: 'Print report', exact: true })
    .click();
  const popup = await popupPromise;
  await expect(popup.locator('html')).toHaveAttribute(
    'data-print-requested',
    'yes',
  );
  await expect(popup.locator('body')).toContainText(note);
  await expect(popup.locator('body')).toContainText(
    'Current publication and record status are unknown',
  );
  await expect(popup.locator('details:not([open])')).toHaveCount(0);
  await expect(
    popup.getByText('Item and hash', { exact: true }).first(),
  ).toBeVisible();
  await expect(popup.getByRole('button')).toHaveCount(0);
  await expect(popup.getByRole('link')).toHaveCount(0);
  await expect(popup.locator('body')).not.toContainText('Create a snapshot');
  expect(await popup.evaluate(() => 'reportInjection' in window)).toBe(false);
  await popup.close();
});

test('E2E-WEB-298 individual v2 deletion removes report copy while owned research connections remain @REPORTS-003', async ({
  page,
  feedbackSandbox,
}) => {
  await prepareReportResearchBrowser(page, feedbackSandbox);
  await chooseResearchReport(page);
  await captureResearchReport(page);
  await openIssued(page);
  await page.keyboard.press('Escape');
  await page
    .getByRole('button', { name: 'Delete report', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Delete this report?' })
    .getByRole('button', { name: 'Keep report', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Open report' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Delete report', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Permanently delete report', exact: true })
    .click();
  await expect(page.getByLabel('Report capacity')).toContainText('0 of 100');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open report' })).toHaveCount(
    0,
  );
  const exported = await page.evaluate(async () =>
    (await fetch('/api/v1/account/privacy/export')).json(),
  );
  expect(exported.reports.jobs).toEqual([]);
  expect(exported.researchConnections.revisions).toHaveLength(2);
  expect(JSON.stringify(exported.reports)).not.toContain(reportResearchNote);
});

test('E2E-WEB-299 signed-out report route protects owned research choices and preserves account navigation @REPORTS-003', async ({
  page,
  feedbackSandbox,
}) => {
  await prepareReportResearchBrowser(page, feedbackSandbox);
  await page.evaluate(async () => {
    const r = await fetch('/api/v1/account/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) throw Error(`Logout ${r.status}`);
  });
  await page.goto('/#reports');
  await expect(
    page.getByRole('link', {
      name: 'Sign in or create an account',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(reportResearchNote, { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole('link', { name: 'Sign in or create an account', exact: true })
    .click();
  await expect(page).toHaveURL(/#account\?next=reports$/);
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});

test('E2E-WEB-301 actual capture and selection expiry clear private state despite delayed or failed report reads @REPORTS-003 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const setup = await prepareReportResearchBrowser(page, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox);
  const releaseReads: Array<() => void> = [];
  const pattern = '**/api/v1/account/reports';
  let historicalList:
    Promise<import('@playwright/test').APIResponse> | undefined;
  try {
    await page.evaluate(async (base) => {
      const r = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          label: 'Private report predating expiry',
          consent: true,
        }),
      });
      if (!r.ok) throw Error(`Report setup ${r.status}`);
    }, base);
    // Hold actual successful list responses from before expiry. Only timing is
    // simulated; a later response must not restore the denied private workspace.
    await page.route(pattern, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      historicalList ??= route.fetch({
        url: `${feedbackSandbox.apiOrigin}${base}`,
      });
      const response = await historicalList;
      await new Promise<void>((resolve) => releaseReads.push(resolve));
      await route.fulfill({ response }).catch(() => {});
    });
    await chooseResearchReport(page);
    await expect(
      page.getByRole('dialog', {
        name: 'Review report selection',
        exact: true,
      }),
    ).toContainText(reportResearchNote);
    await expect.poll(() => releaseReads.length).toBeGreaterThan(0);
    await pool.query(
      'UPDATE app_sessions SET expires_at=clock_timestamp() WHERE user_id=(SELECT user_id FROM app_research_connections WHERE id=$1)',
      [setup.revisions[0]!.id],
    );
    const deniedCapture = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === base &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('dialog', { name: 'Review report selection', exact: true })
      .getByRole('button', { name: 'Capture selected report', exact: true })
      .click();
    expect((await deniedCapture).status()).toBe(401);
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('dialog', {
        name: 'Review report selection',
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText(reportResearchNote, { exact: false }),
    ).toHaveCount(0);
    const lateRead = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === base &&
        response.request().method() === 'GET',
    );
    releaseReads.splice(0).forEach((release) => release());
    await (await lateRead).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Report history', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText('Private report predating expiry', { exact: true }),
    ).toHaveCount(0);
    await page.unroute(pattern);

    // A new real account proves the selection fetch itself can close the private
    // workspace when report polling returns503 rather than delivering its own401.
    await page.goto('/');
    await prepareConnectionBrowser(page);
    const owner = await page.evaluate(
      async () =>
        (await (await fetch('/api/v1/account/privacy/export')).json()).account
          .id as string,
    );
    await page.route(pattern, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Synthetic report-list outage during expiry.',
            }),
          })
        : route.fallback(),
    );
    await page.goto('/#reports');
    await page
      .getByLabel('Report label', { exact: true })
      .fill('Private unsaved label');
    await pool.query(
      'UPDATE app_sessions SET expires_at=clock_timestamp() WHERE user_id=$1',
      [owner],
    );
    const deniedSelection = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
        '/api/v1/account/research-connections',
    );
    await page
      .getByRole('checkbox', {
        name: 'Include research connections in this report',
        exact: true,
      })
      .check();
    expect((await deniedSelection).status()).toBe(401);
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', {
        name: 'Research connection selection',
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(page.getByLabel('Report label', { exact: true })).toHaveCount(
      0,
    );
  } finally {
    releaseReads.splice(0).forEach((release) => release());
    await page.unroute(pattern);
    await pool.end();
  }
});
