import { test, expect } from '@playwright/test';
async function setup(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  return page.evaluate(async () => {
    const send = async (path: string, body: unknown) => {
      const r = await fetch(`/api/v1/account/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error(`Synthetic setup ${r.status}`);
      return r.json();
    };
    await send('register', {
      username: `del_${crypto.randomUUID().slice(0, 12)}`,
      password: 'Synthetic-delete-2026',
      consent: true,
    });
    return send('reports', {
      requestId: crypto.randomUUID(),
      label: 'Synthetic deletable report',
      consent: true,
    });
  });
}
test('E2E-OFFLINE-263 mobile delete confirmation cancel, receipt, reclaimed capacity and reload @REPORTS-002', async ({
  page,
}) => {
  const outbound: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) outbound.push(r.url());
  });
  const job = await setup(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#reports');
  const trigger = page.getByRole('button', {
    name: 'Delete report',
    exact: true,
  });
  await trigger.click({ timeout: 15000 });
  await expect(
    page.getByRole('dialog', { name: 'Delete this report?' }),
  ).toContainText('Downloaded copies');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Keep report', exact: true }).click();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page
    .getByRole('button', { name: 'Permanently delete report', exact: true })
    .click();
  await expect(page.getByLabel('Report capacity')).toContainText('0 of 100');
  await expect(trigger).toHaveCount(0);
  await expect(
    page.getByRole('status', { name: 'Report status' }),
  ).toContainText('permanently deleted');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(page.getByLabel('Report capacity')).toContainText('0 of 100');
  const checks = await page.evaluate(async (id) => {
    const replay = await fetch('/api/v1/account/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: id,
        label: 'Synthetic deletable report',
        consent: true,
      }),
    });
    const exported = await (
      await fetch('/api/v1/account/privacy/export')
    ).json();
    await fetch('/api/v1/account/logout', { method: 'POST' });
    await fetch('/api/v1/account/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `other_${crypto.randomUUID().slice(0, 12)}`,
        password: 'Synthetic-delete-2026',
        consent: true,
      }),
    });
    const foreign = await fetch('/api/v1/account/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, label: 'foreign', consent: true }),
    });
    return {
      status: replay.status,
      reports: exported.reports,
      foreign: foreign.status,
    };
  }, job.id);
  expect(checks.status).toBe(410);
  expect(checks.foreign).toBe(404);
  expect(JSON.stringify(checks.reports)).not.toContain(
    'Synthetic deletable report',
  );
  expect(checks.reports.deletions).toHaveLength(1);
  expect(outbound).toEqual([]);
});
test('E2E-OFFLINE-264 another tab deletion removes reader and stale list cannot restore report @REPORTS-002', async ({
  page,
}) => {
  const job = await setup(page);
  await page.goto('/#reports');
  await page
    .getByRole('button', { name: 'Open report', exact: true })
    .click({ timeout: 15000 });
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    const state = window as unknown as {
      releaseReport?: () => void;
      reportHeld?: boolean;
      reportDelivered?: boolean;
    };
    let once = true;
    window.fetch = async (input, init) => {
      if (
        once &&
        String(input) === '/api/v1/account/reports' &&
        !init?.method
      ) {
        once = false;
        const response = await original(input, init);
        const old = await response.text();
        state.reportHeld = true;
        await new Promise<void>((resolve) => {
          state.releaseReport = resolve;
        });
        state.reportDelivered = true;
        return new Response(old, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return original(input, init);
    };
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { reportHeld?: boolean }).reportHeld,
      ),
    )
    .toBe(true);
  await page.evaluate(async (id) => {
    const current = await (await fetch(`/api/v1/account/reports/${id}`)).json();
    const removed = await fetch(`/api/v1/account/reports/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: current.version, confirm: true }),
    });
    if (!removed.ok) throw Error('Remote deletion failed');
  }, job.id);
  await expect(
    page.getByRole('dialog', { name: 'Issued record report' }),
  ).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByLabel('Report capacity')).toContainText('0 of 100');
  await page.evaluate(() =>
    (window as unknown as { releaseReport?: () => void }).releaseReport?.(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { reportDelivered?: boolean }).reportDelivered,
      ),
    )
    .toBe(true);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(
    page.getByRole('button', { name: 'Open report', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open report', exact: true }),
  ).toHaveCount(0);
});
