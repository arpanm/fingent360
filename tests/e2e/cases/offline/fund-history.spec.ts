import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { handleFundsBonds } from '../../../../apps/web/src/offline/funds-bonds';
import {
  AMFI_LEGACY_NAV_URL,
  FundDetailSchema,
  parseAmfiNav,
} from '../../../../packages/contracts/src/index';

test('E2E-OFFLINE-1460 downloaded NAV explicitly reports insufficient history without assuming continuity @SRC-015 @TEST-SIMULATION', async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        '../../../../packages/contracts/test/fixtures/funds-bonds.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { navText: string };
  const observation = parseAmfiNav(fixture.navText)[0]!;
  const edition = {
    id: '10000000-0000-4000-8000-000000000001',
    sourceUrl: AMFI_LEGACY_NAV_URL,
    hash: 'a'.repeat(64),
    retrievedAt: '2025-02-01T00:00:00.000Z',
    count: 2,
    parser: 'amfi-navall-v1',
  };
  const bundle = {
    generatedAt: edition.retrievedAt,
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
    fundsBonds: {
      capturedAt: edition.retrievedAt,
      funds: [{ observation, edition }],
      totalSchemeCount: 1,
      truncated: false,
    },
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const response = await handleFundsBonds(
    {
      path: '/api/v1/funds/108001',
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    },
    state,
    bundle,
  );
  const detail = FundDetailSchema.parse(response?.body);
  expect(detail.reconciliation.status).toBe('insufficient-history');
  expect(detail.reconciliation.distinctDates).toBe(1);
  expect(detail.reconciliation.limitations).toContain(
    'Only the downloaded or bounded history is included.',
  );
});
