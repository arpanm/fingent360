import { z } from 'zod';
const text = z.string().trim().min(1);
const url = z.url().refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
});
export const CompanyNewsCitationSchema = z.strictObject({
  name: text.max(160),
  url,
  originator: text.max(120),
  primary: z.boolean(),
  publishedAt: z.iso.datetime(),
  retrievedAt: z.iso.datetime(),
  rightsMode: z.enum(['link-only', 'full-text']),
  termsUrl: url,
  permissionReference: text.min(12).max(2000),
  linkingAllowed: z.literal(true),
  offlineAllowed: z.literal(true),
  noExpiryConfirmed: z.literal(true),
  independentReporting: z.boolean(),
});
export const CompanyNewsInputSchema = z
  .strictObject({
    requestId: z.uuid(),
    isin: z.string().regex(/^IN[A-Z0-9]{9}[0-9]$/),
    title: text.max(240),
    summary: text.max(1200),
    copiedText: z.string().max(6000),
    copiedFrom: z.number().int().min(0).max(5).nullable(),
    citations: z.array(CompanyNewsCitationSchema).min(2).max(6),
    verification: text.min(20).max(3000),
    conflicts: z.enum(['none-found', 'unresolved']),
    originalEditorialConfirmed: z.literal(true),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.citations.map((row) => row.url)).size !==
      value.citations.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['citations'],
        message: 'Duplicate source URLs do not corroborate a report.',
      });
    if (
      value.copiedText &&
      (value.copiedFrom === null ||
        value.citations[value.copiedFrom]?.rightsMode !== 'full-text')
    )
      ctx.addIssue({
        code: 'custom',
        path: ['copiedText'],
        message:
          'Copied content requires the exact cited source full-text permission.',
      });
    if (!value.copiedText && value.copiedFrom !== null)
      ctx.addIssue({
        code: 'custom',
        path: ['copiedFrom'],
        message: 'No copied source can be selected without content.',
      });
    if (value.copiedFrom !== null && value.copiedFrom >= value.citations.length)
      ctx.addIssue({
        code: 'custom',
        path: ['copiedFrom'],
        message: 'Copied source is missing.',
      });
  });
export const CompanyNewsProofSchema = z.strictObject({
  policy: z.literal('company-news-two-originators-v1'),
  isin: z.string(),
  companyName: z.string(),
  identityEditionId: z.uuid(),
  identityHash: z.string().regex(/^[a-f0-9]{64}$/),
  checkedAt: z.iso.datetime(),
  basis: z.literal('recorded-editor-and-reviewer-verification'),
  sources: z
    .array(
      z.strictObject({
        name: text.max(160),
        url,
        originator: text.max(120),
        primary: z.boolean(),
        independentReporting: z.boolean(),
        publishedAt: z.iso.datetime(),
        retrievedAt: z.iso.datetime(),
        rightsMode: z.enum(['link-only', 'full-text']),
      }),
    )
    .min(2)
    .max(6),
});
export const CompanyNewsReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.string().regex(/^company-news-[a-f0-9-]{36}$/),
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['publish', 'withdraw']),
  reason: text.min(12).max(2000),
  corroborationConfirmed: z.boolean(),
  rightsConfirmed: z.boolean(),
});
export const CompanyNewsQueueSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.string(),
        version: z.number().int().positive(),
        state: z.enum(['draft', 'published', 'withdrawn']),
        companyName: z.string(),
        input: CompanyNewsInputSchema,
      }),
    )
    .max(100),
  truncated: z.boolean(),
});
export function companyNewsReasons(
  input: z.infer<typeof CompanyNewsInputSchema>,
  now: string,
) {
  const reasons: string[] = [];
  if (input.conflicts !== 'none-found')
    reasons.push('Resolve conflicting evidence before publishing.');
  const independent = input.citations.filter((row) => row.independentReporting);
  if (!independent.some((row) => row.primary))
    reasons.push(
      'An independently originated primary filing or release is required.',
    );
  if (
    new Set(
      independent
        .map((row) => row.originator.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter(Boolean),
    ).size < 2
  )
    reasons.push(
      'Two independent originators are required; syndication and mirrored filings count once.',
    );
  const at = Date.parse(now);
  if (
    input.citations.some(
      (row) =>
        Date.parse(row.publishedAt) > Date.parse(row.retrievedAt) ||
        Date.parse(row.retrievedAt) > at ||
        at - Date.parse(row.retrievedAt) > 7 * 86400000,
    )
  )
    reasons.push(
      'Sources must be rechecked within seven days, with valid publication/retrieval times.',
    );
  return reasons;
}
