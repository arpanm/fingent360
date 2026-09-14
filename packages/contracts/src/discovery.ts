import { z } from 'zod';
export const DiscoveryIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/);
const PublicUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
});
export const FeedItemSchema = z.strictObject({
  id: DiscoveryIdSchema,
  version: z.number().int().positive(),
  kind: z.enum(['news', 'term', 'annual']),
  title: z.string().min(1).max(500),
  summary: z.string().max(3000),
  body: z.string().max(10000),
  topics: z.array(z.string().max(80)).max(12),
  publishedAt: z.iso.datetime(),
  effectiveLabel: z.string().max(160),
  source: z.strictObject({
    name: z.string().max(200),
    url: PublicUrl,
    retrievedAt: z.iso.datetime(),
    rights: z.string().max(2000),
  }),
  sourceHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  importance: z.number().int().min(1).max(3),
  relatedIds: z.array(DiscoveryIdSchema).max(12),
  status: z.enum(['draft', 'published', 'withdrawn']),
  correctionNote: z.string().max(2000).nullable(),
  reviewedAt: z.iso.datetime().nullable(),
});
export const FeedSchema = z.strictObject({
  items: z.array(FeedItemSchema),
  evaluatedAt: z.iso.datetime(),
  nextCursor: z.string().nullable(),
});
export const DiscoveryRunSchema = z.strictObject({
  id: z.uuid(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  status: z.enum(['running', 'succeeded', 'failed']),
  message: z.string(),
  inserted: z.number().int().nonnegative(),
});
export const DiscoveryOperationsSchema = z.strictObject({
  items: z.array(FeedItemSchema),
  latestRun: DiscoveryRunSchema.nullable(),
});
export const DiscoveryReviewSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  status: z.enum(['published', 'withdrawn']),
  correctionNote: z.string().trim().min(1).max(2000),
});
export const DiscoveryEvidenceSchema = z.strictObject({
  scope: z
    .enum(['release-metadata', 'published-edition', 'retained-original'])
    .optional(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  url: PublicUrl,
  retrievedAt: z.iso.datetime(),
  body: z.string().max(1000000),
});
export const PublicDiscoveryEvidenceSchema = DiscoveryEvidenceSchema.refine(
  (value) =>
    value.scope === 'published-edition' || value.scope === 'release-metadata',
  'Only a scoped published excerpt is available here.',
);
export const OperatorSessionSchema = z.strictObject({
  authenticated: z.boolean(),
  expiresAt: z.iso.datetime().nullable(),
});
export type FeedItem = z.infer<typeof FeedItemSchema>;
export type Feed = z.infer<typeof FeedSchema>;
export type DiscoveryRun = z.infer<typeof DiscoveryRunSchema>;
