import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { beaBrowserCall as call } from '../../helpers/bea-fixture';
import {
  actualBundledConnectionSource,
  prepareConnectionBrowser,
  connectionPassword,
} from '../../helpers/research-connection-fixture';
import {
  EvidenceExplanationSchema,
  ResearchConnectionsSchema,
  PrivacyExportSchema,
  FeedItemSchema,
} from '../../../../packages/contracts/src/index';
import type {
  OfflineBundle,
  OfflineRequest,
  LocalState,
} from '../../../../apps/web/src/offline/types';

test('E2E-OFFLINE-620 dated explanation and owned notes survive reload export deletion with zero API traffic @EVIDENCE-LAYERS-001', async ({
  page,
}) => {
  const source = await actualBundledConnectionSource();
  const outgoing: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      outgoing.push(request.url());
  });
  await page.goto(`/#read/${source.id}`);
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const value = EvidenceExplanationSchema.parse(
    (
      await call(
        page,
        `/api/v1/discovery/items/${source.id}/explanation?expectedVersion=${source.version}`,
      )
    ).body,
  );
  expect(value.edition).toEqual(source);
  expect(value.bundleGeneratedAt).not.toBeNull();
  await prepareConnectionBrowser(page);
  const connections = ResearchConnectionsSchema.parse(
    (
      await call(
        page,
        `/api/v1/account/research-connections?itemId=${source.id}`,
      )
    ).body,
  );
  const original = (await call(page, '/api/v1/account/holdings')).body;
  const note = 'My on-device evidence question; no impact is established.';
  expect(
    (
      await call(
        page,
        `/api/v1/account/research-connections/${randomUUID()}`,
        'PUT',
        {
          action: 'create',
          requestId: randomUUID(),
          expectedVersion: 0,
          source: {
            itemId: source.id,
            version: source.version,
            sourceHash: source.sourceHash,
          },
          target: connections.targets.find((v) => v.binding.kind === 'goal')!
            .binding,
          note,
          storageConsent: true,
        },
      )
    ).status,
  ).toBe(200);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  const region = page.getByRole('region', { name: 'Explanation layers' });
  await region
    .getByText('Portfolio — your own research connections', { exact: true })
    .click();
  await expect(region).toContainText(note);
  await region
    .getByText('Sources — trace every excerpt', { exact: true })
    .click();
  await expect(region).toContainText(value.bundleGeneratedAt!);
  expect((await call(page, '/api/v1/account/holdings')).body).toEqual(original);
  const exported = PrivacyExportSchema.parse(
    (await call(page, '/api/v1/account/privacy/export')).body,
  );
  expect(JSON.stringify(exported)).toContain(note);
  expect(
    (
      await call(page, '/api/v1/account', 'DELETE', {
        password: connectionPassword,
      })
    ).status,
  ).toBe(200);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  await region
    .getByText('Portfolio — your own research connections', { exact: true })
    .click();
  await expect(
    region.getByRole('link', { name: 'Sign in to view your connections' }),
  ).toBeVisible();
  await expect(region).not.toContainText(note);
  expect(outgoing).toEqual([]);
});

test('E2E-OFFLINE-621 actual handler chooses highest reviewed bundle edition and rejects stale withdrawn duplicate query without mutation @EVIDENCE-LAYERS-001 @TEST-SIMULATION', async () => {
  const source = await actualBundledConnectionSource();
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
  const req = (version: number): OfflineRequest => ({
    path: `/api/v1/discovery/items/${source.id}/explanation`,
    method: 'GET',
    query: new URLSearchParams({ expectedVersion: String(version) }),
    headers: new Headers(),
    body: undefined,
  });
  const revised = FeedItemSchema.parse({
    ...source,
    version: source.version + 1,
    title: 'Synthetic revised edition title',
  });
  const draft = FeedItemSchema.parse({
    ...revised,
    version: revised.version + 1,
    status: 'draft',
  });
  const simulated: OfflineBundle = {
    ...bundle,
    feed: [source],
    histories: { [source.id]: [draft, revised, source] },
  };
  const before = JSON.stringify({ simulated, state });
  const { handleContent } =
    await import('../../../../apps/web/src/offline/content');
  const value = EvidenceExplanationSchema.parse(
    (await handleContent(req(revised.version), state, simulated))?.body,
  );
  expect(value.edition).toEqual(revised);
  expect(value.previous?.changedFields).toEqual(['title']);
  await expect(
    handleContent(req(source.version), state, simulated),
  ).rejects.toMatchObject({ status: 409 });
  const duplicate = req(revised.version);
  duplicate.query.append('expectedVersion', String(source.version));
  await expect(
    handleContent(duplicate, state, simulated),
  ).rejects.toMatchObject({ status: 400 });
  const withdrawn = FeedItemSchema.parse({
    ...revised,
    version: draft.version + 1,
    status: 'withdrawn',
  });
  await expect(
    handleContent(req(revised.version), state, {
      ...simulated,
      histories: { [source.id]: [withdrawn, draft, revised, source] },
    }),
  ).rejects.toMatchObject({ status: 404 });
  expect(JSON.stringify({ simulated, state })).toBe(before);
});
