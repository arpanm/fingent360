import {
  ReadingFollowConfigSchema,
  ReadingFollowItemSchema,
  ReadingFollowWriteSchema,
  ReadingFollowCheckSchema,
  ReadingFollowAckSchema,
  ReadingFollowReceiptSchema,
  ReadingFollowViewSchema,
  readingFollowPublications,
  ReadingFollowExportSchema,
  ReadingFollowPageSchema,
  ReadingFollowExportQuerySchema,
  ReadingFollowEventSchema,
  ResearchCatalogSchema,
  emptyReadingFollow,
  evaluateReadingFollow,
  readingFollowAckReceipt,
  sourceIdFor,
  currentPublications,
  type ReadingFollowConfig,
  type ReadingFollowItem,
  type ReadingFollowEvent,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type OfflineHandler,
  type LocalState,
} from './types';
import { parseLocal } from './finance';
type State = {
  config: ReadingFollowConfig;
  items: Record<string, ReadingFollowItem>;
  events: ReadingFollowEvent[];
};
function stateFor(state: LocalState, id: string): State {
  const raw = (
    state.data.localReadingFollow as Record<string, State> | undefined
  )?.[id];
  return raw
    ? {
        config: ReadingFollowConfigSchema.parse(raw.config),
        items: Object.fromEntries(
          Object.entries(raw.items).map(([key, value]) => [
            key,
            ReadingFollowItemSchema.parse(value),
          ]),
        ),
        events: raw.events.map((e) => ReadingFollowEventSchema.parse(e)),
      }
    : { config: emptyReadingFollow(), items: {}, events: [] };
}
function write(state: LocalState, id: string, value: State) {
  state.data.localReadingFollow = {
    ...(state.data.localReadingFollow as Record<string, State> | undefined),
    [id]: value,
  };
}
function append(state: State, record: ReadingFollowEvent['record']) {
  state.events.push(
    ReadingFollowEventSchema.parse({
      sequence: (BigInt(state.events.at(-1)?.sequence ?? '0') + 1n).toString(),
      record,
    }),
  );
}
export function exportLocalReadingFollow(
  state: LocalState,
  id: string,
  input: unknown = {},
) {
  const q = parseLocal(ReadingFollowExportQuerySchema, input),
    value = stateFor(state, id),
    upper = q.upper ?? value.events.at(-1)?.sequence ?? '0',
    events = value.events
      .filter(
        (e) =>
          BigInt(e.sequence) > BigInt(q.after ?? '0') &&
          BigInt(e.sequence) <= BigInt(upper),
      )
      .slice(0, 101);
  return ReadingFollowExportSchema.parse({
    ownerId: id,
    upper,
    events: events.slice(0, 100),
    next: events.length > 100 ? events[99]!.sequence : null,
  });
}
export const handleReadingFollow: OfflineHandler = (request, state, bundle) => {
  const base = '/api/v1/account/reading-follow';
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  if (new Set([...request.query.keys()]).size !== request.query.size)
    return fail(400, 'Provide query fields once.');
  const user = requireUser(state),
    value = stateFor(state, user.id);
  const items = currentPublications(bundle.feed, bundle.histories),
    now = new Date().toISOString();
  if (request.method === 'GET' && request.path === base) {
    const q = parseLocal(
      ReadingFollowPageSchema,
      Object.fromEntries(request.query),
    );
    const selected = Object.values(value.items)
      .filter((i) => i.itemId > (q.after ?? '') && i.status !== 'baseline')
      .sort((a, b) => a.itemId.localeCompare(b.itemId))
      .slice(0, 101);
    return {
      body: ReadingFollowViewSchema.parse({
        config: value.config,
        items: selected.slice(0, 100),
        next: selected.length > 100 ? selected[99]!.itemId : null,
        availableIds: selected
          .slice(0, 100)
          .filter((i) =>
            items.some(
              (item) => item.id === i.itemId && item.status === 'published',
            ),
          )
          .map((i) => i.itemId),
        observedAt: now,
        bundleGeneratedAt: bundle.generatedAt,
        publishedReading: readingFollowPublications(
          items,
          selected.slice(0, 100).map((item) => item.itemId),
        ),
      }),
    };
  }
  if (request.method === 'GET' && request.path === base + '/export')
    return {
      body: exportLocalReadingFollow(
        state,
        user.id,
        Object.fromEntries(request.query),
      ),
    };
  const acknowledge = request.path.match(
    /^\/api\/v1\/account\/reading-follow\/notices\/([a-z0-9-]+)\/acknowledge$/,
  );
  const kind =
    request.method === 'PUT' && request.path === base
      ? 'settings'
      : request.method === 'POST' && request.path === base + '/check'
        ? 'check'
        : request.method === 'POST' && acknowledge
          ? 'acknowledge'
          : null;
  if (!kind) return fail(405, 'Method not supported.');
  const input =
    kind === 'settings'
      ? parseLocal(ReadingFollowWriteSchema, request.body)
      : kind === 'check'
        ? parseLocal(ReadingFollowCheckSchema, request.body)
        : parseLocal(ReadingFollowAckSchema, request.body);
  const fingerprint = JSON.stringify({
    kind,
    ...(acknowledge ? { id: acknowledge[1] } : {}),
    input,
  });
  const previous = value.events.find(
    (e) =>
      e.record.kind === 'operation' &&
      e.record.receipt.requestId === input.requestId,
  );
  if (previous?.record.kind === 'operation') {
    if (previous.record.fingerprint !== fingerprint)
      return fail(409, 'Request ID already used.');
    return {
      body: previous.record.receipt,
      status: kind === 'settings' ? 200 : 201,
    };
  }
  let examined = 0,
    changed = 0;
  let acknowledged: ReadingFollowItem | null = null;
  const deadline = Date.now() + 10000;
  if (kind === 'acknowledge') {
    const old = value.items[acknowledge![1]!];
    if (!old) return fail(404, 'Notice unavailable.');
    if (old.version !== input.expectedVersion || old.status !== 'open')
      return fail(409, 'Notice changed. Reload.');
    acknowledged = old;
    const updated = ReadingFollowItemSchema.parse({
      ...old,
      version: old.version + 1,
      status: 'acknowledged',
    });
    value.items[old.itemId] = updated;
    append(value, { kind: 'item', item: updated });
    examined = changed = 1;
  } else {
    if (value.config.version !== input.expectedVersion)
      return fail(
        409,
        'Subscriptions changed. Discard stale review and reload.',
      );
    let next = value.config;
    if (kind === 'settings') {
      const input = parseLocal(ReadingFollowWriteSchema, request.body);
      const catalogue = ResearchCatalogSchema.parse(bundle.researchCatalog);
      if (
        input.sources.some(
          (id) => !catalogue.sources.some((s) => s.id === id),
        ) ||
        input.topics.some(
          (t) =>
            !value.config.topics.includes(t) &&
            !items.some(
              (i) => i.status === 'published' && i.topics.includes(t),
            ),
        )
      )
        return fail(400, 'Reload available catalogue choices.');
      next = {
        sources: [...input.sources].sort(),
        topics: [...input.topics].sort(),
        muted: input.muted,
        version: value.config.version + 1,
        savedAt: now,
      };
      if (
        JSON.stringify({
          ...next,
          version: value.config.version,
          savedAt: value.config.savedAt,
        }) === JSON.stringify(value.config)
      )
        return fail(409, 'No subscription changes to save.');
    } else if (!next.version || next.muted)
      return fail(409, 'Save active subscriptions before checking.');
    for (const id of [
      ...new Set([...items.map((i) => i.id), ...Object.keys(value.items)]),
    ].sort()) {
      if (Date.now() > deadline)
        return fail(503, 'Complete check timed out; nothing changed. Retry.');
      const item = items.find((i) => i.id === id) ?? null;
      const updated = evaluateReadingFollow(
        value.items[id] ?? null,
        item,
        item ? sourceIdFor(item) : '',
        next,
        now,
        kind === 'settings',
        value.config,
      );
      examined++;
      if (updated) {
        value.items[id] = updated;
        append(value, { kind: 'item', item: updated });
        changed++;
      }
    }
    value.config = next;
    if (kind === 'settings') append(value, { kind: 'config', config: next });
  }
  const completedAt = new Date().toISOString();
  const receipt = acknowledged
    ? readingFollowAckReceipt(
        acknowledged,
        input.requestId,
        now,
        completedAt,
        bundle.generatedAt,
      )
    : ReadingFollowReceiptSchema.parse({
        requestId: input.requestId,
        kind,
        configVersion: value.config.version,
        startedAt: now,
        completedAt,
        bundleGeneratedAt: bundle.generatedAt,
        examined,
        changed,
      });
  append(value, { kind: 'operation', fingerprint, receipt });
  write(state, user.id, value);
  return { body: receipt, status: kind === 'settings' ? 200 : 201 };
};
