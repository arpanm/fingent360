import { z } from 'zod';
import { validIndianIsin } from './holdings.js';

export const IndianIsinSchema = z
  .string()
  .refine(validIndianIsin, 'Enter a checksum-valid Indian ISIN.');
export const SecurityCandidateSchema = z.strictObject({
  figi: z.string().regex(/^[A-Z0-9]{12}$/),
  name: z.string().min(1).max(300),
  ticker: z.string().min(1).max(100),
  exchCode: z.literal('IN'),
  securityType: z.literal('Common Stock'),
  marketSector: z.literal('Equity'),
  compositeFIGI: z
    .string()
    .regex(/^[A-Z0-9]{12}$/)
    .nullable(),
  shareClassFIGI: z
    .string()
    .regex(/^[A-Z0-9]{12}$/)
    .nullable(),
});
export const SecurityIdentitySchema = z.strictObject({
  isin: IndianIsinSchema,
  version: z.number().int().positive(),
  resolution: z.enum(['matched', 'ambiguous', 'unresolved']),
  candidates: z.array(SecurityCandidateSchema).max(100),
  retrievedAt: z.iso.datetime(),
  checkedAt: z.iso.datetime(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  source: z.literal('OpenFIGI'),
  sourceUrl: z.literal('https://api.openfigi.com/v3/mapping'),
  termsUrl: z.literal('https://www.openfigi.com/docs/terms-of-service'),
  mappingPolicy: z.literal('india-common-stock-v1'),
});
export const SecurityDirectorySchema = z.strictObject({
  items: z.array(SecurityIdentitySchema).max(200),
  limited: z.boolean(),
});
export const SecurityHistorySchema = z.strictObject({
  revisions: z.array(SecurityIdentitySchema),
});
export const SecurityEvidenceSchema = z.strictObject({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.iso.datetime(),
  url: z.literal('https://api.openfigi.com/v3/mapping'),
  isin: IndianIsinSchema,
  body: z.string().max(200000),
});
export const SecurityRefreshInputSchema = z.strictObject({
  requestId: z.uuid(),
  isins: z
    .array(IndianIsinSchema)
    .min(1)
    .max(5)
    .refine((v) => new Set(v).size === v.length, 'Remove duplicate ISINs.'),
});
export const SecurityRunSchema = z.strictObject({
  id: z.uuid(),
  isins: z.array(IndianIsinSchema).min(1).max(5),
  status: z.enum(['running', 'completed', 'failed']),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  outcomes: z
    .array(
      z.strictObject({
        isin: IndianIsinSchema,
        status: z.enum(['matched', 'ambiguous', 'unresolved', 'failed']),
        version: z.number().int().positive().nullable(),
        message: z.string().max(400),
      }),
    )
    .max(5),
});
export const SecurityRunsSchema = z.strictObject({
  runs: z.array(SecurityRunSchema).max(20),
});
export type SecurityIdentity = z.infer<typeof SecurityIdentitySchema>;
export type SecurityRun = z.infer<typeof SecurityRunSchema>;
export type SecurityEvidence = z.infer<typeof SecurityEvidenceSchema>;

// Provider schema is intentionally exact. New upstream fields require review.
const ProviderCandidateSchema = z.strictObject({
  figi: z.string().regex(/^[A-Z0-9]{12}$/),
  name: z.string().nullable(),
  ticker: z.string().nullable(),
  exchCode: z.string().nullable(),
  securityType: z.string().nullable(),
  marketSector: z.string().nullable(),
  compositeFIGI: z.string().nullable(),
  shareClassFIGI: z.string().nullable(),
  securityType2: z.string().nullable(),
  securityDescription: z.string().nullable(),
});
const ProviderResultSchema = z
  .array(
    z.union([
      z.strictObject({ data: z.array(ProviderCandidateSchema).max(100) }),
      z.strictObject({ warning: z.string().max(500) }),
      z.strictObject({ error: z.string().max(500) }),
    ]),
  )
  .length(1);
export function parseSecurityMapping(raw: unknown) {
  const result = ProviderResultSchema.parse(raw)[0]!;
  if ('error' in result)
    throw Error(
      'The identifier provider could not complete this mapping. Retry later.',
    );
  if ('warning' in result) {
    if (!/no identifier found/i.test(result.warning))
      throw Error('The identifier provider returned an unrecognized warning.');
    return { resolution: 'unresolved' as const, candidates: [] };
  }
  const candidates = result.data
    .map(({ securityType2, securityDescription, ...v }) => {
      void securityDescription;
      if (securityType2 !== 'Common Stock')
        throw Error('The mapping is not an Indian common stock.');
      return SecurityCandidateSchema.parse(v);
    })
    .sort((a, b) => a.figi.localeCompare(b.figi));
  if (new Set(candidates.map((v) => v.figi)).size !== candidates.length)
    throw Error('Duplicate provider identifiers require review.');
  return {
    resolution:
      candidates.length === 1
        ? ('matched' as const)
        : candidates.length
          ? ('ambiguous' as const)
          : ('unresolved' as const),
    candidates,
  };
}
