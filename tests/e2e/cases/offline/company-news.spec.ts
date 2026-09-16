import { test, expect } from '@playwright/test';
import {
  FeedItemSchema,
  publicEdition,
  currentPublications,
} from '../../../../packages/contracts/src/index';
test('E2E-OFFLINE-1300 packaged company proof survives parsing and disappears from retained history after withdrawal @SRC-012 @TEST-SIMULATION', async () => {
  const now = '2026-09-15T00:00:00.000Z';
  const item = FeedItemSchema.parse({
    id: 'company-news-10000000-0000-4000-8000-000000000001',
    version: 1,
    kind: 'news',
    title: 'Synthetic news',
    summary: 'Synthetic',
    body: 'Synthetic',
    topics: [],
    publishedAt: now,
    effectiveLabel: 'Synthetic',
    source: {
      name: 'Synthetic',
      url: 'https://example.com/issuer',
      retrievedAt: now,
      rights: 'Synthetic only',
    },
    sourceHash: null,
    importance: 2,
    relatedIds: [],
    status: 'published',
    correctionNote: null,
    reviewedAt: now,
    companyNews: {
      policy: 'company-news-two-originators-v1',
      isin: 'INE002A01018',
      companyName: 'Synthetic company',
      identityEditionId: '10000000-0000-4000-8000-000000000002',
      identityHash: 'a'.repeat(64),
      checkedAt: now,
      basis: 'recorded-editor-and-reviewer-verification',
      sources: ['issuer', 'independent'].map((name) => ({
        name,
        url: `https://example.com/${name}`,
        originator: name,
        primary: name === 'issuer',
        independentReporting: true,
        publishedAt: now,
        retrievedAt: now,
        rightsMode: 'link-only',
      })),
    },
  });
  expect(
    FeedItemSchema.parse(JSON.parse(JSON.stringify(item))).companyNews?.sources,
  ).toHaveLength(2);
  expect(publicEdition(item, true).companyNews).toBeUndefined();
  const withdrawn = { ...item, version: 2, status: 'withdrawn' as const };
  expect(
    publicEdition(currentPublications([withdrawn], { [item.id]: [item] })[0]!)
      .companyNews,
  ).toBeUndefined();
});
