import { FeedItemSchema, parseFedTargetRange } from '@fingent360/contracts';
import { plain, sourceHash } from './discovery-provider.js';
import type { ResearchRaw } from './research-providers.js';
export const FED_POLICY_HISTORY_URLS = [
  'https://www.federalreserve.gov/newsevents/pressreleases/monetary20240731a.htm',
  'https://www.federalreserve.gov/newsevents/pressreleases/monetary20240918a.htm',
] as const;
export const FED_POLICY_HISTORY_RIGHTS =
  'Historical Board-authored policy statement excerpt; Federal Reserve Board public-domain information with attribution, no endorsement, logos or third-party imagery. https://www.federalreserve.gov/disclaimer.htm';
export function parseHistoricalFedPolicy(raw: Omit<ResearchRaw, 'items'>) {
  const index = FED_POLICY_HISTORY_URLS.findIndex((url) => url === raw.url);
  if (
    index < 0 ||
    raw.hash !== sourceHash(raw.url, raw.body) ||
    Buffer.byteLength(raw.body) > 2000000
  )
    throw Error('Unsupported or inconsistent historical FOMC capture.');
  const text = plain(
    raw.body.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ''),
  );
  const date = index === 0 ? 'July 31, 2024' : 'September 18, 2024';
  if (
    !text.includes(date) ||
    !text.includes('Federal Reserve issues FOMC statement') ||
    !text.includes('2:00 p.m. EDT')
  )
    throw Error('Historical FOMC release metadata changed.');
  const matches = [
    ...text.matchAll(
      /[^.]*the Committee decided to (?:maintain|lower) the target range for the federal funds rate[^.]*\./g,
    ),
  ];
  if (matches.length !== 1)
    throw Error(
      'Historical FOMC target-range statement is missing or ambiguous.',
    );
  const quote = matches[0]![0].trim();
  parseFedTargetRange(quote);
  const day = index === 0 ? '2024-07-31' : '2024-09-18';
  return FeedItemSchema.parse({
    id: `fed-policy-history-${day}`,
    version: 1,
    kind: 'news',
    title: `Historical FOMC target-range decision — ${date}`,
    summary: quote,
    body: quote,
    topics: ['Federal Reserve releases', 'Historical policy decisions'],
    publishedAt: `${day}T18:00:00.000Z`,
    effectiveLabel: 'Historical FOMC statement; not a current rate',
    source: {
      name: 'Federal Reserve Board',
      url: raw.url,
      retrievedAt: raw.retrievedAt,
      rights: FED_POLICY_HISTORY_RIGHTS,
    },
    sourceHash: raw.hash,
    importance: 1,
    relatedIds: [],
    status: 'draft',
    correctionNote: null,
    reviewedAt: null,
  });
}
