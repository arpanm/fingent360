import { test, expect } from '../../helpers/app-fixture';
import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
async function api(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch('/api/v1/account' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, body },
  );
}
const original = 'isin,quantity,total_cost_paise\nINE002A01018,1.000001,10001';
const replacement = 'isin,quantity,total_cost_paise\nINE009A01021,2,20002';
async function setup(page: Page) {
  await page.goto('/#holdings');
  expect(
    (
      await api(page, '/register', {
        username: `review_${randomUUID().slice(0, 12)}`,
        password: 'Synthetic-review-browser-2026',
        consent: true,
      })
    ).status,
  ).toBe(201);
  const preview = await api(page, '/holdings/preview', {
    csv: original,
    expectedVersion: 0,
    storageConsent: true,
  });
  expect(
    (
      await api(page, '/holdings/confirm', {
        previewId: preview.body.previewId,
        expectedVersion: 0,
      })
    ).status,
  ).toBe(201);
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('INE002A01018');
  await page
    .getByRole('button', { name: 'Import CSV or XLSX', exact: true })
    .click();
  await page.getByLabel('Holdings CSV', { exact: true }).fill(replacement);
  await page
    .getByRole('checkbox', { name: /I consent to storing my holdings/ })
    .check();
  await page
    .getByRole('button', { name: 'Preview holdings', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Holdings preview', exact: true }),
  ).toBeVisible();
}
test('E2E-WEB-400 mobile keyboard review requires removal acknowledgement and persists replacement @HOLDINGS-RECONCILE-001', async ({
  page,
}, testInfo) => {
  await setup(page);
  const preview = page.getByRole('region', {
    name: 'Holdings preview',
    exact: true,
  });
  await expect(
    preview.getByRole('region', { name: 'removed holdings', exact: true }),
  ).toContainText('INE002A01018');
  await expect(
    preview.getByRole('region', { name: 'added holdings', exact: true }),
  ).toContainText('INE009A01021');
  const confirm = preview.getByRole('button', {
    name: 'Confirm replacement',
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await preview
    .getByRole('heading', { name: 'What will change', exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('holdings-change-review.png'),
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const ack = preview.getByRole('checkbox', {
    name: /I acknowledge removing all 1 listed holdings/,
  });
  await ack.focus();
  await page.keyboard.press('Space');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(
    page.getByText('Holdings saved.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).toContainText('INE009A01021');
  await expect(
    page.getByRole('region', { name: 'Saved holdings', exact: true }),
  ).not.toContainText('INE002A01018');
});
test('E2E-WEB-401 stale preview preserves draft and committed confirmation survives following read outage @HOLDINGS-RECONCILE-001', async ({
  page,
}) => {
  await setup(page);
  const competing = await api(page, '/holdings/preview', {
    csv: original,
    expectedVersion: 1,
    storageConsent: true,
  });
  expect(
    (
      await api(page, '/holdings/confirm', {
        previewId: competing.body.previewId,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(201);
  await page
    .getByRole('checkbox', {
      name: /I acknowledge removing all 1 listed holdings/,
    })
    .check();
  await page
    .getByRole('button', { name: 'Confirm replacement', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Holdings changed');
  await expect(
    page.getByRole('button', { name: 'Confirm replacement', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', {
      name: 'Refresh baseline and keep draft',
      exact: true,
    })
    .click();
  await expect(page.getByLabel('Holdings CSV', { exact: true })).toHaveValue(
    replacement,
  );
  await page
    .getByRole('button', { name: 'Preview holdings', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Holdings preview', exact: true }),
  ).toContainText('replacing revision 2');
  await page
    .getByRole('checkbox', {
      name: /I acknowledge removing all 1 listed holdings/,
    })
    .check();
  await page.route('**/api/v1/account/holdings', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic post-save read outage' }),
        })
      : route.fallback(),
  );
  await page
    .getByRole('button', { name: 'Confirm replacement', exact: true })
    .click();
  await expect(page.getByText(/Holdings saved as revision 3/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Confirm replacement', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Preview holdings', exact: true }),
  ).toBeDisabled();
  await page.unroute('**/api/v1/account/holdings');
  await page
    .getByRole('button', {
      name: 'Refresh baseline and keep draft',
      exact: true,
    })
    .click();
  const persisted = await api(page, '/holdings');
  expect(persisted.body.version).toBe(3);
  expect(persisted.body.holdings[0].isin).toBe('INE009A01021');
  const history = await api(page, '/holdings/history');
  expect(history.body.revisions).toHaveLength(3);
});

test('E2E-WEB-402 newer explicit reload and edited draft survive a held initial actual holdings response @HOLDINGS-RECONCILE-001 @TEST-SIMULATION', async ({
  page,
}) => {
  await page.goto('/#overview');
  expect(
    (
      await api(page, '/register', {
        username: `load_${randomUUID().slice(0, 12)}`,
        password: 'Synthetic-review-browser-2026',
        consent: true,
      })
    ).status,
  ).toBe(201);
  await page.evaluate(() => {
    type Held = {
      statuses: number[];
      active: number;
      allowReload: () => void;
      restore: () => void;
    };
    const target = window as typeof window & { holdingsInitial?: Held };
    const native = window.fetch.bind(window);
    let release!: () => void,
      holding = true;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state: Held = {
      statuses: [],
      active: 0,
      allowReload: () => {
        holding = false;
      },
      restore: () => {
        window.fetch = native;
        release();
      },
    };
    target.holdingsInitial = state;
    window.fetch = async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        location.href,
      );
      if (
        holding &&
        url.pathname === '/api/v1/account/holdings' &&
        (init?.method ?? 'GET') === 'GET'
      ) {
        state.active++;
        try {
          const response = await native(input, { ...init, signal: null });
          state.statuses.push(response.status);
          await gate;
          return response;
        } finally {
          state.active--;
        }
      }
      return native(input, init);
    };
  });
  try {
    await page.evaluate(() => {
      window.location.hash = 'holdings';
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as typeof window & {
                holdingsInitial?: { statuses: number[] };
              }
            ).holdingsInitial?.statuses.length ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    const created = await api(page, '/holdings/preview', {
      csv: original,
      expectedVersion: 0,
      storageConsent: true,
    });
    expect(
      (
        await api(page, '/holdings/confirm', {
          previewId: created.body.previewId,
          expectedVersion: 0,
        })
      ).status,
    ).toBe(201);
    await page.evaluate(() =>
      (
        window as typeof window & {
          holdingsInitial?: { allowReload: () => void };
        }
      ).holdingsInitial?.allowReload(),
    );
    await page
      .getByRole('button', { name: 'Reload saved holdings', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Saved holdings', exact: true }),
    ).toContainText('INE002A01018');
    await page
      .getByLabel('Security ISIN', { exact: true })
      .fill('INE009A01021');
    await page.evaluate(() =>
      (
        window as typeof window & { holdingsInitial?: { restore: () => void } }
      ).holdingsInitial?.restore(),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { holdingsInitial?: { active: number } })
              .holdingsInitial?.active,
        ),
      )
      .toBe(0);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(
      await page.evaluate(() =>
        (
          window as typeof window & { holdingsInitial?: { statuses: number[] } }
        ).holdingsInitial?.statuses.every((status) => status === 200),
      ),
    ).toBe(true);
    await expect(page.getByLabel('Security ISIN', { exact: true })).toHaveValue(
      'INE009A01021',
    );
    await expect(
      page.getByRole('region', { name: 'Saved holdings', exact: true }),
    ).toContainText('INE002A01018');
  } finally {
    await page.evaluate(() =>
      (
        window as typeof window & { holdingsInitial?: { restore: () => void } }
      ).holdingsInitial?.restore(),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { holdingsInitial?: { active: number } })
              .holdingsInitial?.active,
        ),
      )
      .toBe(0);
  }
});
