import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import {
  CCIL_LIQUIDITY_URL,
  CcilLiquiditySnapshotSchema,
  CcilLiquidityListSchema,
  parseCcilLiquidity,
} from '../../../../packages/contracts/src/index';
import {
  activateObservationControl,
  tabToObservationControl,
  captureObservationLayout,
} from '../../helpers/observation-inbox-accessibility';
import { ccilLiquidityWorkbook } from '../../helpers/ccil-liquidity';
import { handleCcilLiquidity } from '../../../../apps/web/src/offline/ccil-liquidity';
import type {
  OfflineBundle,
  OfflineRequest,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-2320 frozen historical liquidity preserves nulls and exact source fields excludes withdrawal and forbids writes @CCIL-LIQUIDITY-001 @SRC-017 @TEST-SIMULATION', async () => {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request: OfflineRequest = {
    method: 'GET',
    path: '/api/v1/bond-liquidity',
    query: new URLSearchParams(),
    headers: new Headers(),
    body: undefined,
  };
  const bytes = ccilLiquidityWorkbook(),
    at = '2026-09-20T00:00:00.000Z';
  const edition = {
    id: randomUUID(),
    hash: createHash('sha256').update(bytes).digest('hex'),
    sourceUrl: CCIL_LIQUIDITY_URL,
    retrievedAt: at,
    data: parseCcilLiquidity(bytes),
    error: null,
    state: 'published',
    reviewedAt: at,
  };
  const editions = [
    edition,
    { ...edition, id: randomUUID(), state: 'withdrawn' },
    { ...edition, id: randomUUID() },
  ];
  const snapshot = {
    ...bundle,
    bondLiquidity: { enabled: true, capturedAt: at, editions },
  };
  const first = await handleCcilLiquidity(
    { ...request, query: new URLSearchParams({ limit: '1' }) },
    state,
    snapshot,
  );
  const page = first?.body as { editions: typeof editions; nextCursor: string };
  expect(page.editions).toHaveLength(1);
  expect(page.editions[0]?.data.rows[0]?.metrics[0]).toBe(
    '1.34254584763383E-3',
  );
  expect(page.editions[0]?.data.rows[1]?.metrics).toEqual(Array(7).fill(null));
  expect(page.editions[0]?.data.date).toBe('2026-07-31');
  expect(page.nextCursor).toBeTruthy();
  const second = await handleCcilLiquidity(
    {
      ...request,
      query: new URLSearchParams({ limit: '1', cursor: page.nextCursor }),
    },
    state,
    snapshot,
  );
  const next = second?.body as {
    editions: typeof editions;
    nextCursor: string | null;
  };
  expect(next.editions).toHaveLength(1);
  expect(next.editions[0]?.id).not.toBe(page.editions[0]?.id);
  expect(next.nextCursor).toBeNull();
  expect(
    (
      await handleCcilLiquidity(request, state, {
        ...snapshot,
        bondLiquidity: { ...snapshot.bondLiquidity, enabled: false },
      })
    )?.body,
  ).toEqual({ enabled: false, editions: [], nextCursor: null });
  for (const path of [
    '/api/v1/ops/bond-liquidity/import',
    '/api/v1/ops/bond-liquidity/fetch',
    '/api/v1/ops/bond-liquidity/' + edition.id + '/review',
  ])
    await expect(
      handleCcilLiquidity(
        { ...request, path, method: 'POST' },
        state,
        snapshot,
      ),
    ).rejects.toMatchObject({ status: 503 });
  await expect(
    handleCcilLiquidity(
      { ...request, query: new URLSearchParams({ cursor: 'invalid' }) },
      state,
      snapshot,
    ),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    handleCcilLiquidity({ ...request, method: 'POST' }, state, snapshot),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    CcilLiquiditySnapshotSchema.safeParse({
      ...snapshot.bondLiquidity,
      nextCursor: at + '|' + edition.id,
    }).success,
  ).toBe(false);
  expect(
    CcilLiquiditySnapshotSchema.safeParse({
      ...snapshot.bondLiquidity,
      editions: [
        {
          ...edition,
          data: {
            ...edition.data,
            rows: [{ ...edition.data.rows[0], tradeDate: '2026-09-20' }],
          },
        },
      ],
    }).success,
  ).toBe(false);
  expect(
    CcilLiquiditySnapshotSchema.safeParse({
      ...snapshot.bondLiquidity,
      editions: [{ ...edition, data: null }],
    }).success,
  ).toBe(false);
});

