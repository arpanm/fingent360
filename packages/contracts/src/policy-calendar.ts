import { z } from 'zod';

export const FOMC_CALENDAR_URL =
  'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.valueOf()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, 'Invalid calendar day.');
export const PolicyMeetingSchema = z
  .object({
    id: z.string().regex(/^fomc-\d{4}-\d{2}-\d{2}-(meeting|notation-vote)$/),
    startOn: day,
    endOn: day,
    precision: z.literal('day'),
    kind: z.enum(['meeting', 'notation-vote']),
    projectionsScheduled: z.boolean(),
    statementUrl: z
      .string()
      .regex(
        /^https:\/\/www\.federalreserve\.gov\/newsevents\/pressreleases\/monetary\d{8}a\.htm$/,
      )
      .nullable(),
    status: z.enum(['scheduled', 'statement-linked']),
  })
  .strict()
  .superRefine((meeting, context) => {
    if (
      meeting.startOn > meeting.endOn ||
      meeting.id !== `fomc-${meeting.endOn}-${meeting.kind}` ||
      (meeting.statementUrl !== null) !==
        (meeting.status === 'statement-linked') ||
      (meeting.statementUrl &&
        !meeting.statementUrl.endsWith(
          `monetary${meeting.endOn.replaceAll('-', '')}a.htm`,
        ))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inconsistent meeting dates or statement attribution.',
      });
  });
export const PolicyCalendarSchema = z
  .object({
    sourceId: z.literal('fomc-calendar'),
    sourceUrl: z.literal(FOMC_CALENDAR_URL),
    version: z.literal('fomc-calendar-html-v1'),
    edition: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    retrievedAt: z.string().datetime().nullable(),
    basis: z.literal('retained-calendar-capture'),
    meetings: z.array(PolicyMeetingSchema).max(1000),
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
  .superRefine((calendar, context) => {
    if (
      (calendar.edition === null) !== (calendar.retrievedAt === null) ||
      (!calendar.edition && calendar.meetings.length > 0) ||
      new Set(calendar.meetings.map((meeting) => meeting.id)).size !==
        calendar.meetings.length
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid calendar capture provenance.',
      });
  });
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
const plain = (value: string) =>
  value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;|&ndash;|–/g, '-')
    .trim();
function dateOn(year: number, month: string, date: string) {
  const index = months.findIndex(
    (name) => name === month || name.slice(0, 3) === month,
  );
  if (index < 0) throw Error('Unsupported FOMC month.');
  return day.parse(
    `${year}-${String(index + 1).padStart(2, '0')}-${date.padStart(2, '0')}`,
  );
}
/** Parse the Board's published meeting rows, not a generated eight-meeting rule. */
export function parseFomcCalendar(html: string) {
  if (html.length > 2000000) throw Error('Calendar exceeds source size limit.');
  const years = [
    ...html.matchAll(/<h4\b[^>]*>[\s\S]*?(\d{4}) FOMC Meetings[\s\S]*?<\/h4>/g),
  ];
  if (!years.length) throw Error('Official FOMC year headings missing.');
  const meetings: z.infer<typeof PolicyMeetingSchema>[] = [];
  for (let i = 0; i < years.length; i++) {
    const heading = years[i]!;
    const section = html.slice(
      (heading.index ?? 0) + heading[0].length,
      years[i + 1]?.index ?? html.length,
    );
    const rows = [
      ...section.matchAll(
        /<div\b[^>]*class="[^"]*\bfomc-meeting\b[^"]*"[^>]*>/g,
      ),
    ].filter((row) =>
      /(?:^|\s)fomc-meeting(?:\s|$)/.test(
        row[0].match(/class="([^"]*)"/)?.[1] ?? '',
      ),
    );
    for (let r = 0; r < rows.length; r++) {
      const row = section.slice(
        rows[r]!.index ?? 0,
        rows[r + 1]?.index ?? section.length,
      );
      const month = row.match(
        /class="[^"]*fomc-meeting__month[^"]*"[^>]*>([\s\S]*?)<\/div>/,
      )?.[1];
      const dates = row.match(
        /class="[^"]*fomc-meeting__date[^"]*"[^>]*>([\s\S]*?)<\/div>/,
      )?.[1];
      if (!month || !dates) throw Error('Incomplete FOMC meeting row.');
      const raw = plain(dates);
      const parsed =
        /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?(\*)?(?:\s*\((notation vote|unscheduled)\))?$/.exec(
          raw,
        );
      if (!parsed)
        throw Error('Unsupported FOMC meeting date; source review required.');
      const names = plain(month).split('/');
      if (names.length > 2 || (names.length === 2 && !parsed[2]))
        throw Error('Unsupported cross-month meeting.');
      const startOn = dateOn(Number(heading[1]!), names[0]!, parsed[1]!);
      const endOn = dateOn(
        Number(heading[1]!),
        names[names.length - 1]!,
        parsed[2] ?? parsed[1]!,
      );
      const statementLinks = [
        ...new Set(
          [
            ...row.matchAll(
              /href="(\/newsevents\/pressreleases\/monetary\d{8}a\.htm)"/g,
            ),
          ].map((link) => link[1]),
        ),
      ];
      if (statementLinks.length > 1)
        throw Error('Ambiguous FOMC statement attribution.');
      const statementUrl = statementLinks[0]
        ? `https://www.federalreserve.gov${statementLinks[0]}`
        : null;
      const kind = parsed[4] === 'notation vote' ? 'notation-vote' : 'meeting';
      meetings.push(
        PolicyMeetingSchema.parse({
          id: `fomc-${endOn}-${kind}`,
          startOn,
          endOn,
          precision: 'day',
          kind,
          projectionsScheduled: Boolean(parsed[3]),
          statementUrl,
          status: statementUrl ? 'statement-linked' : 'scheduled',
        }),
      );
    }
    if (!rows.length)
      throw Error('FOMC year contains no recognizable meetings.');
  }
  if (new Set(meetings.map((meeting) => meeting.id)).size !== meetings.length)
    throw Error('Duplicate FOMC meeting.');
  return meetings.sort((a, b) => a.endOn.localeCompare(b.endOn));
}
