import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { EventListSchema } from '../../../../packages/contracts/src/index';
import { handleEvents } from '../../../../apps/web/src/offline/events';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('E2E-OFFLINE-850 preparation explains connected requirement while installed reviewed events remain readable with zero API traffic @EVENT-EXTRACTION-001', async ({
  page,
}) => {
  const network: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/api/v1/')) network.push(path);
  });
  await page.goto('/#ops');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Operations need a connected server',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Source-bound event preparation requires connected Operations/,
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () => (await fetch('/api/v1/ops/event-extractions/options')).status,
    ),
  ).toBe(503);
  await page.goto('/#events');
  await expect(
    page.getByRole('region', { name: 'Reviewed events', exact: true }),
  ).toBeVisible();
  const before = EventListSchema.parse(
    await page.evaluate(async () => (await fetch('/api/v1/events')).json()),
  );
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const after = EventListSchema.parse(
    await page.evaluate(async () => (await fetch('/api/v1/events')).json()),
  );
  expect(after.items).toEqual(before.items);
  expect(network).toEqual([]);
});

test('E2E-OFFLINE-851 every extraction read and mutation refuses locally without changing account or bundled evidence @EVENT-EXTRACTION-001', async () => {
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
    data: { retained: 'Synthetic unrelated private-state sentinel' },
  };
  const before = structuredClone(state),
    evidence = JSON.stringify(bundle),
    id = randomUUID();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error('Offline extraction must not call a provider or API.');
  };
  try {
    for (const [method, path] of [
      ['GET', ''],
      ['GET', '/options'],
      ['GET', '/' + id],
      ['PUT', '/' + id],
      ['POST', '/' + id + '/decision'],
    ]) {
      await expect(
        async () =>
          await handleEvents(
            {
              method: method!,
              path: '/api/v1/ops/event-extractions' + path,
              query: new URLSearchParams(),
              headers: new Headers(),
              body: {},
            },
            state,
            bundle,
          ),
      ).rejects.toMatchObject({
        status: 503,
        message:
          'Source-bound event preparation requires connected Operations.',
      });
    }
    expect(calls).toBe(0);
    expect(state).toEqual(before);
    expect(JSON.stringify(bundle)).toBe(evidence);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
