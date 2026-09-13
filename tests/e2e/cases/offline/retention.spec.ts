import { test, expect, type Page } from '@playwright/test';
import {
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
async function local(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async (args) => {
      const response = await fetch('/api/v1' + args.path, {
        method: args.method,
        headers: { 'Content-Type': 'application/json' },
        ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
      });
      return {
        status: response.status,
        body: (await response.json()) as unknown,
      };
    },
    { path, method, body },
  );
}
async function workspaceDigest(page: Page) {
  return page.evaluate(async () => {
    const state = await new Promise<unknown>((resolve, reject) => {
      const open = indexedDB.open('fingent360-device', 1);
      open.onerror = () =>
        reject(Error('Could not open this test device workspace.'));
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('workspace');
        const read = tx.objectStore('workspace').get('current');
        read.onsuccess = () => resolve(read.result);
        read.onerror = () =>
          reject(Error('Could not read this test device workspace.'));
        tx.oncomplete = () => db.close();
      };
    });
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(state)),
    );
    return Array.from(new Uint8Array(bytes), (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('');
  });
}

test('E2E-OFFLINE-280 Operations explains connected cleanup and local transport rejects it without network or workspace changes @RETENTION-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.method());
  });
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    (
      await local(page, '/account/register', 'POST', {
        username: `localretention_${Date.now()}`,
        password: 'Synthetic-local-retention-2026',
        consent: true,
      })
    ).status,
  ).toBe(201);
  expect(
    (
      await local(page, '/account/watchlist', 'PUT', {
        indicators: ['NY.GDP.MKTP.KD.ZG'],
      })
    ).status,
  ).toBe(200);
  const before = await workspaceDigest(page);
  await page.goto('/#ops');
  await expect(
    page.getByRole('heading', {
      name: 'Operations need a connected server',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Expired data cleanup applies to server records', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /cleanup/i })).toHaveCount(0);
  for (const [path, method, body] of [
    ['/ops/retention/runs', 'GET', undefined],
    ['/ops/retention/previews', 'POST', { requestId: crypto.randomUUID() }],
    [
      `/ops/retention/runs/${crypto.randomUUID()}/execute`,
      'POST',
      { confirm: true },
    ],
  ] as const) {
    const result = await local(page, path, method, body);
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).toContain(
      'requires a connected server',
    );
  }
  expect(await workspaceDigest(page)).toBe(before);
  const settings = page.getByRole('link', {
    name: 'Open App settings',
    exact: true,
  });
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#app-settings$/);
  await page.goto('/#ops');
  await page
    .getByRole('link', { name: 'Back to reading', exact: true })
    .click();
  await expect(page).toHaveURL(/#today$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(network).toEqual([]);
});

test('E2E-OFFLINE-281 ordinary local preview expiry preserves confirmed receipts and excludes them from draft capacity @RETENTION-001', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    (
      await local(page, '/account/register', 'POST', {
        username: `localreceipt_${Date.now()}`,
        password: 'Synthetic-local-receipt-2026',
        consent: true,
      })
    ).status,
  ).toBe(201);
  const csv =
    'isin,quantity,total_cost_paise\nINE002A01018,1.000001,9007199254740993';
  const first = HoldingsPreviewSchema.parse(
    (
      await local(page, '/account/holdings/preview', 'POST', {
        csv,
        expectedVersion: 0,
        storageConsent: true,
      })
    ).body,
  );
  const confirmation = { previewId: first.previewId, expectedVersion: 0 };
  const snapshot = HoldingsSnapshotSchema.parse(
    (await local(page, '/account/holdings/confirm', 'POST', confirmation)).body,
  );
  const unconfirmed = HoldingsPreviewSchema.parse(
    (
      await local(page, '/account/holdings/preview', 'POST', {
        csv,
        expectedVersion: 1,
        storageConsent: true,
      })
    ).body,
  );
  // Simulate old receipt times only in this fresh browser context's owned
  // IndexedDB. Financial revisions and the real confirmation remain unchanged.
  await page.evaluate(
    async ({ confirmedId, draftId }) => {
      const age = () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('fingent360-device', 1);
          open.onerror = () =>
            reject(Error('Could not open synthetic receipt fixture.'));
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('workspace', 'readwrite');
            const store = tx.objectStore('workspace');
            const read = store.get('current');
            read.onsuccess = () => {
              const state = read.result as {
                revision: number;
                sessionUserId: string;
                data: {
                  localHoldings: Record<
                    string,
                    {
                      previews: Record<
                        string,
                        {
                          preview: { previewId: string; expiresAt: string };
                          confirmedVersion: number | null;
                        }
                      >;
                    }
                  >;
                };
              };
              const previews =
                state.data.localHoldings[state.sessionUserId]!.previews;
              previews[confirmedId]!.preview.expiresAt =
                '2000-01-01T00:00:00.000Z';
              previews[draftId]!.preview.expiresAt = '2000-01-01T00:00:00.000Z';
              for (let index = 0; index < 20; index++) {
                const id = crypto.randomUUID();
                const receipt = structuredClone(previews[confirmedId]!);
                receipt.preview.previewId = id;
                previews[id] = receipt;
              }
              state.revision += 1;
              store.put(state, 'current');
            };
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => {
              db.close();
              reject(Error('Could not save synthetic receipt fixture.'));
            };
          };
        });
      if (navigator.locks)
        await navigator.locks.request('fingent360-device', age);
      else await age();
    },
    { confirmedId: first.previewId, draftId: unconfirmed.previewId },
  );
  expect(
    (
      await local(page, '/account/holdings/preview', 'POST', {
        csv,
        expectedVersion: 1,
        storageConsent: true,
      })
    ).status,
  ).toBe(201);
  expect(
    HoldingsSnapshotSchema.parse(
      (await local(page, '/account/holdings/confirm', 'POST', confirmation))
        .body,
    ),
  ).toEqual(snapshot);
  expect(
    (
      await local(page, '/account/holdings/confirm', 'POST', {
        previewId: unconfirmed.previewId,
        expectedVersion: 1,
      })
    ).status,
  ).toBe(404);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    HoldingsSnapshotSchema.parse(
      (await local(page, '/account/holdings/confirm', 'POST', confirmation))
        .body,
    ),
  ).toEqual(snapshot);
});
