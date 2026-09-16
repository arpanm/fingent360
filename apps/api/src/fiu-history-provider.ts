import {
  FIU_PIB_SOURCE,
  FIU_PUBLISHED_AT,
  parseFiuPenalty,
  FeedItemSchema,
} from '@fingent360/contracts';
import { sourceHash } from './discovery-provider.js';
export const FIU_HISTORY_URLS = [FIU_PIB_SOURCE];
export function parseHistoricalFiu(input: {
  url: string;
  body: string;
  hash: string;
  retrievedAt: string;
}) {
  if (
    input.url !== FIU_PIB_SOURCE ||
    input.body.length > 2_000_000 ||
    sourceHash(input.url, input.body) !== input.hash
  )
    throw Error('Unsupported FIU original capture.');
  const plain = input.body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/Posted On:\s*01 MAR 2024 6:48\s*PM/i.test(plain))
    throw Error('Original FIU publication time missing or changed.');
  const fact = parseFiuPenalty(plain);
  return FeedItemSchema.parse({
    id: 'pib-fiu-historical-2010719',
    version: 1,
    kind: 'news',
    title: 'Historical FIU-IND penalty on Paytm Payments Bank',
    summary: fact.quote,
    body: fact.quote,
    topics: ['Governance', 'India'],
    publishedAt: FIU_PUBLISHED_AT,
    effectiveLabel:
      'Historical enforcement disclosure,1 March2024. Subject is Paytm Payments Bank Ltd; not a listed-parent finding.',
    source: {
      name: 'Ministry of Finance / Press Information Bureau',
      url: FIU_PIB_SOURCE,
      retrievedAt: input.retrievedAt,
      rights:
        'First-party PIB government release, attributed; no third-party material or endorsement.',
    },
    sourceHash: input.hash,
    importance: 1,
    relatedIds: [],
    status: 'draft',
    reviewedAt: null,
    correctionNote: null,
  });
}
