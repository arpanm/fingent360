import { randomUUID } from 'node:crypto';
import { historicalFlowInput } from '../../helpers/institutional-flows';
import { test, expect } from '@playwright/test';
import { flowInput } from '../../helpers/institutional-flows';
import {
  buildEventRevision,
  EventPublicSchema,
  EventScenarioInputSchema,
  extractInstitutionalFlowDraft,
  calculateEventScenario,
  FeedItemSchema,
  institutionalFlowLines,
  parseInstitutionalFlows,
  InstitutionalFlowPublicSchema,
} from '../../../../packages/contracts/src/index';
import { handleInstitutionalFlows } from '../../../../apps/web/src/offline/institutional-flows';
test('E2E-OFFLINE-1432 reviewed institutional snapshot preserves dates and rejects drafts scope tampering and operator writes @SRC-010 @TEST-SIMULATION', async () => {
  const now = '2026-09-15T00:00:00.000Z',
    edition = {
      ...parseInstitutionalFlows(
        await flowInput('cdsl-daily-html'),
        'a'.repeat(64),
        now,
        'b'.repeat(64),
      ),
      reviewedAt: now,
    },
    snapshot = { editions: [edition], capturedAt: now },
    state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    bundle = {
      generatedAt: now,
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
      institutionalFlows: snapshot,
    },
    request = {
      path: '/api/v1/institutional-flows',
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  expect(
    (await handleInstitutionalFlows(request, state, bundle))?.body,
  ).toEqual(snapshot);
  expect(
    InstitutionalFlowPublicSchema.safeParse({
      ...snapshot,
      editions: [{ ...edition, reviewedAt: null }],
    }).success,
  ).toBe(false);
  const changed = structuredClone(snapshot);
  const cash = changed.editions[0]!.datasets[0]!;
  if (cash.kind !== 'cdsl-investment') throw Error('Expected investment.');
  cash.rows[0]!.net = '999.00';
  expect(InstitutionalFlowPublicSchema.safeParse(changed).success).toBe(false);
  expect(
    InstitutionalFlowPublicSchema.safeParse({
      ...snapshot,
      editions: [{ ...edition, source: 'nse-cash-html' }],
    }).success,
  ).toBe(false);
  expect(() =>
    handleInstitutionalFlows(
      {
        ...request,
        path: '/api/v1/ops/institutional-flows/capture',
        method: 'POST',
      },
      state,
      bundle,
    ),
  ).toThrow('connected API');
});

test('E2E-OFFLINE-1433 historical combined cash golden retains exact date participant and no fabricated causal delta @SRC-010 @EVENT-SCENARIOS-001 @TEST-SIMULATION', async () => {
  const input = historicalFlowInput(),
    now = '2026-09-15T00:00:00.000Z',
    edition = parseInstitutionalFlows(
      input,
      'a'.repeat(64),
      now,
      'b'.repeat(64),
    ),
    quote = institutionalFlowLines(edition).find(
      (line) =>
        line.startsWith('NSE-BSE-MSEI |') && line.includes('| FII/FPI |'),
    )!,
    source = FeedItemSchema.parse({
      id: 'institutional-flow-' + input.requestId,
      version: 1,
      kind: 'news',
      title: 'Reconstructed historical numerical flow fixture',
      summary:
        'Actual dated numerical facts in reconstructed markup; not original bytes.',
      body: quote,
      topics: [],
      publishedAt: now,
      effectiveLabel: 'Provisional trade date 2026-09-11',
      source: {
        name: 'NSE',
        url: edition.sourceUrl,
        retrievedAt: now,
        rights: 'TEST-SIMULATION reconstructed numerical facts.',
      },
      sourceHash: 'c'.repeat(64),
      importance: 1,
      relatedIds: [],
      status: 'published',
      reviewedAt: now,
      correctionNote: null,
    }),
    id = randomUUID(),
    event = buildEventRevision(
      id,
      1,
      now,
      {
        requestId: randomUUID(),
        expectedVersion: 0,
        revisionReason:
          'Historical numerical fixture with exact scope and date.',
        editorial: {
          title: 'Combined provisional FII/FPI activity',
          family: 'flows',
          geography: ['India'],
          claimKind: 'fact',
          explanation: 'No NSE-only amount is added to combined cash activity.',
          announcedAt: null,
          effectiveAt: null,
          citations: [
            {
              sourceId: source.id,
              version: 1,
              hash: source.sourceHash!,
              field: 'body',
              quote,
            },
          ],
          links: [],
        },
      },
      [source],
      [],
      randomUUID,
    );
  event.graph.events[0]!.publicationState = 'published';
  const publicEvent = EventPublicSchema.parse({
      id,
      status: 'published',
      event,
      reviewedAt: now,
      evaluatedAt: now,
    }),
    draft = extractInstitutionalFlowDraft(publicEvent),
    scenario = EventScenarioInputSchema.parse({
      requestId: randomUUID(),
      expectedVersion: 0,
      eventId: id,
      eventVersion: 1,
      revisionReason: 'Exact source-bound numerical flow golden.',
      model: draft.model,
    });
  expect(scenario.model).toMatchObject({
    participant: 'FII/FPI',
    observed: {
      value: '-930.90',
      period: 'NSE-BSE-MSEI | provisional trade date 2026-09-11',
    },
  });
  expect(calculateEventScenario(scenario, publicEvent, now)).toMatchObject({
    comparison: 'no-reference',
    delta: null,
  });
  const model = scenario.model;
  if (model.family !== 'flows') throw Error('Expected flows.');
  expect(() =>
    calculateEventScenario(
      { ...scenario, model: { ...model, segment: 'equity-total' } },
      publicEvent,
      now,
    ),
  ).toThrow('exact reviewed source scope');
});
