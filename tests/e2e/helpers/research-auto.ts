import { createHash } from 'node:crypto';
import { connectionDatabase } from './research-connection-fixture';
import type { FeedbackSandbox } from './feedback-fixture';
import { parseBeaCalendar } from '../../../packages/contracts/src/research-auto';
export const syntheticCalendar =
  'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:synthetic-release-1\r\nSUMMARY:Synthetic release\r\nDTSTART;VALUE=DATE-TIME:20270105T133000Z\r\nSEQUENCE:2\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
export async function seedResearchCalendar(sandbox: FeedbackSandbox) {
  const pool = await connectionDatabase(sandbox),
    hash = createHash('sha256').update(syntheticCalendar).digest('hex');
  try {
    await pool.query(
      'INSERT INTO research_calendar_editions(hash,retrieved_at,data) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING',
      [
        hash,
        '2026-09-14T00:00:00.000Z',
        JSON.stringify(parseBeaCalendar(syntheticCalendar)),
      ],
    );
  } finally {
    await pool.end();
  }
  return hash;
}
