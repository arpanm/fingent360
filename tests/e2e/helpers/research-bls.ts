import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  parseBlsCalendar,
  calendarSources,
} from '../../../packages/contracts/src/index';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
export async function seedBlsCalendar(sandbox: FeedbackSandbox) {
  const raw = await readFile(
    new URL(
      '../../../packages/contracts/test/fixtures/bls-calendar-official.ics',
      import.meta.url,
    ),
    'utf8',
  );
  const timezone = raw.match(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE/)?.[0];
  if (!timezone) throw Error('Official fixture timezone missing.');
  const db = await connectionDatabase(sandbox);
  const hashes: string[] = [];
  try {
    for (const version of [1, 2]) {
      const body = `BEGIN:VCALENDAR\nVERSION:2.0\n${timezone}\nBEGIN:VEVENT\nUID:synthetic-bls-release\nSUMMARY:Synthetic BLS release\nDTSTART;TZID=US-Eastern:20270105T${version === 1 ? '083000' : '093000'}\nSEQUENCE:${version}\nEND:VEVENT\nEND:VCALENDAR\n`;
      const hash = createHash('sha256')
        .update(`${calendarSources['bls-calendar'].url}\n${body}`)
        .digest('hex');
      await db.query(
        'INSERT INTO research_calendar_editions(hash,retrieved_at,data,source_id) VALUES($1,$2,$3::jsonb,$4)',
        [
          hash,
          `2026-09-${version === 1 ? '14' : '15'}T00:00:00.000Z`,
          JSON.stringify(parseBlsCalendar(body)),
          'bls-calendar',
        ],
      );
      hashes.push(hash);
    }
  } finally {
    await db.end();
  }
  return hashes;
}
