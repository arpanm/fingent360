import { z } from 'zod';
export const ResearchAutoSettingSchema = z.strictObject({
  sourceId: z.string().min(1).max(80),
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(60).max(10080),
});
export const ResearchAutoStatusSchema = z.strictObject({
  schedules: z.array(
    ResearchAutoSettingSchema.extend({
      nextAt: z.iso.datetime(),
      lastStatus: z.enum(['never', 'running', 'succeeded', 'failed']),
      lastRunId: z.uuid().nullable(),
      message: z.string(),
    }),
  ),
  observedAt: z.iso.datetime(),
});
export const ReleaseEventSchema = z.strictObject({
  uid: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  scheduledAt: z.iso.datetime(),
  sequence: z.number().int().nonnegative(),
  cancelled: z.boolean(),
});
export const ReleaseCalendarSchema = z.strictObject({
  edition: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  retrievedAt: z.iso.datetime().nullable(),
  sourceUrl: z.literal(
    'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',
  ),
  basis: z.literal('retained-calendar-capture'),
  events: z.array(ReleaseEventSchema).max(3000),
  editions: z
    .array(
      z.strictObject({
        edition: z.string().regex(/^[a-f0-9]{64}$/),
        retrievedAt: z.iso.datetime(),
      }),
    )
    .max(100),
});
export function parseBeaCalendar(body: string) {
  if (body.length > 2000000 || !body.startsWith('BEGIN:VCALENDAR'))
    throw Error('Invalid calendar document.');
  const lines = body
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
  const events: z.infer<typeof ReleaseEventSchema>[] = [];
  let fields: Record<string, string> | undefined;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      if (fields) throw Error('Nested event.');
      fields = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (!fields) throw Error('Unopened event.');
      const at = fields.DTSTART;
      if (!at || !/^\d{8}T\d{6}Z$/.test(at))
        throw Error('Calendar requires explicit UTC time.');
      const stamp = `${at.slice(0, 4)}-${at.slice(4, 6)}-${at.slice(6, 8)}T${at.slice(9, 11)}:${at.slice(11, 13)}:${at.slice(13, 15)}.000Z`;
      events.push(
        ReleaseEventSchema.parse({
          uid: fields.UID,
          title: fields.SUMMARY?.replace(/\\n/gi, ' ').replace(
            /\\([,;\\])/g,
            '$1',
          ),
          scheduledAt: stamp,
          sequence: Number(fields.SEQUENCE ?? 0),
          cancelled: fields.STATUS === 'CANCELLED',
        }),
      );
      fields = undefined;
      continue;
    }
    if (fields) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const key = line.slice(0, colon).split(';')[0]!;
      if (key in fields) throw Error('Repeated event field.');
      fields[key] = line.slice(colon + 1);
    }
  }
  if (
    fields ||
    !lines.includes('END:VCALENDAR') ||
    !events.length ||
    new Set(events.map((e) => e.uid)).size !== events.length
  )
    throw Error('Incomplete or duplicated calendar.');
  return z
    .array(ReleaseEventSchema)
    .max(3000)
    .parse(events)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
