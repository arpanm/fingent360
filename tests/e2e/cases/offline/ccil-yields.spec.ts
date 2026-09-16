import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  parseCcilYields,
  CCIL_YIELDS_URL,
} from '../../../../packages/contracts/src/index';
import { syntheticCcilHtml } from '../../helpers/ccil-yields';
import { handleCcilYields } from '../../../../apps/web/src/offline/ccil-yields';
import type {
  OfflineBundle,
  OfflineRequest,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1570 dated yield snapshot excludes withdrawn and disabled editions and refuses source writes @SRC-017 @TEST-SIMULATION', async () => {
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
      path: '/api/v1/bond-yields',
      method: 'GET',
      query: new URLSearchParams(),
      headers: new Headers(),
      body: undefined,
    },
    at = new Date().toISOString(),
    edition = {
      id: randomUUID(),
      hash: 'a'.repeat(64),
      sourceUrl: CCIL_YIELDS_URL,
      retrievedAt: at,
      data: parseCcilYields(syntheticCcilHtml()),
      error: null,
      state: 'published',
      reviewedAt: at,
    };
  const snapshot = {
    ...bundle,
    bondYields: {
      enabled: true,
      capturedAt: at,
      editions: [edition, { ...edition, id: randomUUID(), state: 'withdrawn' }],
    },
  };
  expect((await handleCcilYields(request, state, snapshot))?.body).toEqual({
    enabled: true,
    editions: [edition],
  });
  expect(
    (
      await handleCcilYields(request, state, {
        ...snapshot,
        bondYields: { ...snapshot.bondYields, enabled: false },
      })
    )?.body,
  ).toEqual({ enabled: false, editions: [] });
  await expect(
    handleCcilYields(
      { ...request, path: '/api/v1/ops/bond-yields/import', method: 'POST' },
      state,
      snapshot,
    ),
  ).rejects.toMatchObject({ status: 503 });
});
