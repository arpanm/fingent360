import { test, expect } from '@playwright/test';
import { handleFilingDiscovery } from '../../../../apps/web/src/offline/filing-discovery';
test('E2E-OFFLINE-2000 RSS discovery never becomes fabricated offline company facts or queued source writes @SRC-004', () => {
  const at = '2026-09-15T00:00:00.000Z',
    bundle = {
      generatedAt: at,
      feed: [],
      histories: {},
      evidence: {},
      macro: null,
      macroHistory: {},
      macroEvidence: {},
      sources: null,
      learningCatalog: null,
      journeyCatalog: null,
      media: {},
    },
    state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    before = JSON.stringify(state);
  for (const path of [
    '/api/v1/ops/filing-discovery',
    '/api/v1/ops/filing-discovery/capture',
    '/api/v1/ops/filing-discovery/fetch',
    '/api/v1/ops/filing-discovery/gate',
  ])
    expect(() =>
      handleFilingDiscovery(
        {
          path,
          method: 'POST',
          body: undefined,
          headers: new Headers(),
          query: new URLSearchParams(),
        },
        state,
        bundle,
      ),
    ).toThrow('connected Operations');
  expect(JSON.stringify(state)).toBe(before);
});
