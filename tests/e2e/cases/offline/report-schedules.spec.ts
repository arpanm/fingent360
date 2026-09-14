import { test, expect } from '@playwright/test';
test('E2E-OFFLINE-360 device schedule opt-in persistence export and deletion without API @REPORT-SCHEDULES-001', async ({
  page,
}) => {
  const api: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/')) api.push(r.url());
  });
  await page.goto('/#report-schedules');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page.evaluate(async () => {
    const r = await fetch('/api/v1/account/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `schedule_${crypto.randomUUID().slice(0, 8)}`,
        password: 'Synthetic-schedule-2026',
        consent: true,
      }),
    });
    if (!r.ok) throw new Error('Owned local registration failed.');
  });
  await page.reload();
  await page.getByRole('button', { name: 'New schedule', exact: true }).click();
  await page
    .getByLabel('Schedule label', { exact: true })
    .fill('Synthetic local schedule');
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
  await expect(
    page.getByRole('heading', { name: 'Synthetic local schedule' }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const exported = await (
      await fetch('/api/v1/account/privacy/export')
    ).json();
    const removed = await fetch('/api/v1/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'Synthetic-schedule-2026' }),
    });
    const signedOut = await fetch('/api/v1/account/report-schedules');
    return {
      count: exported.reportSchedules.editions.length,
      removed: removed.status,
      signedOut: signedOut.status,
    };
  });
  expect(result).toEqual({ count: 1, removed: 200, signedOut: 401 });
  expect(api).toEqual([]);
});
test('E2E-OFFLINE-361 next-open latest-due capture is durable exact and not duplicated @REPORT-SCHEDULES-001', async ({
  page,
}) => {
  const api: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/')) api.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const result = await page.evaluate(async () => {
    const post = async (path: string, body: unknown) => {
      const r = await fetch(`/api/v1/account/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Fixture failed ${r.status}`);
      return r.json();
    };
    await post('register', {
      username: `due_${crypto.randomUUID().slice(0, 8)}`,
      password: 'Synthetic-schedule-2026',
      consent: true,
    });
    await post('goals', {
      name: 'Synthetic exact goal',
      type: 'education',
      targetMinor: '100000',
      savedMinor: '12001',
      monthlyMinor: '3333',
      horizonMonths: 12,
      currency: 'INR',
      scale: 2,
      assumptions: 'no-growth-nominal-v1',
      storageConsent: true,
    });
    const id = crypto.randomUUID();
    await post(`report-schedules/${id}`, {
      requestId: crypto.randomUUID(),
      expectedVersion: 0,
      action: 'save',
      config: {
        label: 'Synthetic due local',
        frequency: 'daily',
        time: '09:00',
        timezone: 'Asia/Kolkata',
        weekday: 1,
        policy: 'saved-record-review-v1',
      },
      consent: true,
    });
    // Age only this owned fixture's scheduling cursor; configuration receipts remain immutable.
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('fingent360-device', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result,
          tx = db.transaction('workspace', 'readwrite'),
          store = tx.objectStore('workspace'),
          get = store.get('current');
        get.onsuccess = () => {
          const state = get.result,
            owned = state.data.localReportSchedules[state.sessionUserId],
            schedule = owned.schedules.find((s: { id: string }) => s.id === id);
          schedule.nextDueAt = new Date(
            Date.now() - 3 * 86400000,
          ).toISOString();
          state.revision++;
          store.put(state, 'current');
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
    const first = await (await fetch('/api/v1/account/reports')).json();
    const inbox = await (
      await fetch('/api/v1/account/report-schedules')
    ).json();
    const again = await (await fetch('/api/v1/account/reports')).json();
    return {
      jobs: first.jobs.length,
      again: again.jobs.length,
      goal: first.jobs[0].snapshot.goals[0].savedMinor,
      occurrences: inbox.occurrences.length,
      skipped: inbox.occurrences[0].skipped,
      status: first.jobs[0].status,
    };
  });
  expect(result.jobs).toBe(1);
  expect(result.again).toBe(1);
  expect(result.goal).toBe('12001');
  expect(result.occurrences).toBe(1);
  expect(result.skipped).toBeGreaterThanOrEqual(2);
  expect(result.status).toBe('succeeded');
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const count = await page.evaluate(
    async () =>
      (await (await fetch('/api/v1/account/report-schedules')).json())
        .occurrences.length,
  );
  expect(count).toBe(1);
  expect(api).toEqual([]);
});
