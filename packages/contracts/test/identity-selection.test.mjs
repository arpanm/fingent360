import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  IdentitySelectionPlanSchema,
  IdentitySelectionOperationsSchema,
  IdentitySelectionPublicSchema,
  selectionMatchesProvider,
  eventSelectionsCurrent,
  buildEventRevision,
  EventRevisionSchema,
  currentPublications,
} from '../dist/index.js';
const at = '2026-09-14T00:00:00.000Z';
const candidates = ['BBG000000001', 'BBG000000002'].map((figi, index) => ({
  figi,
  name: 'Synthetic candidate ' + index,
  ticker: 'SYN' + index,
  exchCode: 'IN',
  securityType: 'Common Stock',
  marketSector: 'Equity',
  compositeFIGI: null,
  shareClassFIGI: null,
}));
const provider = {
  isin: 'INE002A01018',
  version: 1,
  resolution: 'ambiguous',
  candidates,
  retrievedAt: at,
  checkedAt: at,
  sourceHash: 'a'.repeat(64),
  source: 'OpenFIGI',
  sourceUrl: 'https://api.openfigi.com/v3/mapping',
  termsUrl: 'https://www.openfigi.com/docs/terms-of-service',
  mappingPolicy: 'india-common-stock-v1',
};
const id = randomUUID(),
  input = {
    isin: provider.isin,
    action: 'select',
    expectedVersion: 0,
    providerVersion: 1,
    providerHash: provider.sourceHash,
    figi: candidates[1].figi,
    rationale:
      'Synthetic editorial judgement without independent verification.',
  };
const plan = {
  id,
  fingerprint: 'b'.repeat(64),
  createdAt: at,
  input,
  provider,
  candidate: candidates[1],
};
const receipt = {
  id,
  version: 1,
  isin: provider.isin,
  providerVersion: 1,
  providerHash: provider.sourceHash,
  candidate: candidates[1],
  rationale: input.rationale,
  reviewedAt: at,
  method: 'editorial-judgement',
  status: 'approved',
};
test('selection binds actual retained membership and exact approved receipt without changing ambiguous provider truth', () => {
  assert.equal(IdentitySelectionPlanSchema.safeParse(plan).success, true);
  assert.equal(
    IdentitySelectionPlanSchema.safeParse({
      ...plan,
      candidate: { ...candidates[1], name: 'Invented label' },
    }).success,
    false,
  );
  assert.equal(
    IdentitySelectionOperationsSchema.safeParse({ plan, receipt }).success,
    true,
  );
  assert.equal(
    IdentitySelectionOperationsSchema.safeParse({
      plan,
      receipt: { ...receipt, id: randomUUID() },
    }).success,
    false,
  );
  assert.equal(selectionMatchesProvider(receipt, provider), true);
  assert.equal(
    selectionMatchesProvider(receipt, { ...provider, version: 2 }),
    false,
  );
  assert.equal(provider.resolution, 'ambiguous');
  assert.equal(
    IdentitySelectionPublicSchema.safeParse({
      isin: provider.isin,
      state: 'current',
      receipt: { ...receipt, status: 'withdrawn' },
      evaluatedAt: at,
    }).success,
    false,
  );
});
test('event reconstruction uses explicit chosen candidate and refuses forged selection provenance', async () => {
  const { readFile } = await import('node:fs/promises');
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const source = currentPublications(bundle.feed, bundle.histories).find(
    (item) =>
      item.status === 'published' && item.sourceHash && item.title.length >= 8,
  );
  assert.ok(source);
  const savedAt = new Date(
    Math.max(Date.now(), Date.parse(source.source.retrievedAt), Date.parse(at)),
  ).toISOString();
  const editorial = {
    title: 'Synthetic identity context',
    family: 'Policy',
    geography: ['India'],
    claimKind: 'inference',
    explanation: 'Synthetic context using an explicit reviewed judgement.',
    announcedAt: null,
    effectiveAt: null,
    citations: [
      {
        sourceId: source.id,
        version: source.version,
        hash: source.sourceHash,
        field: 'title',
        quote: source.title,
      },
    ],
    links: [
      {
        kind: 'instrument',
        isin: provider.isin,
        identityVersion: 1,
        selection: receipt,
        citation: 0,
        rationale: 'Synthetic explicit association.',
      },
    ],
  };
  const event = buildEventRevision(
    randomUUID(),
    1,
    savedAt,
    {
      requestId: randomUUID(),
      expectedVersion: 0,
      revisionReason: 'Synthetic golden',
      editorial,
    },
    [source],
    [provider],
    randomUUID,
  );
  assert.equal(event.graph.nodes[1].label, candidates[1].name);
  const forged = structuredClone(event);
  forged.editorial.links[0].selection.candidate.name = 'Invented label';
  assert.equal(EventRevisionSchema.safeParse(forged).success, false);
  assert.equal(
    eventSelectionsCurrent(event, {
      [provider.isin]: {
        isin: provider.isin,
        state: 'current',
        receipt,
        evaluatedAt: at,
      },
    }),
    true,
  );
  assert.equal(
    eventSelectionsCurrent(event, {
      [provider.isin]: {
        isin: provider.isin,
        state: 'withdrawn',
        receipt: { ...receipt, status: 'withdrawn' },
        evaluatedAt: at,
      },
    }),
    false,
  );
});
