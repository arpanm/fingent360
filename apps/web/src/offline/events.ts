import { z } from 'zod';
import {
  EventLineagePublicSchema,
  eventSelectionsCurrent,
} from '@fingent360/contracts';
import {
  EventPublicSchema,
  EventListSchema,
  EventQuerySchema,
  EventHistorySchema,
  EventSnapshotHistorySchema,
  currentPublications,
  eventSourcesCurrent,
  SecurityDirectorySchema,
  SecurityHistorySchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleEvents: OfflineHandler = (request, _state, bundle) => {
  if (
    request.path === '/api/v1/ops/event-extractions' ||
    request.path.startsWith('/api/v1/ops/event-extractions/')
  )
    fail(503, 'Source-bound event preparation requires connected Operations.');
  if (
    request.path === '/api/v1/ops/event-lineage' ||
    request.path.startsWith('/api/v1/ops/event-lineage/')
  )
    fail(503, 'Event merge and split require connected independent review.');
  if (
    request.path === '/api/v1/ops/events' ||
    request.path.startsWith('/api/v1/ops/events/')
  )
    fail(
      503,
      'Event drafting and independent review require connected Operations.',
    );
  const base = '/api/v1/events';
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown event operation.');
  const records = z
    .array(EventPublicSchema)
    .max(1000)
    .parse(bundle.events ?? []);
  const current = currentPublications(bundle.feed, bundle.histories);
  const identities = SecurityDirectorySchema.parse(
    bundle.securities ?? { items: [], limited: false },
  ).items;
  const evaluatedAt = new Date(
    Math.max(
      Date.parse(bundle.generatedAt),
      ...records.map((record) => Date.parse(record.evaluatedAt)),
    ),
  ).toISOString();
  const safe = records.map((record) => {
    const event = record.event;
    const admitted =
      event &&
      eventSelectionsCurrent(event, bundle.identitySelections ?? {}) &&
      eventSourcesCurrent(event, current) &&
      event.identities.every((identity) => {
        const head = identities.find((row) => row.isin === identity.isin);
        const history = SecurityHistorySchema.safeParse(
          bundle.securityHistories?.[identity.isin],
        );
        const retained = history.success
          ? history.data.revisions.find(
              (row) => row.version === identity.version,
            )
          : null;
        return (
          head?.version === identity.version &&
          head.sourceHash === identity.sourceHash &&
          JSON.stringify(head.candidates) ===
            JSON.stringify(identity.candidates) &&
          (head.resolution === 'matched' ||
            event.editorial.links.some(
              (link) =>
                link.kind === 'instrument' &&
                link.isin === identity.isin &&
                link.selection,
            )) &&
          retained &&
          JSON.stringify(retained) === JSON.stringify(identity)
        );
      });
    return EventPublicSchema.parse(
      admitted
        ? record
        : {
            id: record.id,
            status: record.status === 'withdrawn' ? 'withdrawn' : 'unavailable',
            event: null,
            evaluatedAt: record.evaluatedAt,
            reviewedAt: record.reviewedAt,
          },
    );
  });
  if (request.path === base) {
    if (
      [...request.query.keys()].some(
        (key) => request.query.getAll(key).length !== 1,
      )
    )
      fail(400, 'Duplicate event filter.');
    const query = EventQuerySchema.parse(Object.fromEntries(request.query));
    const filtered = safe
      .filter(
        (row) =>
          (!query.after || row.id > query.after) &&
          (!query.family || row.event?.editorial.family === query.family) &&
          (!query.sector ||
            row.event?.editorial.links.some(
              (link) => link.kind === 'sector' && link.label === query.sector,
            )) &&
          (!query.isin ||
            row.event?.editorial.links.some(
              (link) => link.kind === 'instrument' && link.isin === query.isin,
            )),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      body: EventListSchema.parse({
        items: filtered.slice(0, 50),
        next: filtered.length > 50 ? filtered[49]!.id : null,
        evaluatedAt,
      }),
    };
  }
  const parts = request.path.slice(base.length + 1).split('/');
  const id = z.uuid().parse(parts[0]).toLowerCase(),
    record = safe.find((row) => row.id === id);
  if (!record) fail(404, 'Reviewed event is not in this installed snapshot.');
  if (parts.length === 1 && !request.query.size) return { body: record };
  if (parts.length === 2 && parts[1] === 'lineage' && !request.query.size) {
    const lineage = EventLineagePublicSchema.parse(
      bundle.eventLineage?.[id] ?? {
        eventId: id,
        relations: [],
        evaluatedAt: bundle.generatedAt,
      },
    );
    if (lineage.eventId !== id)
      fail(503, 'Installed lineage identity is invalid.');
    return {
      body: EventLineagePublicSchema.parse({
        ...lineage,
        relations: lineage.relations.map((relation) => ({
          ...relation,
          related: relation.related.map((related) => {
            const current = safe.find((item) => item.id === related.id);
            return {
              id: related.id,
              available: related.available && current?.status === 'published',
              title:
                related.available && current?.status === 'published'
                  ? (current.event?.editorial.title ?? null)
                  : null,
            };
          }),
        })),
      }),
    };
  }
  if (parts.length === 2 && parts[1] === 'history') {
    const query = z
      .strictObject({
        before: z.coerce.number().int().positive().max(2147483647).optional(),
      })
      .parse(Object.fromEntries(request.query));
    const history = EventSnapshotHistorySchema.parse(
      bundle.eventHistories?.[id] ?? { revisions: [], nextBefore: null },
    );
    const rows = history.revisions.filter(
      (row) => !query.before || row.version < query.before,
    );
    return {
      body: EventHistorySchema.parse({
        revisions: rows.slice(0, 50),
        nextBefore: rows.length > 50 ? rows[49]!.version : null,
      }),
    };
  }
  fail(404, 'Unknown event route.');
};
