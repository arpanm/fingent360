import { test, expect } from '../../helpers/app-fixture';
import { prepareConnectionBrowser } from '../../helpers/research-connection-fixture';
test('E2E-WEB-330 guided schedule review persistence pause and current-read recovery @REPORT-SCHEDULES-001', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await prepareConnectionBrowser(page);
  await page.goto('/#report-schedules');
  await page.getByRole('button', { name: 'New schedule', exact: true }).click();
  await page
    .getByLabel('Schedule label', { exact: true })
    .fill('Synthetic weekly record review');
  await page.getByLabel('Time zone', { exact: true }).fill('America/New_York');
  await page.getByLabel('Day of week', { exact: true }).selectOption('5');
  await page
    .getByRole('button', { name: 'Review schedule', exact: true })
    .click();
  await expect(
    page.getByText('It excludes research notes.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(/Weekly on Friday at/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to configuration' }).click();
  await expect(page.getByLabel('Schedule label', { exact: true })).toHaveValue(
    'Synthetic weekly record review',
  );
  await expect(page.getByLabel('Day of week', { exact: true })).toHaveValue(
    '5',
  );
  await page
    .getByRole('button', { name: 'Review schedule', exact: true })
    .click();
  await page
    .getByLabel('I opt in to these recurring private snapshots.')
    .check();
  await page
    .getByRole('button', { name: 'Confirm schedule', exact: true })
    .click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Current schedules loaded below' }),
  ).toBeVisible();
  await page.reload();
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', {
      name: 'Synthetic weekly record review',
    }),
  });
  await expect(card).toContainText('active');
  await expect(card).toContainText('Weekly on Friday');
  await expect(card.getByText(/^Next:/)).toContainText(
    '9:00:00 AM (America/New_York)',
  );
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('report-schedule.png'),
    fullPage: false,
  });
  page.once('dialog', (d) => d.accept());
  await card.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(card).toContainText('paused');
  await page.route('**/api/v1/account/report-schedules', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Synthetic temporary storage outage' }),
    }),
  );
  await page.getByRole('button', { name: 'Reload schedules' }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic temporary');
  await expect(
    card.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeDisabled();
  await page.unroute('**/api/v1/account/report-schedules');
  await page.getByRole('button', { name: 'Reload schedules' }).click();
  await expect(
    card.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('E2E-WEB-331 owned report deep link opens issued receipt reloads and handles deletion @REPORT-SCHEDULES-001', async ({
  page,
}) => {
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const id = await page.evaluate(async () => {
    const r = await fetch('/api/v1/account/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        label: 'Synthetic linked report',
        consent: true,
      }),
    });
    if (!r.ok) throw new Error('Owned report creation failed.');
    return (await r.json()).id as string;
  });
  await page.goto(`/#reports?selected=${id}`);
  await expect(
    page.getByRole('region', { name: 'Issued record report' }),
  ).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Issued record report' }),
  ).toBeVisible();
  await page.evaluate(async (id) => {
    const job = await (await fetch(`/api/v1/account/reports/${id}`)).json();
    const r = await fetch(`/api/v1/account/reports/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: job.version, confirm: true }),
    });
    if (!r.ok) throw new Error('Owned report deletion failed.');
  }, id);
  await page.reload();
  await expect(
    page.getByText(
      'The linked report is unavailable. It may have been deleted or belong to another account.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Issued record report' }),
  ).toHaveCount(0);
});
test('E2E-WEB-332 failed initial load and uncertain change keep explicit recovery @REPORT-SCHEDULES-001', async ({
  page,
  feedbackSandbox,
}) => {
  await page.goto('/');
  await prepareConnectionBrowser(page);
  await page.route('**/api/v1/account/report-schedules', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"message":"Synthetic initial read outage"}',
    }),
  );
  await page.goto('/#report-schedules');
  await expect(page.getByRole('alert')).toContainText('Synthetic initial');
  await expect(
    page.getByRole('button', { name: 'New schedule', exact: true }),
  ).toBeDisabled();
  await page.unroute('**/api/v1/account/report-schedules');
  await page.getByRole('button', { name: 'Reload schedules' }).click();
  await page.getByRole('button', { name: 'New schedule', exact: true }).click();
  await page
    .getByLabel('Schedule label', { exact: true })
    .fill('Synthetic uncertain schedule');
  await page
    .getByRole('button', { name: 'Review schedule', exact: true })
    .click();
  await page
    .getByLabel('I opt in to these recurring private snapshots.')
    .check();
  let first = true;
  await page.route('**/api/v1/account/report-schedules/*', async (route) => {
    if (route.request().method() === 'POST' && first) {
      first = false;
      const response = await route.fetch({
        url: `${feedbackSandbox.apiOrigin}${new URL(route.request().url()).pathname}`,
      });
      expect(response.status()).toBe(201);
      await response.body();
      await route.abort('failed');
    } else await route.fallback();
  });
  await page
    .getByRole('button', { name: 'Confirm schedule', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Retry the same change' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry the same change' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Current schedules loaded below' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () =>
        (await (await fetch('/api/v1/account/report-schedules')).json())
          .schedules.length,
    ),
  ).toBe(1);
});
test('E2E-WEB-333 competing schedule update returns409 then reload restores usable controls @REPORT-SCHEDULES-001', async ({
  page,
}) => {
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const id = await page.evaluate(async () => {
    const id = crypto.randomUUID();
    const r = await fetch(`/api/v1/account/report-schedules/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        expectedVersion: 0,
        action: 'save',
        config: {
          label: 'Synthetic competing schedule',
          frequency: 'weekly',
          time: '09:00',
          timezone: 'Asia/Kolkata',
          weekday: 5,
          policy: 'saved-record-review-v1',
        },
        consent: true,
      }),
    });
    if (!r.ok) throw new Error('Owned schedule setup failed.');
    return id;
  });
  await page.goto('/#report-schedules');
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Synthetic competing schedule' }),
  });
  await expect(card).toContainText('Weekly on Friday');
  await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/account/report-schedules/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        expectedVersion: 1,
        action: 'pause',
        consent: true,
      }),
    });
    if (!r.ok) throw new Error('Competing real change failed.');
  }, id);
  page.once('dialog', (d) => d.accept());
  await card.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Schedule changed');
  await expect(
    page.getByRole('button', { name: 'Retry the same change' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Reload schedules' }).click();
  await expect(
    card.getByRole('button', { name: 'Resume', exact: true }),
  ).toBeEnabled();
  page.once('dialog', (d) => d.accept());
  await card.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(card).toContainText('active');
  await expect(
    card.getByRole('button', { name: 'Pause', exact: true }),
  ).toBeEnabled();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Local time', { exact: true }).fill('11:00');
  await page.evaluate(async (id) => {
    const data = await (await fetch('/api/v1/account/report-schedules')).json(),
      current = data.schedules.find((s: { id: string }) => s.id === id);
    const r = await fetch(`/api/v1/account/report-schedules/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        expectedVersion: current.version,
        action: 'save',
        config: { ...current.config, time: '10:00' },
        consent: true,
      }),
    });
    if (!r.ok) throw new Error('Competing actual edit failed.');
  }, id);
  await page
    .getByRole('button', { name: 'Review schedule', exact: true })
    .click();
  await page
    .getByLabel('I opt in to these recurring private snapshots.')
    .check();
  await page
    .getByRole('button', { name: 'Confirm schedule', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Discard stale draft and reload' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm schedule', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Reload schedules', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Confirm schedule', exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Weekly on Friday at 11:00/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Discard stale draft and reload' })
    .click();
  await expect(
    card.getByRole('button', { name: 'Edit', exact: true }),
  ).toBeEnabled();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Local time', { exact: true })).toHaveValue(
    '10:00',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});
async function pagedScheduleFixture(
  page: import('@playwright/test').Page,
  sandbox: import('../../helpers/feedback-fixture').FeedbackSandbox,
) {
  await page.goto('/');
  await prepareConnectionBrowser(page);
  const fixture = await page.evaluate(async () => {
    const id = crypto.randomUUID();
    const r = await fetch(`/api/v1/account/report-schedules/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        expectedVersion: 0,
        action: 'save',
        config: {
          label: 'Synthetic paged export',
          frequency: 'daily',
          time: '09:00',
          timezone: 'Asia/Kolkata',
          weekday: 1,
          policy: 'saved-record-review-v1',
        },
        consent: true,
      }),
    });
    if (!r.ok) throw new Error('Owned schedule creation failed.');
    const saved = await r.json();
    const account = await (await fetch('/api/v1/account')).json();
    return { id, owner: account.user.id, schedule: saved.schedule };
  });
  const pool = await (
    await import('../../helpers/research-connection-fixture')
  ).connectionDatabase(sandbox);
  try {
    const editions = Array.from({ length: 100 }, (_, i) => ({
      ...fixture.schedule,
      version: i + 2,
    }));
    await pool.query(
      `INSERT INTO report_schedule_editions(schedule_id,user_id,version,payload) SELECT $1,$2,(r->>'version')::int,r FROM jsonb_array_elements($3::jsonb) r`,
      [fixture.id, fixture.owner, JSON.stringify(editions)],
    );
    await pool.query(
      'UPDATE report_schedules SET version=101,payload=$2 WHERE id=$1',
      [fixture.id, editions.at(-1)],
    );
  } finally {
    await pool.end();
  }
  return fixture;
}

