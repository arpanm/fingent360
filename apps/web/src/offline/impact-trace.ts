import { downloadedResearchPolicies } from './governance-policies';
import { z } from 'zod';
import {
  EquitySnapshotSchema,
  EventPublicSchema,
  EventListSchema,
  EventLineagePublicSchema,
  ImpactTraceChoicesSchema,
  ImpactTraceListSchema,
  ImpactTraceReceiptSchema,
  ImpactTraceInputSchema,
  buildImpactTrace,
  impactReviewReasons,
  type ImpactTraceReceipt,
} from '@fingent360/contracts';
import {
  fail,
  requireUser,
  type LocalState,
  type OfflineHandler,
} from './types';
import { localGoals, localHoldings, parseLocal } from './finance';
import { handleEvents } from './events';
type Entry = { fingerprint: string; value: ImpactTraceReceipt | null };
function records(state: LocalState, userId: string) {
  return (
    (
      (state.data.localImpactTraces ?? {}) as Record<
        string,
        Record<string, Entry>
      >
    )[userId] ?? {}
  );
}
export function exportLocalImpactTraces(state: LocalState, userId: string) {
  return {
    traces: Object.values(records(state, userId)).flatMap((entry) =>
      entry.value ? [ImpactTraceReceiptSchema.parse(entry.value)] : [],
    ),
  };
}
export const handleImpactTraces: OfflineHandler = async (
  request,
  state,
  bundle,
) => {
  const base = '/api/v1/account/impact-traces';
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  const user = requireUser(state),
    rows = records(state, user.id),
    now = new Date().toISOString();
  const holdings = localHoldings(state, user.id),
    goals = localGoals(state, user.id);
  const equityFor = (isin: string) =>
    EquitySnapshotSchema.parse(
      bundle.equityCoverage ?? {
        capturedAt: bundle.generatedAt,
        companies: [],
      },
    ).companies.find((item) => item.isin === isin) ?? null;
  const current = async (id: string) => {
    const lineage = EventLineagePublicSchema.safeParse(
      bundle.eventLineage?.[id],
    );
    if (
      lineage.success &&
      lineage.data.relations.some(
        (relation) => relation.direction === 'replaced-by',
      )
    )
      return null;
    if (
      !(bundle.events ?? []).some(
        (item) => EventPublicSchema.parse(item).id === id,
      )
    )
      return null;
    const response = await handleEvents(
      {
        ...request,
        method: 'GET',
        path: '/api/v1/events/' + id,
        query: new URLSearchParams(),
      },
      state,
      bundle,
    );
    return EventPublicSchema.parse(response?.body);
  };
  if (request.path === base + '/choices' && request.method === 'GET') {
    const response = await handleEvents(
      { ...request, path: '/api/v1/events' },
      state,
      bundle,
    );
    const events = EventListSchema.parse(response?.body);
    const admitted = [];
    for (const item of events.items) {
      const value = await current(item.id);
      if (value?.status === 'published') admitted.push(value);
    }
    return {
      body: ImpactTraceChoicesSchema.parse({
        contexts: await downloadedResearchPolicies(
          bundle,
          state,
          request,
          'causal-context',
        ),
        events: admitted,
        next: events.next,
        holdings,
        goals,
        bundleGeneratedAt: bundle.generatedAt,
      }),
    };
  }
  if (request.path === base && request.method === 'GET') {
    const traces = [];
    for (const receipt of exportLocalImpactTraces(state, user.id).traces)
      traces.push({
        receipt,
        reviewReasons: [
          ...(receipt.input.causalContext
            ? [
                'Downloaded causal context may have been withdrawn on the server since this snapshot.',
                ...((
                  await downloadedResearchPolicies(
                    bundle,
                    state,
                    request,
                    'causal-context',
                  )
                ).some(
                  (item) =>
                    item.id === receipt.input.causalContext!.id &&
                    item.version === receipt.input.causalContext!.version,
                )
                  ? []
                  : [
                      'Released causal context is expired or unavailable in this snapshot.',
                    ]),
              ]
            : []),
          ...impactReviewReasons(
            receipt,
            await current(receipt.input.eventId),
            holdings,
            goals,
            now,
            equityFor(receipt.input.isin),
          ),
        ],
      });
    return { body: ImpactTraceListSchema.parse({ traces }) };
  }
  const id = parseLocal(
    z.uuid(),
    request.path.slice(base.length + 1),
  ).toLowerCase();
  if (request.method === 'DELETE') {
    if (!rows[id]) fail(404, 'Trace not found.');
    rows[id] = { ...rows[id], value: null };
  } else if (request.method === 'PUT') {
    const input = parseLocal(ImpactTraceInputSchema, request.body);
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(input)),
    );
    const fingerprint = Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const old = rows[id];
    if (old) {
      if (old.fingerprint !== fingerprint)
        fail(409, 'Receipt ID belongs to different inputs.');
      if (!old.value) fail(410, 'Receipt deleted. Start a new trace.');
      return { body: old.value };
    }
    if (Object.values(rows).filter((entry) => entry.value).length >= 100)
      fail(409, 'Remove a trace before exceeding 100 receipts.');
    const admitted = await current(input.eventId);
    if (!admitted?.event)
      fail(
        409,
        'The event is unavailable or superseded in the installed snapshot.',
      );
    const context = input.causalContext
      ? (
          await downloadedResearchPolicies(
            bundle,
            state,
            request,
            'causal-context',
          )
        ).find(
          (item) =>
            item.id === input.causalContext!.id &&
            item.version === input.causalContext!.version,
        )
      : undefined;
    if (input.causalContext && !context)
      fail(
        409,
        'Released causal context is unavailable in the installed snapshot.',
      );
    let value;
    try {
      value = buildImpactTrace(
        id,
        input,
        admitted,
        holdings,
        goals,
        now,
        equityFor(input.isin),
        context,
      );
    } catch (error) {
      fail(409, error instanceof Error ? error.message : 'Trace changed.');
    }
    rows[id] = { fingerprint, value };
  } else fail(404, 'Unknown trace operation.');
  const all = (state.data.localImpactTraces ?? {}) as Record<
    string,
    Record<string, Entry>
  >;
  all[user.id] = rows;
  state.data.localImpactTraces = all;
  return {
    body: request.method === 'PUT' ? rows[id]!.value : { deleted: true },
  };
};
