import { createHash } from 'node:crypto';
import { FeedItemSchema, parseBeaGdpOriginal } from '@fingent360/contracts';
import { sourceHash } from './discovery-provider.js';
export const BEA_GDP_ORIGINAL_RIGHTS =
  'Original BEA-authored numerical release excerpt; public domain unless otherwise marked. Attribute the U.S. Bureau of Economic Analysis. No endorsement, external imagery or current interactive-table substitution.';
export function originalGdpItem(raw: {
  url: string;
  body: string;
  hash: string;
  retrievedAt: string;
}) {
  if (sourceHash(raw.url, raw.body) !== raw.hash)
    throw Error('Original GDP source hash mismatch.');
  const original = parseBeaGdpOriginal(raw);
  return FeedItemSchema.parse({
    id:
      'gdp-original-' +
      createHash('sha256').update(raw.url).digest('hex').slice(0, 32),
    version: 1,
    kind: 'news',
    title: `US real GDP ${original.period} — ${original.estimate} estimate`,
    summary: original.excerpt,
    body: original.excerpt,
    topics: ['GDP', 'United States'],
    publishedAt: original.publishedAt,
    effectiveLabel: `Original ${original.period} ${original.estimate} estimate; real quarterly annualized percent`,
    source: {
      name: 'U.S. Bureau of Economic Analysis',
      url: raw.url,
      retrievedAt: raw.retrievedAt,
      rights: BEA_GDP_ORIGINAL_RIGHTS,
    },
    sourceHash: raw.hash,
    gdpOriginal: original,
    importance: 2,
    relatedIds: [],
    status: 'draft',
    reviewedAt: null,
    correctionNote: null,
  });
}
