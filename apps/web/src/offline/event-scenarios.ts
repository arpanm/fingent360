import { z } from 'zod';
import {
  EventScenarioSnapshotSchema,
  EventScenarioPublicSchema,
  EventScenarioListSchema,
  EventScenarioHistorySchema,
  EventPublicSchema,
  EventLineagePublicSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
import { handleEvents } from './events';
export const handleEventScenarios: OfflineHandler = async (
  request,
  state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/research-governance' ||
    request.path.startsWith('/api/v1/ops/research-governance/') ||
    request.path === '/api/v1/ops/event-scenarios' ||
    request.path.startsWith('/api/v1/ops/event-scenarios/')
  )
    fail(
      503,
      'Scenario preparation and independent review require connected Operations.',
    );
  const base = '/api/v1/event-scenarios';
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown scenario operation.');
  const snapshot = EventScenarioSnapshotSchema.parse(
    (bundle as typeof bundle & { eventScenarios?: unknown }).eventScenarios ?? {
      capturedAt: bundle.generatedAt,
      items: [],
      histories: {},
    },
  );
  const admit = async (item: z.infer<typeof EventScenarioPublicSchema>) => {
    const receipt = item.receipt;
    if (!receipt) return item;
    const lineage = EventLineagePublicSchema.safeParse(
      bundle.eventLineage?.[receipt.input.eventId],
    );
    let current = null;
    if (
      !(
        lineage.success &&
        lineage.data.relations.some(
          (relation) => relation.direction === 'replaced-by',
        )
      ) &&
      (bundle.events ?? []).some(
        (event) => EventPublicSchema.parse(event).id === receipt.input.eventId,
      )
    ) {
      const result = await handleEvents(
        {
          ...request,
          path: '/api/v1/events/' + receipt.input.eventId,
          query: new URLSearchParams(),
        },
        state,
        bundle,
      );
      current = EventPublicSchema.parse(result?.body);
    }
    if (
      !current?.event ||
      current.event.version !== receipt.input.eventVersion ||
      JSON.stringify(current.event) !== JSON.stringify(receipt.event.event)
    )
      return EventScenarioPublicSchema.parse({
        ...item,
        state: 'unavailable',
        receipt: null,
      });
    return EventScenarioPublicSchema.parse({
      ...item,
      reviewReasons: receipt.event.event!.sources.some(
        (source) => Date.now() - Date.parse(source.publishedAt) > 30 * 86400000,
      )
        ? ['Historical evidence beyond the 30-day context window.']
        : [],
    });
  };
  if (request.path === base) {
    const query = z
      .strictObject({
        after: z.uuid().optional(),
        eventId: z.uuid().optional(),
      })
      .parse(Object.fromEntries(request.query));
    const rows = snapshot.items
      .filter(
        (item) =>
          (!query.after || item.id > query.after) &&
          (!query.eventId || item.receipt?.input.eventId === query.eventId),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const items = [];
    for (const row of rows.slice(0, 50)) items.push(await admit(row));
    return {
      body: EventScenarioListSchema.parse({
        items,
        next: rows.length > 50 ? rows[49]!.id : null,
      }),
    };
  }
  const parts = request.path.slice(base.length + 1).split('/'),
    id = z.uuid().parse(parts[0]);
  const item = snapshot.items.find((row) => row.id === id);
  if (!item) fail(404, 'Scenario not in this installed snapshot.');
  if (parts.length === 1) return { body: await admit(item) };
  if (parts.length === 2 && parts[1] === 'history') {
    const before = request.query.get('before'),
      history = EventScenarioHistorySchema.parse(
        snapshot.histories[id] ?? { versions: [], nextBefore: null },
      );
    if (before !== null && !/^[1-9][0-9]*$/.test(before))
      fail(400, 'Invalid history cursor.');
    if (before && history.nextBefore && Number(before) <= history.nextBefore)
      fail(
        503,
        'Older history is outside this installed snapshot. Rebuild with the required evidence.',
      );
    return {
      body: EventScenarioHistorySchema.parse({
        ...history,
        versions: history.versions.filter(
          (row) => !before || row.version < Number(before),
        ),
      }),
    };
  }
  fail(404, 'Unknown scenario operation.');
};
