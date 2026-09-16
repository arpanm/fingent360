import { z } from 'zod';
export const RegulatoryAuthoritySchema = z.enum([
  'sebi',
  'rbi',
  'income-tax',
  'finance-ministry',
]);
export const REGULATORY_HOSTS = {
  sebi: ['www.sebi.gov.in', 'sebi.gov.in'],
  rbi: ['www.rbi.org.in', 'rbi.org.in'],
  'income-tax': ['www.incometax.gov.in', 'www.incometaxindia.gov.in'],
  'finance-ministry': [
    'www.indiabudget.gov.in',
    'indiabudget.gov.in',
    'dea.gov.in',
    'www.finmin.gov.in',
    'finmin.gov.in',
  ],
} as const;
export const RegulatoryDateSchema = z.discriminatedUnion('precision', [
  z.strictObject({ precision: z.literal('unknown'), value: z.null() }),
  z.strictObject({
    precision: z.literal('year'),
    value: z.string().regex(/^(19|20)\d{2}$/),
  }),
  z.strictObject({
    precision: z.literal('month'),
    value: z.string().regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/),
  }),
  z.strictObject({ precision: z.literal('day'), value: z.iso.date() }),
]);
export const RegulatoryMetadataSchema = z
  .strictObject({
    documentKey: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/),
    authority: RegulatoryAuthoritySchema,
    title: z.string().trim().min(5).max(240),
    kind: z.enum(['regulation', 'circular', 'act', 'bill', 'faq', 'notice']),
    sourceUrl: z.url().max(2000),
    jurisdiction: z.literal('India'),
    scope: z.string().trim().min(10).max(800),
    summary: z.string().trim().min(20).max(1200),
    publication: RegulatoryDateSchema,
    effective: RegulatoryDateSchema,
    dateEvidence: z.string().trim().min(20).max(2000),
    supersedes: z.uuid().nullable(),
    reviewBy: z.iso.date(),
  })
  .superRefine((value, ctx) => {
    const url = new URL(value.sourceUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      !(REGULATORY_HOSTS[value.authority] as readonly string[]).includes(
        url.hostname,
      )
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use an original allowlisted authority HTTPS URL.',
      });
  });
export const RegulatoryCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  metadata: RegulatoryMetadataSchema,
  rightsReference: z.string().trim().min(20).max(2000),
  mime: z.enum(['application/pdf', 'text/html']),
  bodyBase64: z
    .string()
    .max(2000000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
    .optional(),
  retrievedAt: z.iso.datetime().optional(),
});
export const RegulatoryReviewSchema = z.strictObject({
  requestId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(2000),
  originalReviewed: z.boolean(),
});
export const RegulatoryEditionSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  metadata: RegulatoryMetadataSchema,
  mime: z.enum(['application/pdf', 'text/html']),
  retrievedAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  acquisition: z.enum(['server-fetch', 'operator-upload']),
  state: z.enum([
    'draft',
    'quarantined',
    'published',
    'stale',
    'withdrawn',
    'superseded',
  ]),
  error: z.string().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  adviceEnabled: z.literal(false),
  applicability: z.literal('not-assessed'),
});
export const RegulatoryListSchema = z.strictObject({
  enabled: z.boolean(),
  editions: z.array(RegulatoryEditionSchema).max(100),
  nextCursor: z.string().max(100).nullable().default(null),
});
export const RegulatorySnapshotSchema = RegulatoryListSchema.extend({
  capturedAt: z.iso.datetime(),
});
export const RegulatoryEvidenceSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  mime: z.enum(['application/pdf', 'text/html']),
  bodyBase64: z.string().max(2000000),
  rightsReference: z.string().min(20).max(2000),
});
export type RegulatoryEdition = z.infer<typeof RegulatoryEditionSchema>;