test('E2E-WEB-334 account download collects all real owned schedule history pages @REPORT-SCHEDULES-001', async ({
  page,
  feedbackSandbox,
}) => {
  const fixture = await pagedScheduleFixture(page, feedbackSandbox);
  await page.goto('/#privacy');
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download account JSON', exact: true })
    .click();
  const file = await downloaded,
    stream = await file.createReadStream();
  if (!stream) throw new Error('Downloaded account file missing.');
  let text = '';
  for await (const chunk of stream) text += chunk.toString();
  const exported = JSON.parse(text);
  expect(exported.account.id).toBe(fixture.owner);
  expect(exported.reportSchedules.complete).toBe(true);
  expect(exported.reportSchedules.editions).toHaveLength(101);
  expect(exported.reportSchedules.editions.at(-1).version).toBe(101);
});

test('E2E-WEB-335 later export page actual401 clears private controls and saves no partial file @REPORT-SCHEDULES-001', async ({
  page,
  feedbackSandbox,
}) => {
  const fixture = await pagedScheduleFixture(page, feedbackSandbox);
  await page.goto('/#privacy');
  await expect(
    page.getByRole('region', { name: 'Active sessions' }),
  ).toBeVisible();
  const pool = await (
    await import('../../helpers/research-connection-fixture')
  ).connectionDatabase(feedbackSandbox);
  const downloads: string[] = [];
  page.on('download', (d) => downloads.push(d.suggestedFilename()));
  let reached = false;
  await page.route(
    '**/api/v1/account/report-schedules/export?*',
    async (route) => {
      reached = true;
      await pool.query(
        "UPDATE app_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1",
        [fixture.owner],
      );
      await route.fallback();
    },
  );
  try {
    await page
      .getByRole('button', { name: 'Download account JSON', exact: true })
      .click();
    await expect(
      page.getByRole('link', {
        name: 'Sign in or create an account',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Account export' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Active sessions' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Download account JSON', exact: true }),
    ).toHaveCount(0);
    expect(reached).toBe(true);
    expect(downloads).toEqual([]);
  } finally {
    await page.unroute('**/api/v1/account/report-schedules/export?*');
    await pool.end();
  }
});
