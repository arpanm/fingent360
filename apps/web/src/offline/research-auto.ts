import { ReleaseCalendarSchema } from '@fingent360/contracts';
/** Reader-only snapshot: no provider job, operator credential or fabricated calendar. */
export function offlineResearchCalendar(snapshot: unknown, edition?: string) {
  const parsed = ReleaseCalendarSchema.safeParse(snapshot);
  const data = parsed.success
    ? parsed.data
    : ReleaseCalendarSchema.parse({
        edition: null,
        retrievedAt: null,
        sourceUrl:
          'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',
        basis: 'retained-calendar-capture',
        events: [],
        editions: [],
      });
  if (edition && edition !== data.edition)
    throw Error(
      'This calendar capture is not downloaded. Reconnect and refresh your snapshot.',
    );
  // A bundled snapshot carries only its current capture, not every server capture body.
  return {
    ...data,
    editions: data.editions.filter((e) => e.edition === data.edition),
  };
}
