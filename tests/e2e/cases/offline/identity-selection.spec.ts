import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  buildEventRevision,
  currentPublications,
  IdentitySelectionPublicSchema,
} from '../../../../packages/contracts/src/index';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-870 explicit editorial selection survives local reads and withdrawal suppresses event without network @IDENTITY-ADJUDICATION-001', async () => {
  const { handleSecurities } =
    await import('../../../../apps/web/src/offline/securities');
  const { handleEvents } =
    await import('../../../../apps/web/src/offline/events');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const source = currentPublications(bundle.feed, bundle.histories).find(
    (row) =>
      row.status === 'published' && row.sourceHash && row.title.length >= 8,
  )!;
  expect(source).toBeTruthy();
  const at = new Date().toISOString(),
    isin = 'INE002A01018';
  const candidates = ['BBG000000001', 'BBG000000002'].map((figi, index) => ({
    figi,
    name: 'Synthetic local choice ' + index,
    ticker: 'SYN' + index,
    exchCode: 'IN' as const,
    securityType: 'Common Stock' as const,
    marketSector: 'Equity' as const,
    compositeFIGI: null,
    shareClassFIGI: null,
  }));
  const provider = {
    isin,
    version: 1,
    resolution: 'ambiguous' as const,
    candidates,
    retrievedAt: at,
    checkedAt: at,
    sourceHash: 'a'.repeat(64),
    source: 'OpenFIGI' as const,
    sourceUrl: 'https://api.openfigi.com/v3/mapping' as const,
    termsUrl: 'https://www.openfigi.com/docs/terms-of-service' as const,
    mappingPolicy: 'india-common-stock-v1' as const,
  };
  const receipt = {
    id: randomUUID(),
    version: 1,
    isin,
    providerVersion: 1,
    providerHash: provider.sourceHash,
    candidate: candidates[1]!,
    rationale: 'Synthetic local editorial judgement, not verified.',
    reviewedAt: at,
    method: 'editorial-judgement' as const,
    status: 'approved' as const,
  };
  bundle.securities = { items: [provider], limited: false };
  bundle.securityHistories = { [isin]: { revisions: [provider] } };
  bundle.identitySelections = {
    [isin]: { isin, state: 'current', receipt, evaluatedAt: at },
  };
  bundle.identitySelectionHistories = { [isin]: [receipt] };
  const event = buildEventRevision(
    randomUUID(),
    1,
    at,
    {
      requestId: randomUUID(),
      expectedVersion: 0,
      revisionReason: 'Synthetic local selection',
      editorial: {
        title: 'Synthetic selected context',
        family: 'Policy',
        geography: ['India'],
        claimKind: 'inference',
        explanation: 'Synthetic explicit source and identity context.',
        announcedAt: null,
        effectiveAt: null,
        citations: [
          {
            sourceId: source.id,
            version: source.version,
            hash: source.sourceHash!,
            field: 'title',
            quote: source.title,
          },
        ],
        links: [
          {
            kind: 'instrument',
            isin,
            identityVersion: 1,
            selection: receipt,
            citation: 0,
            rationale: 'Synthetic contextual association.',
          },
        ],
      },
    },
    [source],
    [provider],
    randomUUID,
  );
  event.graph.events[0]!.publicationState = 'published';
  for (const edge of event.graph.edges) edge.reviewState = 'reviewed';
  bundle.events = [
    {
      id: event.id,
      status: 'published',
      event,
      evaluatedAt: at,
      reviewedAt: at,
    },
  ];
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: { preserved: 'Synthetic owned sentinel' },
  };
  const before = structuredClone(state),
    originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('Offline selection cannot use network');
  };
  const request = (path: string) => ({
    method: 'GET',
    path,
    query: new URLSearchParams(),
    body: undefined,
    headers: new Headers(),
  });
  try {
    expect(
      IdentitySelectionPublicSchema.parse(
        (await handleSecurities(
          request('/api/v1/securities/' + isin + '/selection'),
          state,
          bundle,
        ))!.body,
      ).state,
    ).toBe('current');
    expect(
      (await handleEvents(
        request('/api/v1/events/' + event.id),
        state,
        bundle,
      ))!.body,
    ).toMatchObject({ status: 'published' });
    bundle.identitySelections[isin] = {
      isin,
      state: 'withdrawn',
      receipt: { ...receipt, version: 2, status: 'withdrawn' },
      evaluatedAt: at,
    };
    expect(
      (await handleEvents(
        request('/api/v1/events/' + event.id),
        state,
        bundle,
      ))!.body,
    ).toMatchObject({ status: 'unavailable', event: null });
    expect(provider.resolution).toBe('ambiguous');
    expect(state).toEqual(before);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('E2E-OFFLINE-871 device security page and unsupported operator selection stay off the network @IDENTITY-ADJUDICATION-001', async ({
  page,
}) => {
  const traffic: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      traffic.push(request.url());
  });
  await page.goto('/#securities');
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(
    await page.evaluate(
      async () => (await fetch('/api/v1/ops/identity-selections')).status,
    ),
  ).toBe(503);
  await page.reload();
  await expect(page.getByLabel('On-device mode')).toBeVisible();
  expect(traffic).toEqual([]);
});
