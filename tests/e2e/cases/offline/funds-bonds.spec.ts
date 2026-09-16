import { test, expect } from '@playwright/test';
import { FundsSnapshotSchema } from '../../../../packages/contracts/src/index';
import { fundFixture } from '../../helpers/funds-bonds';
test('E2E-OFFLINE-1080 packaged NAV uses dated bounded coverage without API network @FUNDS-BONDS-001', async ({
  page,
}) => {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      calls.push(request.url());
  });
  await page.goto('/#funds-bonds');
  await expect(
    page.getByRole('region', { name: 'Funds and bonds' }),
  ).toBeVisible();
  const data = FundsSnapshotSchema.parse(
    await page.evaluate(
      async () => await (await fetch('/api/v1/funds/snapshot')).json(),
    ),
  );
  expect(data.funds.length).toBeLessThanOrEqual(5000);
  expect(calls).toEqual([]);
});
test('E2E-OFFLINE-1081 device comparison survives reload and deletion prevents replay @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  page,
}) => {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      calls.push(request.url());
  });
  await page.goto('/#funds-bonds');
  const { comparison } = await fundFixture();
  const saved = await page.evaluate(async (input) => {
    const send = (path: string, body: unknown, method = 'POST') =>
      fetch('/api/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const registered = await send('/account/register', {
      username: 'offline_fund_' + crypto.randomUUID().slice(0, 8),
      password: 'Synthetic-offline-funds-2026',
      consent: true,
    });
    if (!registered.ok) throw Error('Local account registration failed.');
    const id = crypto.randomUUID(),
      response = await send('/account/bond-comparisons/' + id, input, 'PUT');
    return { id, status: response.status, value: await response.json() };
  }, comparison);
  expect(saved.status).toBe(200);
  expect(saved.value.result.totalOutlayPaise).toBe('105072');
  await page.reload();
  const outcome = await page.evaluate(
    async ({ id, input }) => {
      const before = await (
        await fetch('/api/v1/account/bond-comparisons')
      ).json();
      await fetch('/api/v1/account/bond-comparisons/' + id, {
        method: 'DELETE',
      });
      const replay = await fetch('/api/v1/account/bond-comparisons/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return {
        ids: before.comparisons.map((r: { id: string }) => r.id),
        status: replay.status,
      };
    },
    { id: saved.id, input: comparison },
  );
  expect(outcome.ids).toContain(saved.id);
  expect(outcome.status).toBe(410);
  expect(calls).toEqual([]);
});

test('E2E-OFFLINE-1084 current NAV plan/option survives snapshot and local search @FUNDS-BONDS-001 @TEST-SIMULATION', async () => {
  const { handleFundsBonds } =
    await import('../../../../apps/web/src/offline/funds-bonds');
  const { parseAmfiNav } =
    await import('../../../../packages/contracts/src/index');
  const { readFile } = await import('node:fs/promises');
  const body = await readFile(
    new URL(
      '../../../../packages/contracts/test/fixtures/amfi-nav-v2.txt',
      import.meta.url,
    ),
    'utf8',
  );
  const observations = parseAmfiNav(body);
  const snapshot = FundsSnapshotSchema.parse({
    capturedAt: '2025-01-31T12:00:00.000Z',
    totalSchemeCount: 3,
    truncated: false,
    funds: observations.map((observation) => ({
      observation,
      edition: {
        id: '10000000-0000-4000-8000-000000000001',
        sourceUrl: 'https://portal.amfiindia.com/spages/NAVAll.txt',
        hash: 'a'.repeat(64),
        retrievedAt: '2025-01-31T12:00:00.000Z',
        count: 3,
        parser: 'amfi-navall-v2',
      },
    })),
  });
  const bundle = {
    generatedAt: snapshot.capturedAt,
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
    fundsBonds: snapshot,
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const result = await handleFundsBonds(
    {
      path: '/api/v1/funds',
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams({ q: 'Direct Plan' }),
    },
    state,
    bundle,
  );
  expect(result?.body).toMatchObject({
    funds: [
      {
        observation: {
          schemeCode: '900001',
          plan: 'Direct Plan',
          option: 'Growth Option',
          nav: '123.4500',
        },
      },
    ],
  });
});
