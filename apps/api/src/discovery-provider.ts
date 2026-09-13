import { createHash } from 'node:crypto';
import type { FeedItem } from '@fingent360/contracts';
export const FED_FEED = 'https://www.federalreserve.gov/feeds/press_all.xml';
export const FED_RIGHTS =
  'Board-authored RSS headlines and summaries; public-domain information unless otherwise marked. Federal Reserve Board attribution; no endorsement, logos, images or external copyrighted material. Rights checked 2026-09-13: https://www.federalreserve.gov/disclaimer.htm';
export const sourceHash = (url: string, body: string) =>
  createHash('sha256')
    .update(url + '\n' + body)
    .digest('hex');
function plain(value: string) {
  return value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => {
      const point =
        n[0]?.toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function parseFedRss(xml: string, retrievedAt: string): FeedItem[] {
  if (
    Buffer.byteLength(xml) > 1000000 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    !/<rss[\s>]/i.test(xml)
  )
    throw new Error('Unsupported or oversized RSS document.');
  if (
    !/<\/rss>\s*$/i.test(xml) ||
    !/<channel[\s>]/i.test(xml) ||
    !/<\/channel>/i.test(xml)
  )
    throw new Error('Incomplete RSS document.');
  const records = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  if (
    records.length !== (xml.match(/<item\b/gi) ?? []).length ||
    records.length !== (xml.match(/<\/item>/gi) ?? []).length
  )
    throw new Error('Malformed RSS items.');
  if (records.length === 0 || records.length > 200)
    throw new Error('Feed has an unexpected item count.');
  return records.map((match) => {
    const read = (tag: string) => {
      const found = [
        ...match[1]!.matchAll(
          new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi'),
        ),
      ];
      if (found.length !== 1)
        throw new Error('Required feed field missing or repeated.');
      return plain(found[0]![1]!);
    };
    const title = read('title'),
      url = read('link'),
      summary = read('description'),
      published = read('pubDate');
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'www.federalreserve.gov' ||
      !parsed.pathname.startsWith('/newsevents/pressreleases/') ||
      parsed.username ||
      parsed.password ||
      parsed.port
    )
      throw new Error('Unexpected feed link.');
    const publishedAt = new Date(published).toISOString();
    if (
      Date.parse(publishedAt) > Date.parse(retrievedAt) + 86400000 ||
      !title ||
      title.length > 500 ||
      summary.length > 3000
    )
      throw new Error('Invalid feed content.');
    return {
      id: `fed-${createHash('sha256').update(url).digest('hex').slice(0, 32)}`,
      version: 1,
      kind: 'news',
      title,
      summary,
      body: summary,
      topics: ['Federal Reserve releases'],
      publishedAt,
      effectiveLabel: 'Official press release',
      source: {
        name: 'Federal Reserve Board',
        url,
        retrievedAt,
        rights: FED_RIGHTS,
      },
      sourceHash: sourceHash(FED_FEED, xml),
      importance: 2,
      relatedIds: [],
      status: 'draft',
      correctionNote: null,
      reviewedAt: null,
    };
  });
}
export async function fetchFed() {
  const response = await fetch(FED_FEED, {
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml',
      'User-Agent': 'Fingent360 educational source reader',
    },
  });
  if (!response.ok || !response.body)
    throw new Error('Official feed unavailable.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1000000) throw new Error('Official feed exceeds size limit.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const body = Buffer.concat(chunks).toString('utf8');
  const retrievedAt = new Date().toISOString();
  return {
    body,
    retrievedAt,
    url: FED_FEED,
    hash: sourceHash(FED_FEED, body),
    items: parseFedRss(body, retrievedAt),
  };
}
export function glossaryItems(now: string): FeedItem[] {
  return [
    [
      'inflation',
      'Inflation',
      'Inflation is a rise in the general level of prices over time.',
      'An inflation rate describes price changes across a selected basket. Your own expenses can change at a different rate. Annual CPI history is not the newest monthly release.',
    ],
    [
      'gdp',
      'GDP growth',
      'GDP measures the value of goods and services produced in an economy over a period.',
      'Real GDP growth adjusts for price changes. It describes aggregate economic activity, not a company’s profit or the return on your investments.',
    ],
    [
      'interest-rates',
      'Interest rates',
      'An interest rate is the price paid for borrowing money or earned for lending it.',
      'Central-bank policy rates influence financial conditions, but a policy change does not determine a particular asset’s future return. Borrower terms and risks differ.',
    ],
  ].map(([slug, title, summary, body]) => ({
    id: `term-${slug}`,
    version: 1,
    kind: 'term',
    title: title!,
    summary: summary!,
    body: body!,
    topics: ['Basics'],
    publishedAt: '2026-09-13T00:00:00.000Z',
    effectiveLabel: 'Educational definition · authored content',
    source: {
      name: 'Fingent360 editorial glossary',
      url:
        slug === 'inflation'
          ? 'https://www.federalreserve.gov/faqs/economy_14419.htm'
          : slug === 'gdp'
            ? 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG'
            : 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm',
      retrievedAt: now,
      rights:
        'Original educational content authored in this repository, not provider news. No investment advice.',
    },
    sourceHash: null,
    importance: 1,
    relatedIds: [],
    status: 'draft',
    correctionNote: null,
    reviewedAt: null,
  }));
}
