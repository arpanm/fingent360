import { z } from 'zod';
import { parseBeaGdpAnnualized } from './bea-gdp-vintage.js';
export const BEA_GDP_INDEX = 'https://www.bea.gov/news/current-releases';
export function isBeaGdpOriginalUrl(value: string) {
  return /^https:\/\/www\.bea\.gov\/news\/20\d{2}\/(?:gross-domestic-product-|gdp-)[a-z0-9-]+$/.test(
    value,
  );
}
export const BeaGdpOriginalSchema = z
  .object({
    policy: z.literal('bea-original-gdp-v1'),
    basis: z.literal('captured-original-release-page'),
    period: z.string().regex(/^20\d{2}-Q[1-4]$/),
    estimate: z.enum(['advance', 'second', 'third']),
    value: z.string().regex(/^-?(0|[1-9]\d?)(\.\d{1,2})?$/),
    measure: z.literal('real-gdp-quarter-annualized-percent'),
    publishedAt: z.string().datetime(),
    retrievedAt: z.string().datetime(),
    url: z.string().refine(isBeaGdpOriginalUrl),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    excerpt: z.string().min(20).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    try {
      const parsed = parseBeaGdpAnnualized(value.excerpt);
      const ordinal = ['1st', '2nd', '3rd', '4th'][
        Number(value.period.slice(-1)) - 1
      ];
      if (
        parsed.value !== value.value ||
        parsed.period !== value.period ||
        value.publishedAt > value.retrievedAt ||
        !value.url.includes(`/news/${value.publishedAt.slice(0, 4)}/`) ||
        !value.url.includes(`${ordinal}-quarter-${value.period.slice(0, 4)}`) ||
        !value.url.includes(`${value.estimate}-estimate`)
      )
        throw Error('Conflicting original GDP value, original URL or time.');
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inconsistent original GDP provenance.',
      });
    }
  });
export const BeaGdpSeriesSchema = z
  .object({
    capturedAt: z.string().datetime(),
    items: z
      .array(
        z
          .object({
            itemId: z.string().regex(/^gdp-original-[a-f0-9]{32}$/),
            version: z.number().int().positive(),
            reviewedAt: z.string().datetime(),
            original: BeaGdpOriginalSchema,
          })
          .strict(),
      )
      .max(500),
    truncated: z.boolean(),
  })
  .strict();
const text = (value: string) =>
  value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
