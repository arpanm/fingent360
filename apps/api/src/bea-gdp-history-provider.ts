import {
  BEA_GDP_VINTAGES,
  parseBeaGdpAnnualized,
  FeedItemSchema,
} from '@fingent360/contracts';
import { sourceHash } from './discovery-provider.js';
export const BEA_GDP_HISTORY_URLS = BEA_GDP_VINTAGES.map((item) => item.url);
export const BEA_GDP_HISTORY_RIGHTS =
  'BEA-authored US federal statistical information; retain BEA attribution and original release vintage. Historical, superseded estimates.';
export function parseHistoricalBeaGdp(input: {
  url: string;
  body: string;
  hash: string;
  retrievedAt: string;
}) {
  const meta = BEA_GDP_VINTAGES.find((item) => item.url === input.url);
  if (
    !meta ||
    input.body.length > 2_000_000 ||
    sourceHash(input.url, input.body) !== input.hash
  )
    throw Error('Unsupported or inconsistent original BEA GDP source.');
  const plain = input.body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parsed = parseBeaGdpAnnualized(plain);
  if (parsed.period !== '2025-Q2')
    throw Error(
      'BEA source quarter differs from its verified historical release.',
    );
  return FeedItemSchema.parse({
    id: 'bea-gdp-history-2025q2-' + meta.vintage,
    version: 1,
    kind: 'news',
    title: 'Historical US GDP 2025 Q2 — ' + meta.vintage + ' estimate',
    summary: parsed.quote,
    body: parsed.quote,
    topics: ['GDP', 'United States'],
    publishedAt: meta.publishedAt,
    effectiveLabel:
      'Historical 2025-Q2 real quarter-annualized GDP; ' +
      meta.vintage +
      ' estimate; superseded, not current',
    source: {
      name: 'U.S. Bureau of Economic Analysis',
      url: input.url,
      retrievedAt: input.retrievedAt,
      rights: BEA_GDP_HISTORY_RIGHTS,
    },
    sourceHash: input.hash,
    importance: 2,
    relatedIds: [],
    status: 'draft',
    reviewedAt: null,
    correctionNote: null,
  });
}
