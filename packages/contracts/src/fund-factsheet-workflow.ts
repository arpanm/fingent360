import { z } from 'zod';
import {
  FactsheetUrlSchema,
  FactsheetValuesSchema,
  FACTSHEET_PARSER,
  FACTSHEET_SCHEME,
} from './fund-factsheet.js';
import { FundNavSchema } from './funds-bonds.js';
export const FactsheetCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  sourceUrl: FactsheetUrlSchema,
  body: z.string().min(1).max(1000000),
  permissionReference: z.string().trim().min(20).max(2000),
  rightsConfirmed: z.literal(true),
});
export const FactsheetMappingSchema = z.strictObject({
  plan: z.enum(['Direct', 'Regular']),
  schemeCode: z.string().regex(/^[0-9]{5,8}$/),
  navEditionId: z.uuid(),
  identity: FundNavSchema,
});
export const FactsheetReviewSchema = z.strictObject({
  requestId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(10).max(1000),
  plans: z
    .array(
      z.strictObject({
        plan: z.enum(['Direct', 'Regular']),
        schemeCode: z.string().regex(/^[0-9]{5,8}$/),
      }),
    )
    .length(2)
    .optional(),
});
export const FactsheetEditionSchema = z
  .strictObject({
    id: z.uuid(),
    parser: z.literal(FACTSHEET_PARSER),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    sourceUrl: FactsheetUrlSchema,
    retrievedAt: z.iso.datetime(),
    values: FactsheetValuesSchema.nullable(),
    error: z.string().nullable(),
    state: z.enum(['draft', 'quarantined', 'published', 'withdrawn']),
    mappings: z.array(FactsheetMappingSchema).max(2),
    reviewedAt: z.iso.datetime().nullable(),
  })
  .superRefine((e, c) => {
    if (
      e.mappings.some(
        (m) =>
          m.schemeCode !== m.identity.schemeCode ||
          !factsheetIdentityMatches(m.identity, m.plan),
      ) ||
      (e.state === 'published' &&
        (!e.values ||
          e.mappings.length !== 2 ||
          new Set(e.mappings.map((m) => m.plan)).size !== 2 ||
          new Set(e.mappings.map((m) => m.schemeCode)).size !== 2))
    )
      c.addIssue({
        code: 'custom',
        message: 'Factsheet plan mapping does not match admitted identities.',
      });
  });
export const FactsheetCursorSchema = z
  .string()
  .max(80)
  .refine((value) => {
    const parts = value.split('|');
    return (
      parts.length === 2 &&
      z.iso.datetime().safeParse(parts[0]).success &&
      z.uuid().safeParse(parts[1]).success
    );
  }, 'Invalid factsheet page cursor.');
export const FactsheetPageSchema = z.strictObject({
  cursor: FactsheetCursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(30).default(30),
});
export const FactsheetListSchema = z.strictObject({
  editions: z.array(FactsheetEditionSchema).max(100),
  nextCursor: FactsheetCursorSchema.nullable().default(null),
});
export const FactsheetSnapshotSchema = FactsheetListSchema.extend({
  capturedAt: z.iso.datetime(),
}).superRefine((value, context) => {
  if (value.nextCursor !== null)
    context.addIssue({
      code: 'custom',
      message: 'An incomplete factsheet page cannot be an offline snapshot.',
    });
});
export function factsheetIdentityMatches(
  identity: z.infer<typeof FundNavSchema>,
  plan: 'Direct' | 'Regular',
) {
  // Explicit AMFI plan fields are required; no plan/cost is inferred from a code.
  return (
    /^Kotak (?:Mahindra )?Mutual Fund$/i.test(identity.amc) &&
    identity.name.toLowerCase() === FACTSHEET_SCHEME.toLowerCase() &&
    [plan.toLowerCase(), plan.toLowerCase() + ' plan'].includes(
      identity.plan?.toLowerCase() ?? '',
    )
  );
}

export function factsheetIdentityKey(identity: z.infer<typeof FundNavSchema>) {
  return JSON.stringify([
    identity.schemeCode,
    identity.name,
    identity.amc,
    identity.category,
    identity.plan ?? null,
    identity.option ?? null,
    identity.payoutIsin,
    identity.reinvestmentIsin,
  ]);
}
