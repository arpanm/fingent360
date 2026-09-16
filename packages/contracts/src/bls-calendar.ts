import { parseBeaCalendar } from './research-auto.js';
// Exact VTIMEZONE published by BLS in the retained 2026-09-15 research fixture.
const timezone = `BEGIN:VTIMEZONE
TZID:US-Eastern
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
DTSTART:20070311T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZNAME:EDT
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
DTSTART:20071104T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZNAME:EST
END:STANDARD
END:VTIMEZONE`;
const allowed = new Set([
  'SEQUENCE',
  'CLASS',
  'UID',
  'DTSTART;TZID=US-Eastern',
  'DURATION',
  'SUMMARY',
  'LOCATION',
  'TRANSP',
  'CATEGORIES',
  'STATUS',
]);
function utc(local: string) {
  if (!/^\d{8}T\d{6}$/.test(local) || Number(local.slice(0, 4)) < 2007)
    throw Error('Unsupported BLS calendar date.');
  const iso = `${local.slice(0, 4)}-${local.slice(4, 6)}-${local.slice(6, 8)}T${local.slice(9, 11)}:${local.slice(11, 13)}:${local.slice(13, 15)}.000Z`;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== iso)
    throw Error('Invalid BLS calendar date.');
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const candidates = [4, 5]
    .map((hours) => new Date(ms + hours * 3600000))
    .filter((date) => {
      const parts = Object.fromEntries(
        format.formatToParts(date).map((part) => [part.type, part.value]),
      );
      return (
        `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}` ===
        local
      );
    });
  if (candidates.length !== 1)
    throw Error('Ambiguous or nonexistent BLS local time.');
  return candidates[0]!.toISOString().replace(/[-:]/g, '').replace('.000', '');
}
export function parseBlsCalendar(body: string) {
  if (body.length > 2000000) throw Error('Calendar too large.');
  const normalized = body.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  if (
    !normalized.startsWith('BEGIN:VCALENDAR\n') ||
    normalized.split('BEGIN:VTIMEZONE').length !== 2 ||
    !normalized.includes(timezone)
  )
    throw Error('Unsupported BLS timezone definition.');
  let inside = false;
  const converted = normalized
    .split('\n')
    .map((line) => {
      if (line === 'BEGIN:VEVENT') {
        if (inside) throw Error('Nested calendar event.');
        inside = true;
        return line;
      }
      if (line === 'END:VEVENT') {
        if (!inside) throw Error('Unopened calendar event.');
        inside = false;
        return line;
      }
      if (!inside) return line;
      const colon = line.indexOf(':');
      if (colon < 1 || !allowed.has(line.slice(0, colon)))
        throw Error('Unsupported BLS event property.');
      if (line.startsWith('DTSTART;TZID=US-Eastern:'))
        return `DTSTART:${utc(line.slice(colon + 1))}`;
      if (
        line.startsWith('STATUS:') &&
        !['STATUS:CANCELLED', 'STATUS:CONFIRMED'].includes(line)
      )
        throw Error('Unsupported calendar status.');
      return line;
    })
    .join('\n');
  return parseBeaCalendar(converted);
}