test('E2E-OFFLINE-2321 installed Funds and bonds liquidity navigation search and paging use frozen source or explicit disabled state without API network @CCIL-LIQUIDITY-001 @SRC-017', async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 360, height: 800 });
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/#sources');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await tabToObservationControl(
    page,
    page.getByRole('link', {
      name: 'Fund disclosures and bond yields',
      exact: true,
    }),
  );
  await page.keyboard.press('Enter');
  const reader = page.getByRole('region', {
    name: 'Historical government-security liquidity',
    exact: true,
  });
  await expect(reader).toBeVisible();
  // Observe the installed package through its actual local handler. No injected
  // success response, provider permission, original data or bundle mutation.
  const response = await page.evaluate(async () => {
    const r = await fetch('/api/v1/bond-liquidity');
    return { status: r.status, data: await r.json() };
  });
  expect(response.status).toBe(200);
  const data = CcilLiquidityListSchema.parse(response.data);
  if (!data.enabled)
    await expect(reader).toContainText(
      'Liquidity source is not enabled for this deployment.',
    );
  else if (!data.editions.length)
    await expect(reader).toContainText(
      'No reviewed liquidity disclosure is available.',
    );
  else {
    const source = data.editions[0]!,
      rows = source.data!.rows;
    const first = reader.locator('details').first();
    await expect(first).toContainText(source.hash);
    await expect(first).toContainText(source.retrievedAt);
    if (rows.length > 25) {
      await activateObservationControl(
        page,
        first.getByRole('button', { name: 'Next source rows', exact: true }),
      );
      await expect(first.locator('tbody tr')).toHaveCount(
        Math.min(rows.length - 25, 25),
      );
      await activateObservationControl(
        page,
        first.getByRole('button', {
          name: 'Previous source rows',
          exact: true,
        }),
      );
    }
    const selected =
      rows.find((r) => r.metrics.some((v) => v === null)) ?? rows[0]!;
    await tabToObservationControl(
      page,
      first.getByLabel('Find source security description'),
    );
    await page.keyboard.insertText(selected.securityDescription);
    const matched = rows.filter((r) =>
      r.securityDescription
        .toLowerCase()
        .includes(selected.securityDescription.toLowerCase()),
    );
    await expect(first.locator('tbody tr')).toHaveCount(
      Math.min(matched.length, 25),
    );
    await expect(first.locator('tbody')).toContainText(
      selected.securityDescription,
    );
    const nullCount = matched
      .slice(0, 25)
      .flatMap((r) => r.metrics)
      .filter((v) => v === null).length;
    await expect(
      first
        .locator('tbody')
        .getByRole('cell', { name: 'Not reported', exact: true }),
    ).toHaveCount(nullCount);
    if (data.nextCursor) {
      await activateObservationControl(
        page,
        reader.getByRole('button', { name: 'Older liquidity history' }),
      );
      await expect(
        reader.getByRole('button', { name: 'Previous liquidity history' }),
      ).toBeEnabled();
      await activateObservationControl(
        page,
        reader.getByRole('button', { name: 'Previous liquidity history' }),
      );
    }
  }
  await expect(reader).toContainText('not executable prices');
  await expect(reader).toContainText('downloaded editions remain frozen');
  await captureObservationLayout(
    page,
    reader,
    testInfo,
    'installed-ccil-liquidity-360',
  );
  expect(network).toEqual([]);
});
