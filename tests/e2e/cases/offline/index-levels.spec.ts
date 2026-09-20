import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  IndexLevelPublicSchema,
  parseIndexLevels,
} from '../../../../packages/contracts/src/index';
import { handleIndexLevels } from '../../../../apps/web/src/offline/index-levels';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
import { indexLevelInput } from '../../helpers/index-levels';

test('E2E-OFFLINE-1950 installed index snapshots preserve exact history provenance and bounded pagination without mutations @INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001 @TEST-SIMULATION', async () => {
  const now = new Date().toISOString();
  const editions = Array.from({ length: 21 }, (_, offset) => {
    const input = indexLevelInput(
      `2026-08-${String(21 - offset).padStart(2, '0')}`,
    );
    return {
      ...parseIndexLevels(
        input,
        createHash('sha256').update(input.csv).digest('hex'),
        now,
      ),
      reviewedAt: now,
    };
  });
  const bundle: OfflineBundle = {
    generatedAt: now,
    feed: [],
    histories: {},
    evidence: {},
    macro: null,
    macroHistory: {},
    macroEvidence: {},
    sources: [],
    learningCatalog: null,
    journeyCatalog: null,
    media: {},
    indexLevels: { editions, capturedAt: now, nextBefore: null },
  };
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const before = JSON.stringify(state);
  const call = async (path = '/api/v1/index-levels', query = '') =>
    handleIndexLevels(
      {
        method: 'GET',
        path,
        query: new URLSearchParams(query),
        body: null,
        headers: new Headers(),
      },
      state,
      bundle,
    );
  const first = IndexLevelPublicSchema.parse((await call())?.body);
  expect(first.editions).toEqual(editions.slice(0, 20));
  expect(first.nextBefore).toBe('2026-08-02');
  expect(
    IndexLevelPublicSchema.parse(
      (await call('/api/v1/index-levels', 'before=' + first.nextBefore))?.body,
    ).editions,
  ).toEqual(editions.slice(20));
  await expect(call('/api/v1/ops/index-levels')).rejects.toMatchObject({
    status: 503,
  });
  await expect(
    call('/api/v1/index-levels/snapshot', 'before=2026-08-10'),
  ).rejects.toMatchObject({ status: 400 });
  bundle.indexLevels = { editions, capturedAt: now, nextBefore: '2026-08-01' };
  await expect(call()).rejects.toMatchObject({ status: 503 });
  bundle.indexLevels = undefined;
  await expect(call()).rejects.toMatchObject({ status: 503 });
  expect(JSON.stringify(state)).toBe(before);
});

test('E2E-OFFLINE-1951 installed Sources navigation handles available or absent index snapshots without API network @INDEX-LEVELS-001 @SRC-006 @EQUITY-COVERAGE-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      network.push(request.url());
  });
  await page.goto('/#sources');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await page
    .getByRole('link', { name: 'Daily price-index history', exact: true })
    .click();
  const view = page.getByRole('main', { name: 'Daily index history' });
  await expect(view).toBeVisible();
  const response = await page.evaluate(async () => {
    const value = await fetch('/api/v1/index-levels');
    return { status: value.status, body: await value.json() };
  });
  if (response.status === 503) {
    await expect(view.getByRole('alert')).toContainText(
      'Index history is not installed.',
    );
  } else {
    expect(response.status).toBe(200);
    const data = IndexLevelPublicSchema.parse(response.body);
    if (data.editions.length)
      await expect(view).toContainText(data.editions[0]!.effectiveOn);
    else
      await expect(view).toContainText(
        'No permitted and independently reviewed index snapshots are available.',
      );
  }
  await view
    .getByRole('button', { name: 'Refresh index history', exact: true })
    .click();
  await expect(
    view.getByRole('button', { name: 'Refresh index history', exact: true }),
  ).toBeEnabled();
  expect(network).toEqual([]);
});
