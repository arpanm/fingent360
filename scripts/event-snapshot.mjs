import {
  eventSelectionsCurrent,
  EventListSchema,
  EventPublicSchema,
  EventHistorySchema,
  SecurityHistorySchema,
  currentPublications,
  eventSourcesCurrent,
} from '../packages/contracts/dist/index.js';
/** User-run public export: complete bounded selection or explicit failure, never a partial success. */
export async function captureEvents(get, bundle) {
  const found = new Map();
  let after;
  let pages = 0;
  do {
    if (++pages > 21) throw Error('Event snapshot page bound exceeded.');
    const page = EventListSchema.parse(
      await get('/events' + (after ? '?after=' + after : '')),
    );
    for (const item of page.items) found.set(item.id, item);
    if (found.size > 1000)
      throw Error(
        'Event snapshot exceeds1000 records; narrow the supported corpus before export.',
      );
    if (page.next && after && page.next <= after)
      throw Error('Event snapshot cursor did not advance.');
    after = page.next;
  } while (after);
  const events = [],
    eventHistories = {};
  for (const item of found.values()) {
    const fresh = EventPublicSchema.parse(await get('/events/' + item.id));
    if (
      fresh.event &&
      (!eventSelectionsCurrent(fresh.event, bundle.identitySelections ?? {}) ||
        !eventSourcesCurrent(
          fresh.event,
          currentPublications(bundle.feed, bundle.histories),
        ) ||
        fresh.event.identities.some(
          (identity) =>
            !bundle.securities.items.some(
              (row) =>
                row.isin === identity.isin && row.version === identity.version,
            ) ||
            !SecurityHistorySchema.parse(
              bundle.securityHistories[identity.isin],
            ).revisions.some(
              (row) =>
                row.version === identity.version &&
                JSON.stringify(row) === JSON.stringify(identity),
            ),
        ))
    )
      continue;
    // History exports carry only dated revision metadata, never unpublished bodies.
    const revisions = [];
    let before;
    let historyPages = 0;
    do {
      if (++historyPages > 21)
        throw Error('Event history page bound exceeded.');
      const page = EventHistorySchema.parse(
        await get(
          '/events/' +
            item.id +
            '/history' +
            (before ? '?before=' + before : ''),
        ),
      );
      revisions.push(...page.revisions);
      if (revisions.length > 1000)
        throw Error(
          'Event history exceeds1000 metadata rows; snapshot requires a reviewed bounded export strategy.',
        );
      if (page.nextBefore && before && page.nextBefore >= before)
        throw Error('Event history cursor did not advance.');
      before = page.nextBefore;
    } while (before);
    const final = EventPublicSchema.parse(await get('/events/' + item.id));
    const material = (value) =>
      JSON.stringify({
        id: value.id,
        status: value.status,
        event: value.event,
        reviewedAt: value.reviewedAt,
      });
    if (material(final) !== material(fresh))
      throw Error(
        'Event publication changed while capturing history. Retry the public snapshot.',
      );
    events.push(final);
    eventHistories[item.id] = { revisions, nextBefore: null };
  }
  return { events, eventHistories };
}
