import type pg from 'pg';
import {
  readingCalendarContext,
  ReleaseCalendarSchema,
  calendarSources,
} from '@fingent360/contracts';
export async function readFollowCalendar(
  c: pg.PoolClient,
  config: { sources: string[]; muted: boolean },
  at: string,
) {
  if (
    config.muted ||
    !config.sources.some((id) => id === 'bea' || id === 'bea-gdp-original')
  )
    return readingCalendarContext(config, null, at);
  const row = (
    await c.query<{ hash: string; retrieved_at: Date; data: unknown }>(
      "SELECT hash,retrieved_at,data FROM research_calendar_editions WHERE source_id='bea-calendar' ORDER BY retrieved_at DESC,hash LIMIT 1",
    )
  ).rows[0];
  const calendar = row
    ? ReleaseCalendarSchema.parse({
        sourceId: 'bea-calendar',
        edition: row.hash,
        retrievedAt: row.retrieved_at.toISOString(),
        sourceUrl: calendarSources['bea-calendar'].url,
        basis: 'retained-calendar-capture',
        events: row.data,
        editions: [
          { edition: row.hash, retrievedAt: row.retrieved_at.toISOString() },
        ],
      })
    : null;
  return readingCalendarContext(config, calendar, at);
}
