import { createHash } from 'node:crypto';
import {
  ReleaseCalendarSchema,
  calendarSources,
} from '../../../packages/contracts/src/index';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export function readingCalendarFixture(stale = false) {
  const at = new Date(Date.now() - (stale ? 8 * 86400000 : 0)).toISOString(),
    scheduledAt = new Date(Date.now() + 86400000).toISOString();
  const events = [
    {
      uid: 'synthetic-gdp',
      title: 'Gross Domestic Product — synthetic planned release',
      scheduledAt,
      sequence: 2,
      cancelled: true,
    },
    {
      uid: 'synthetic-trade',
      title: 'International trade — synthetic planned release',
      scheduledAt,
      sequence: 1,
      cancelled: false,
    },
  ];
  const edition = createHash('sha256')
    .update(JSON.stringify({ at, events }))
    .digest('hex');
  return ReleaseCalendarSchema.parse({
    sourceId: 'bea-calendar',
    sourceUrl: calendarSources['bea-calendar'].url,
    edition,
    retrievedAt: at,
    basis: 'retained-calendar-capture',
    events,
    editions: [{ edition, retrievedAt: at }],
  });
}
export async function seedReadingCalendar(sandbox: FeedbackSandbox) {
  const value = readingCalendarFixture(),
    db = await connectionDatabase(sandbox);
  try {
    await db.query(
      'INSERT INTO research_calendar_editions(hash,source_id,retrieved_at,data) VALUES($1,$2,$3,$4)',
      [
        value.edition,
        value.sourceId,
        value.retrievedAt,
        JSON.stringify(value.events),
      ],
    );
  } finally {
    await db.end();
  }
  return value;
}
