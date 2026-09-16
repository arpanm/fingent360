import { z } from 'zod';
import { ReleaseCalendarSchema, ReleaseEventSchema } from './research-auto.js';
export const ReadingCalendarContextSchema = z.strictObject({
  basis: z.literal('planned-release-context-v1'),
  observedAt: z.iso.datetime(),
  state: z.enum(['not-selected', 'muted', 'unavailable', 'available', 'stale']),
  matchedSources: z.array(z.enum(['bea', 'bea-gdp-original'])).max(2),
  sourceUrl: z.literal(
    'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',
  ),
  edition: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  retrievedAt: z.iso.datetime().nullable(),
  events: z.array(ReleaseEventSchema).max(10),
  additional: z.number().int().nonnegative(),
  urgency: z.literal('none'),
  createsNotice: z.literal(false),
});
/** Publisher/calendar association only, never proof of release or investment materiality. */
export function readingCalendarContext(
  config: { sources: string[]; muted: boolean },
  snapshot: unknown,
  observedAt: string,
) {
  const matchedSources = (['bea', 'bea-gdp-original'] as const).filter((id) =>
    config.sources.includes(id),
  );
  const calendar = ReleaseCalendarSchema.safeParse(snapshot);
  const retained =
    calendar.success &&
    calendar.data.sourceId === 'bea-calendar' &&
    calendar.data.edition &&
    calendar.data.retrievedAt
      ? calendar.data
      : null;
  const state = !matchedSources.length
    ? 'not-selected'
    : config.muted
      ? 'muted'
      : !retained
        ? 'unavailable'
        : Date.parse(observedAt) - Date.parse(retained.retrievedAt!) >
              7 * 86400000 ||
            Date.parse(retained.retrievedAt!) > Date.parse(observedAt)
          ? 'stale'
          : 'available';
  const events =
    state === 'available' || state === 'stale'
      ? retained!.events
          .filter(
            (event) =>
              event.scheduledAt >= observedAt &&
              (matchedSources.includes('bea') ||
                /gross domestic product/i.test(event.title)),
          )
          .sort(
            (a, b) =>
              a.scheduledAt.localeCompare(b.scheduledAt) ||
              a.uid.localeCompare(b.uid),
          )
      : [];
  return ReadingCalendarContextSchema.parse({
    basis: 'planned-release-context-v1',
    observedAt,
    state,
    matchedSources,
    sourceUrl:
      'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',
    edition:
      matchedSources.length && !config.muted
        ? (retained?.edition ?? null)
        : null,
    retrievedAt:
      matchedSources.length && !config.muted
        ? (retained?.retrievedAt ?? null)
        : null,
    events: events.slice(0, 10),
    additional: Math.max(0, events.length - 10),
    urgency: 'none',
    createsNotice: false,
  });
}
