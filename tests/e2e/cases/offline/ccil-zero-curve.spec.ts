import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  parseCcilZero,
  CCIL_ZERO_URL,
  parseCcilZeroPoints,
  CCIL_ZERO_RATES_URL,
} from '../../../../packages/contracts/src/index';
import {
  ccilZeroHtml,
  ccilZeroPointsHtml,
} from '../../helpers/ccil-zero-curve';
import { handleCcilZero } from '../../../../apps/web/src/offline/ccil-zero-curve';
import type {
  OfflineBundle,
  OfflineRequest,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1970 dated yield snapshot excludes withdrawn and disabled editions and refuses source writes @SRC-017 @TEST-SIMULATION', async () => {
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
    },
    request: OfflineRequest = {
      path: '/api/v1/bond-zero-curve',
      method: 'GET',
      query: new URLSearchParams(),
      headers: new Headers(),
      body: undefined,
    },
    at = new Date().toISOString(),
    edition = {
      id: randomUUID(),
      hash: 'a'.repeat(64),
      sourceUrl: CCIL_ZERO_URL,
      retrievedAt: at,
      data: parseCcilZero(ccilZeroHtml()),
      error: null,
      state: 'published',
      reviewedAt: at,
    };
  const snapshot = {
    ...bundle,
    bondZeroCurve: {
      enabled: true,
      capturedAt: at,
      editions: [edition, { ...edition, id: randomUUID(), state: 'withdrawn' }],
    },
  };
  expect((await handleCcilZero(request, state, snapshot))?.body).toEqual({
    enabled: true,
    editions: [edition],
    nextCursor: null,
  });
  expect(
    (
      await handleCcilZero(request, state, {
        ...snapshot,
        bondZeroCurve: { ...snapshot.bondZeroCurve, enabled: false },
      })
    )?.body,
  ).toEqual({ enabled: false, editions: [], nextCursor: null });
  await expect(
    handleCcilZero(
      {
        ...request,
        path: '/api/v1/ops/bond-zero-curve/import',
        method: 'POST',
      },
      state,
      snapshot,
    ),
  ).rejects.toMatchObject({ status: 503 });
});

test('E2E-OFFLINE-1971 dated yield snapshot excludes withdrawn and disabled editions and refuses source writes @SRC-017 @TEST-SIMULATION', async () => {
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
    },
    request: OfflineRequest = {
      path: '/api/v1/bond-zero-curve',
      method: 'GET',
      query: new URLSearchParams(),
      headers: new Headers(),
      body: undefined,
    },
    at = new Date().toISOString(),
    edition = {
      id: randomUUID(),
      hash: 'a'.repeat(64),
      sourceUrl: CCIL_ZERO_RATES_URL,
      retrievedAt: at,
      data: parseCcilZeroPoints(await ccilZeroPointsHtml()),
      error: null,
      state: 'published',
      reviewedAt: at,
    };
  const snapshot = {
    ...bundle,
    bondZeroCurve: {
      enabled: true,
      capturedAt: at,
      editions: [edition, { ...edition, id: randomUUID(), state: 'withdrawn' }],
    },
  };
  expect((await handleCcilZero(request, state, snapshot))?.body).toEqual({
    enabled: true,
    editions: [edition],
    nextCursor: null,
  });
  expect(
    (
      await handleCcilZero(request, state, {
        ...snapshot,
        bondZeroCurve: { ...snapshot.bondZeroCurve, enabled: false },
      })
    )?.body,
  ).toEqual({ enabled: false, editions: [], nextCursor: null });
  await expect(
    handleCcilZero(
      {
        ...request,
        path: '/api/v1/ops/bond-zero-curve/import',
        method: 'POST',
      },
      state,
      snapshot,
    ),
  ).rejects.toMatchObject({ status: 503 });
});

test('E2E-OFFLINE-1976 partial connected page cannot masquerade as complete curve bundle @SRC-017 @TEST-SIMULATION', async () => {
  const { CcilZeroSnapshotSchema } =
    await import('../../../../packages/contracts/src/index');
  const at = new Date().toISOString();
  expect(() =>
    CcilZeroSnapshotSchema.parse({
      capturedAt: at,
      enabled: true,
      editions: [],
      nextCursor: at + '|' + randomUUID(),
    }),
  ).toThrow();
});