function originalTime(value: string) {
  const match =
    /^EMBARGOED UNTIL RELEASE AT (\d{1,2}):(\d{2}) (a|p)\.m\. (EDT|EST), (Monday|Tuesday|Wednesday|Thursday|Friday), ([A-Za-z]+) (\d{1,2}), (20\d{2})$/.exec(
      value,
    );
  if (!match) throw Error('Explicit original BEA release time required.');
  const month = months.indexOf(match[6]!),
    hour = Number(match[1]),
    minute = Number(match[2]);
  if (month < 0 || hour < 1 || hour > 12 || minute > 59)
    throw Error('Invalid release date/time.');
  const local = `${match[8]}-${String(month + 1).padStart(2, '0')}-${match[7]!.padStart(2, '0')}T${String((hour % 12) + (match[3] === 'p' ? 12 : 0)).padStart(2, '0')}:${match[2]}:00`;
  const date = new Date(`${local}${match[4] === 'EDT' ? '-04:00' : '-05:00'}`);
  if (!Number.isFinite(date.valueOf()))
    throw Error('Invalid original release timestamp.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
  }).formatToParts(date);
  const part = (name: string) =>
    parts.find((value) => value.type === name)?.value;
  if (
    `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:00` !==
      local ||
    part('weekday') !== match[5]
  )
    throw Error('BEA timezone, weekday or calendar date mismatch.');
  return date.toISOString();
}
export function parseBeaGdpOriginal(input: {
  url: string;
  body: string;
  hash: string;
  retrievedAt: string;
}) {
  if (!isBeaGdpOriginalUrl(input.url) || input.body.length > 2000000)
    throw Error('Unsupported original GDP URL or size.');
  const headings = [...input.body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => text(match[1]!))
    .filter((value) => /^(GDP\s*\(|Gross Domestic Product,)/.test(value));
  if (headings.length !== 1) throw Error('One original GDP headline required.');
  const title = headings[0]!,
    quarter = title.match(/([1-4])(?:st|nd|rd|th) Quarter (20\d{2})/),
    estimate = title.match(/\((Advance|Second|Third) Estimate\)/);
  if (!quarter || !estimate || /\b(?:State|County|Puerto Rico)\b/i.test(title))
    throw Error('Unsupported GDP headline scope.');
  const releases = [
    ...input.body.matchAll(
      /<div\b[^>]*class="[^"]*field--name-field-release-date[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ),
  ];
  if (releases.length !== 1)
    throw Error('One original release timestamp required.');
  const publishedAt = originalTime(text(releases[0]![1]!));
  const paragraphs = [
    ...input.body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),
  ].map((match) => text(match[1]!));
  const candidates = paragraphs.filter((value) =>
    /^Real gross domestic product\s*\(GDP\)/i.test(value),
  );
  if (candidates.length !== 1)
    throw Error('One original real GDP headline paragraph required.');
  const parsed = parseBeaGdpAnnualized(candidates[0]!);
  const ordinal = ['1st', '2nd', '3rd', '4th'][Number(quarter[1]) - 1];
  if (
    parsed.period !== `${quarter[2]}-Q${quarter[1]}` ||
    !input.url.includes(`/news/${publishedAt.slice(0, 4)}/`) ||
    !input.url.includes(`${ordinal}-quarter-${quarter[2]}`) ||
    !input.url.includes(`${estimate[1]!.toLowerCase()}-estimate`)
  )
    throw Error(
      'GDP headline quarter, estimate or release year conflicts with original URL.',
    );
  return BeaGdpOriginalSchema.parse({
    policy: 'bea-original-gdp-v1',
    basis: 'captured-original-release-page',
    period: parsed.period,
    estimate: estimate[1]!.toLowerCase(),
    value: parsed.value,
    measure: 'real-gdp-quarter-annualized-percent',
    publishedAt,
    retrievedAt: input.retrievedAt,
    url: input.url,
    hash: input.hash,
    excerpt: parsed.quote,
  });
}
export function discoverBeaGdpOriginals(html: string) {
  if (html.length > 2000000)
    throw Error('BEA release index exceeds size limit.');
  const urls: string[] = [];
  for (const match of html.matchAll(
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const title = text(match[2]!);
    if (
      !/^(GDP\s*\(|Gross Domestic Product,)/.test(title) ||
      !/\((Advance|Second|Third) Estimate\)/.test(title) ||
      !/[1-4](?:st|nd|rd|th) Quarter 20\d{2}/.test(title) ||
      /\b(?:State|County|Puerto Rico)\b/i.test(title)
    )
      continue;
    const url = new URL(match[1]!, BEA_GDP_INDEX).href;
    if (!isBeaGdpOriginalUrl(url))
      throw Error('GDP index points outside supported original releases.');
    if (!urls.includes(url)) urls.push(url);
  }
  if (!urls.length || urls.length > 12)
    throw Error('No supported original GDP release links in official index.');
  return urls;
}

export function publicBeaGdpSeries(
  items: Array<{
    id: string;
    version: number;
    status: string;
    reviewedAt: string | null;
    gdpOriginal?: z.infer<typeof BeaGdpOriginalSchema> | undefined;
  }>,
  capturedAt: string,
  period?: string,
) {
  if (period !== undefined && !/^20\d{2}-Q[1-4]$/.test(period))
    throw Error('Choose a GDP quarter in YYYY-Qn format.');
  const selected = items
    .filter(
      (item) =>
        item.status === 'published' &&
        item.reviewedAt &&
        item.gdpOriginal &&
        (!period || item.gdpOriginal.period === period),
    )
    .sort(
      (a, b) =>
        b.gdpOriginal!.publishedAt.localeCompare(a.gdpOriginal!.publishedAt) ||
        a.id.localeCompare(b.id),
    );
  return BeaGdpSeriesSchema.parse({
    capturedAt,
    truncated: selected.length > 500,
    items: selected.slice(0, 500).map((item) => ({
      itemId: item.id,
      version: item.version,
      reviewedAt: item.reviewedAt,
      original: item.gdpOriginal,
    })),
  });
}
