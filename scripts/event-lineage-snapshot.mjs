import {
  EventLineagePublicSchema,
  EventPublicSchema,
} from '../packages/contracts/dist/index.js';
/** Capture only public relations. Reconcile titles and availability with the actual captured corpus. */
export async function captureEventLineage(get, events) {
  const result = {};
  for (const event of events) {
    const value = EventLineagePublicSchema.parse(
      await get('/events/' + event.id + '/lineage'),
    );
    if (value.eventId !== event.id)
      throw Error('Wrong event lineage identity during export.');
    const current = EventPublicSchema.parse(await get('/events/' + event.id));
    const material = (row) =>
      JSON.stringify({
        id: row.id,
        status: row.status,
        event: row.event,
        reviewedAt: row.reviewedAt,
      });
    if (material(event) !== material(current))
      throw Error('Event changed during lineage export. Retry snapshot.');
    const final = EventLineagePublicSchema.parse(
      await get('/events/' + event.id + '/lineage'),
    );
    if (final.eventId !== event.id)
      throw Error('Wrong event lineage identity during export.');
    if (JSON.stringify(value.relations) !== JSON.stringify(final.relations))
      throw Error('Event lineage changed during export. Retry snapshot.');
    result[event.id] = EventLineagePublicSchema.parse({
      ...final,
      relations: final.relations.map((relation) => ({
        ...relation,
        related: relation.related.map((related) => {
          const captured = events.find((item) => item.id === related.id);
          if (
            captured &&
            (related.available !== (captured.status === 'published') ||
              related.title !==
                (captured.status === 'published'
                  ? captured.event.editorial.title
                  : null))
          )
            throw Error(
              'Related event changed from the captured corpus. Retry snapshot.',
            );
          return {
            id: related.id,
            available: related.available && captured?.status === 'published',
            title:
              related.available && captured?.status === 'published'
                ? captured.event.editorial.title
                : null,
          };
        }),
      })),
    });
  }
  return result;
}
