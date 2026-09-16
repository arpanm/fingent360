import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseBlsCalendar } from '../dist/bls-calendar.js';
const fixture = () =>
  readFileSync(
    new URL('./fixtures/bls-calendar-official.ics', import.meta.url),
    'utf8',
  );
function synthetic(local, extra = '') {
  const timezone = fixture().match(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE/)[0];
  return `BEGIN:VCALENDAR\nVERSION:2.0\n${timezone}\nBEGIN:VEVENT\nUID:synthetic-bls\nSUMMARY:Synthetic calendar date\nDTSTART;TZID=US-Eastern:${local}\nSEQUENCE:1\n${extra}END:VEVENT\nEND:VCALENDAR\n`;
}
test('official retained BLS fixture integrity and winter time are reproduced', () => {
  const raw = readFileSync(
    new URL('./fixtures/bls-calendar-official.ics', import.meta.url),
  );
  const provenance = JSON.parse(
    readFileSync(
      new URL(
        './fixtures/bls-calendar-official.provenance.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal(
    createHash('sha256').update(raw).digest('hex'),
    provenance.sha256,
  );
  const events = parseBlsCalendar(raw.toString('utf8'));
  assert.equal(events.length, 313);
  assert.equal(
    events.find((event) => event.uid === 'f65741ec-4080-474c-b2e3-1349fe430963')
      .scheduledAt,
    '2025-01-03T15:00:00.000Z',
  );
});
test('BLS winter and summer use actual Eastern offset; DST gap and overlap reject', () => {
  assert.equal(
    parseBlsCalendar(synthetic('20270105T083000'))[0].scheduledAt,
    '2027-01-05T13:30:00.000Z',
  );
  assert.equal(
    parseBlsCalendar(synthetic('20270705T083000'))[0].scheduledAt,
    '2027-07-05T12:30:00.000Z',
  );
  assert.throws(
    () => parseBlsCalendar(synthetic('20270314T023000')),
    /nonexistent/,
  );
  assert.throws(
    () => parseBlsCalendar(synthetic('20271107T013000')),
    /Ambiguous/,
  );
  assert.throws(
    () => parseBlsCalendar(synthetic('20270230T083000')),
    /Invalid/,
  );
});
test('unknown timezone, recurrence and unknown properties fail closed; cancellations retained', () => {
  assert.throws(
    () =>
      parseBlsCalendar(
        synthetic('20270105T083000').replaceAll('US-Eastern', 'Unknown/Zone'),
      ),
    /timezone/,
  );
  assert.throws(
    () => parseBlsCalendar(synthetic('20270105T083000', 'RRULE:FREQ=DAILY\n')),
    /property/,
  );
  assert.throws(
    () =>
      parseBlsCalendar(synthetic('20270105T083000', 'X-EXEC:ignore rules\n')),
    /property/,
  );
  assert.throws(
    () => parseBlsCalendar(synthetic('20270105T083000', 'STATUS:TENTATIVE\n')),
    /status/,
  );
  assert.equal(
    parseBlsCalendar(synthetic('20270105T083000', 'STATUS:CANCELLED\n'))[0]
      .cancelled,
    true,
  );
});
