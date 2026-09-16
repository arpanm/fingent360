import { z } from 'zod';
export const RBI_CALENDAR_URL =
  'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62422';
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  });
const meeting = z
  .object({
    startOn: day,
    endOn: day,
    precision: z.literal('day'),
    status: z.literal('scheduled'),
  })
  .strict()
  .refine(
    (v) =>
      new Date(v.endOn).valueOf() - new Date(v.startOn).valueOf() ===
      2 * 86400000,
  );
export const RbiCalendarDataSchema = z
  .object({
    financialYear: z.literal('2026-2027'),
    publishedOn: z.literal('2026-03-23'),
    publicationReference: z.literal('2025-2026/2306'),
    meetings: z.array(meeting).length(6),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.meetings.some(
        (m, i) =>
          m.startOn < '2026-04-01' ||
          m.endOn > '2027-03-31' ||
          (i > 0 && m.startOn <= v.meetings[i - 1]!.endOn),
      )
    )
      c.addIssue({
        code: 'custom',
        message:
          'Calendar meetings must be ordered, distinct and inside the stated fiscal year.',
      });
  });
export const RbiCalendarSchema = z
  .object({
    sourceId: z.literal('rbi-mpc-calendar'),
    sourceUrl: z.literal(RBI_CALENDAR_URL),
    version: z.literal('rbi-mpc-html-v1'),
    edition: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    retrievedAt: z.string().datetime().nullable(),
    data: RbiCalendarDataSchema.nullable(),
    editions: z
      .array(
        z
          .object({
            edition: z.string().regex(/^[a-f0-9]{64}$/),
            retrievedAt: z.string().datetime(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      (v.edition === null) !== (v.data === null) ||
      (v.edition === null) !== (v.retrievedAt === null) ||
      (v.retrievedAt && v.retrievedAt < '2026-03-23T00:00:00.000Z')
    )
      c.addIssue({
        code: 'custom',
        message: 'Calendar provenance is inconsistent.',
      });
  });
export function parseRbiCalendar(body: string) {
  if (body.length > 2000000) throw Error('RBI calendar exceeds source limit.');
  const clean = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const text = clean
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
  if (
    !text.includes(
      'Meeting Schedule of the Monetary Policy Committee for 2026-2027',
    ) ||
    !text.includes('Date : Mar 23, 2026') ||
    !text.includes('Press Release: 2025-2026/2306')
  )
    throw Error('Unsupported RBI original schedule or publication metadata.');
  const table = clean.match(
    /Dates of meetings of Monetary Policy Committee for 2026-27<\/td>[\s\S]*?<\/table>/,
  )?.[0];
  if (!table) throw Error('RBI meeting table missing.');
  const cells = [...table.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, '').trim(),
  );
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const meetings = cells.map((cell) => {
    const m = /^([A-Za-z]+) (\d{1,2}), (\d{1,2}) and (\d{1,2}), (\d{4})$/.exec(
      cell,
    );
    if (
      !m ||
      Number(m[3]) !== Number(m[2]) + 1 ||
      Number(m[4]) !== Number(m[3]) + 1 ||
      !months.includes(m[1]!)
    )
      throw Error('Unrecognized RBI meeting date row.');
    const prefix = `${m[5]}-${String(months.indexOf(m[1]!) + 1).padStart(2, '0')}-`;
    return {
      startOn: prefix + m[2]!.padStart(2, '0'),
      endOn: prefix + m[4]!.padStart(2, '0'),
      precision: 'day',
      status: 'scheduled',
    };
  });
  return RbiCalendarDataSchema.parse({
    financialYear: '2026-2027',
    publishedOn: '2026-03-23',
    publicationReference: '2025-2026/2306',
    meetings,
  });
}
