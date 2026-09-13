import { test, expect } from '../../helpers/app-fixture';
async function setup(page: import('@playwright/test').Page) {
  await page.goto('/');
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
test('E2E-WEB-223 mobile delete confirmation cancel, receipt, reclaimed capacity and reload @REPORTS-002', async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.goto('/#reports');
  const trigger = page.getByRole('button', {
    name: 'Delete report',
    exact: true,
  });
  await trigger.click({ timeout: 15000 });
  await expect(
    page.getByRole('dialog', { name: 'Delete this report?' }),
  ).toContainText('Downloaded copies');
  await page.screenshot({
    path: testInfo.outputPath('report-delete-confirmation.png'),
    fullPage: false,
  });
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
  await expect(
    page.getByRole('heading', { name: 'Report history', exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Report capacity')).toContainText('0 of 100');
});
test('E2E-WEB-224 another tab deletion removes reader and stale list cannot restore report @REPORTS-002', async ({
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
  await expect(
    page.getByRole('button', { name: 'Open report', exact: true }),
  ).toHaveCount(0);
});

test('E2E-WEB-225 simulated slow overlapping reads still show a usable real report response @REPORTS-002 @simulated', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/#reports');
  await expect(
    page.getByRole('button', { name: 'Open report', exact: true }),
  ).toBeVisible({ timeout: 15000 });
  // Install after the active mount has loaded; React development StrictMode
  // intentionally discards its first mount and must not be the delayed request.
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    const state = window as unknown as {
      heldReportReads: Array<() => void>;
      restoreReportReads: () => Promise<void>;
    };
    state.heldReportReads = [];
    const inflight: Promise<void>[] = [];
    state.restoreReportReads = async () => {
      window.fetch = original;
      for (const release of state.heldReportReads) release();
      await Promise.all(inflight);
    };
    window.fetch = (input, init) => {
      const pending = (async () => {
        if (String(input) === '/api/v1/account/reports' && !init?.method)
          await new Promise<void>((resolve) =>
            state.heldReportReads.push(resolve),
          );
        return original(input, init);
      })();
      inflight.push(
        pending
          .then((response) => response.clone().arrayBuffer())
          .then(
            () => {},
            () => {},
          ),
      );
      return pending;
    };
  });
  try {
    const id = await page.evaluate(async () => {
      const response = await fetch('/api/v1/account/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          label: 'Synthetic arriving during slow polls',
          consent: true,
        }),
      });
      if (!response.ok) throw Error(`Report setup failed ${response.status}`);
      return (await response.json()).id as string;
    });
    await expect
      .poll(() =>
        page.evaluate(
          async (id) =>
            (await (await fetch(`/api/v1/account/reports/${id}`)).json())
              .status,
          id,
        ),
      )
      .toBe('succeeded');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { heldReportReads: Array<() => void> })
              .heldReportReads.length,
        ),
      )
      .toBeGreaterThanOrEqual(2);
    await page.evaluate(() =>
      (window as unknown as { heldReportReads: Array<() => void> })
        .heldReportReads[0]!(),
    );
    // The first completed actual response contains the new report. A newer
    // pending poll must not prevent the page from accepting that useful result.
    await expect(
      page.getByRole('heading', {
        name: 'Synthetic arriving during slow polls',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open report', exact: true }),
    ).toHaveCount(2);
  } finally {
    await page.goto('/#today');
    await page.evaluate(() =>
      (
        window as unknown as { restoreReportReads: () => Promise<void> }
      ).restoreReportReads(),
    );
  }
});
