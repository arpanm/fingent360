import { createHash } from 'node:crypto';
import {
  BEA_FEED,
  BEA_NAME,
  BEA_RIGHTS,
  BEA_SCOPE,
  beaReleaseFields,
  FeedItemSchema,
} from '@fingent360/contracts';
import { sourceHash } from './discovery-provider.js';
export function parseBeaRss(xml: string, retrievedAt: string) {
  const hash = sourceHash(BEA_FEED, xml);
  return beaReleaseFields(xml, retrievedAt).map((release) =>
    FeedItemSchema.parse({
      id: `bea-${createHash('sha256').update(release.url).digest('hex').slice(0, 32)}`,
      version: 1,
      kind: 'news',
      title: release.title,
      summary: release.title,
      body: release.title,
      topics: ['Global economy'],
      publishedAt: release.publishedAt,
      effectiveLabel: BEA_SCOPE,
      source: {
        name: BEA_NAME,
        url: release.url,
        retrievedAt,
        rights: BEA_RIGHTS,
      },
      sourceHash: hash,
      importance: 2,
      relatedIds: [],
      status: 'draft',
      correctionNote: null,
      reviewedAt: null,
    }),
  );
}
