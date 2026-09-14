import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import { FeedItemSchema, type FeedItem } from './discovery.js';
export const BEA_FEED = 'https://apps.bea.gov/rss/rss.xml';
export const BEA_NAME = 'U.S. Bureau of Economic Analysis';
export const BEA_TERMS = 'https://www.bea.gov/help/faq/147';
export const BEA_RIGHTS = `BEA first-party release headlines; site information is generally public domain unless otherwise stated. Attribute the U.S. Bureau of Economic Analysis; no endorsement, third-party content, descriptions, images or logos. Primary terms checked 2026-09-13: ${BEA_TERMS}`;
export const BEA_SCOPE =
  'BEA headline only · see original for reference period, units and estimates';
export function isBeaReleaseUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.href === value &&
      u.protocol === 'https:' &&
      u.hostname === 'www.bea.gov' &&
      !u.port &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      /^\/news\/\d{4}\/[a-z0-9][a-z0-9-]*$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export const BeaReleaseSchema = z.strictObject({
  title: z.string().trim().min(1).max(500),
  url: z.string().refine(isBeaReleaseUrl),
  publishedAt: z.iso.datetime(),
  excerpt: z.string().max(8000),
});
const optionalFields = new Set([
  '#text',
  '@_name',
  'dbId',
  'description',
  'guid',
  'data',
  'NextReleaseDate',
  'unitsOfMeasure',
  'changeUnit',
  'linkHistoric',
  'linkArchive',
  'linkTimeSeries',
  'pdf',
  'vintage',
  'iCalFile',
  'displaySymbol',
  'position',
  'infoDate',
  'infoDatePrevious',
  'percentChange',
  'percentChangePrevious',
  'rateChange',
]);
/** Only the bounded recorded BEA RSS dialect. Numerical extensions and descriptions are never interpreted. */
export function beaReleaseFields(xml: string, retrievedAt: string) {
  z.iso.datetime().parse(retrievedAt);
  if (
    new TextEncoder().encode(xml).length > 1000000 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw Error('Invalid, unsafe or oversized BEA RSS.');
  // Bound nesting/work before constructing the XML object, ignoring CDATA and comments.
  const markup = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, '');
  let depth = 0,
    tags = 0;
  for (const tag of markup.matchAll(/<\/?[A-Za-z][^>]*>/g)) {
    if (++tags > 15000) throw Error('BEA XML tag limit.');
    if (tag[0].startsWith('</')) depth--;
    else if (!tag[0].endsWith('/>')) depth++;
    if (depth > 24 || depth < 0) throw Error('BEA XML nesting limit.');
  }
  const parsed = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    processEntities: true,
  }).parse(xml) as Record<string, unknown>;
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (
    !rss ||
    Array.isArray(rss) ||
    rss['@_version'] !== '2.0' ||
    !channel ||
    Array.isArray(channel)
  )
    throw Error('Expected one BEA RSS channel.');
  const entries =
    channel.item === undefined
      ? []
      : Array.isArray(channel.item)
        ? channel.item
        : [channel.item];
  const chunks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)];
  if (
    !entries.length ||
    entries.length > 200 ||
    entries.length !== chunks.length
  )
    throw Error('Unexpected BEA item count.');
  const seen = new Set<string>();
  const results: Array<z.infer<typeof BeaReleaseSchema>> = [];
  for (let index = 0; index < entries.length; index++) {
    const item = entries[index] as Record<string, unknown>;
    if (
      !item ||
      typeof item !== 'object' ||
      Object.keys(item).some(
        (k) =>
          !['title', 'link', 'pubDate'].includes(k) && !optionalFields.has(k),
      )
    )
      throw Error('Unknown BEA release field.');
    if (typeof item['#text'] === 'string' && item['#text'].trim())
      throw Error('Unexpected BEA mixed content.');
    const scalar = (key: string) => {
      const v = item[key];
      if (
        typeof v !== 'string' ||
        !v.trim() ||
        Array.from(v).some(
          (c) => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)),
        )
      )
        throw Error('Missing, repeated or invalid BEA release field.');
      return v.trim();
    };
    const suppliedUrl = scalar('link');
    // The captured official feed contains one bare first-party modern URL.
    // Normalize only this exact admitted host/path dialect; keep raw evidence intact.
    const url = /^www\.bea\.gov\/news\/\d{4}\/[a-z0-9][a-z0-9-]*$/.test(
      suppliedUrl,
    )
      ? `https://${suppliedUrl}`
      : suppliedUrl;
    const u = new URL(url);
    // Older first-party archive editions in the same feed are explicitly outside this adapter.
    if (
      u.protocol === 'https:' &&
      u.hostname === 'apps.bea.gov' &&
      !u.port &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      /^\/newsreleases\/[a-zA-Z0-9_/-]+\.htm$/.test(u.pathname)
    )
      continue;
    if (!isBeaReleaseUrl(url) || seen.has(url))
      throw Error('Unsupported or repeated BEA release URL.');
    seen.add(url);
    const title = scalar('title')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const date = scalar('pubDate');
    // Explicit provider zones avoid platform/local timezone interpretation.
    const zoned = date.replace(/ EDT$/, ' -0400').replace(/ EST$/, ' -0500');
    if (
      !/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} (?:GMT|[+-]\d{4})$/.test(
        zoned,
      )
    )
      throw Error('Unsupported BEA publication date.');
    const parts = zoned.split(' '),
      day = Number(parts[1]),
      month = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ].indexOf(parts[2]!),
      year = Number(parts[3]);
    if (
      month < 0 ||
      day < 1 ||
      day > new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    )
      throw Error('Invalid BEA calendar date.');
    const publishedAt = new Date(zoned).toISOString();
    if (Date.parse(publishedAt) > Date.parse(retrievedAt) + 86400000)
      throw Error('Future BEA publication date.');
    const fields = ['title', 'link', 'pubDate'].map((key) => {
      const matches = [
        ...chunks[index]![1]!.matchAll(
          new RegExp(`<${key}>([\\s\\S]*?)<\\/${key}>`, 'g'),
        ),
      ];
      if (matches.length !== 1) throw Error('Invalid BEA metadata markup.');
      return matches[0]![0];
    });
    results.push(
      BeaReleaseSchema.parse({
        title,
        url,
        publishedAt,
        excerpt: `<item>\n${fields.join('\n')}\n</item>`,
      }),
    );
  }
  if (!results.length) throw Error('No supported BEA releases.');
  return results;
}
/** Public BEA tombstones retain provenance, never withdrawn headline/body/editorial copied text. */
export function publicBeaEdition(
  item: FeedItem,
  currentWithdrawn = false,
): FeedItem {
  if (
    !item.id.startsWith('bea-') ||
    (!currentWithdrawn && item.status !== 'withdrawn')
  )
    return item;
  return FeedItemSchema.parse({
    ...item,
    title: 'Withdrawn BEA release',
    summary: '',
    body: '',
    relatedIds: [],
    topics: [],
    correctionNote: 'This BEA edition is unavailable for public reading.',
  });
}
