import { z } from 'zod';
import {
  IndianIsinSchema,
  SecurityIdentitySchema,
  SecurityCandidateSchema,
} from './securities.js';
export const IdentitySelectionInputSchema = z.strictObject({
  isin: IndianIsinSchema,
  action: z.enum(['select', 'withdraw']),
  expectedVersion: z.number().int().nonnegative().max(2147483646),
  providerVersion: z.number().int().positive().max(2147483647),
  providerHash: z.string().regex(/^[a-f0-9]{64}$/),
  figi: z.string().regex(/^[A-Z0-9]{12}$/),
  rationale: z.string().trim().min(20).max(1500),
});
export const IdentitySelectionPlanSchema = z
  .strictObject({
    id: z.uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.iso.datetime(),
    input: IdentitySelectionInputSchema,
    provider: SecurityIdentitySchema,
    candidate: SecurityCandidateSchema,
  })
  .superRefine((value, context) => {
    if (
      Date.parse(value.createdAt) < Date.parse(value.provider.retrievedAt) ||
      value.provider.resolution !==
        (value.provider.candidates.length === 1
          ? 'matched'
          : value.provider.candidates.length
            ? 'ambiguous'
            : 'unresolved') ||
      value.provider.isin !== value.input.isin ||
      value.provider.version !== value.input.providerVersion ||
      value.provider.sourceHash !== value.input.providerHash ||
      value.candidate.figi !== value.input.figi ||
      !value.provider.candidates.some(
        (item) => JSON.stringify(item) === JSON.stringify(value.candidate),
      )
    )
      context.addIssue({
        code: 'custom',
        message:
          'Selection must bind an actual candidate in the exact retained provider edition.',
      });
  });
export const IdentitySelectionReceiptSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive().max(2147483647),
  isin: IndianIsinSchema,
  providerVersion: z.number().int().positive().max(2147483647),
  providerHash: z.string().regex(/^[a-f0-9]{64}$/),
  candidate: SecurityCandidateSchema,
  rationale: z.string().min(20).max(1500),
  reviewedAt: z.iso.datetime(),
  method: z.literal('editorial-judgement'),
  status: z.enum(['approved', 'withdrawn']),
});
export const IdentitySelectionReviewSchema = z.strictObject({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(['approved', 'withdrawn']),
});
export const IdentitySelectionPublicSchema = z
  .strictObject({
    isin: IndianIsinSchema,
    state: z.enum(['none', 'current', 'stale', 'withdrawn']),
    receipt: IdentitySelectionReceiptSchema.nullable(),
    evaluatedAt: z.iso.datetime(),
  })
  .superRefine((value, context) => {
    if (
      (value.state === 'none') !== (value.receipt === null) ||
      (value.receipt &&
        (value.receipt.isin !== value.isin ||
          (value.state === 'withdrawn') !==
            (value.receipt.status === 'withdrawn')))
    )
      context.addIssue({
        code: 'custom',
        message: 'Selection state and exact receipt must agree.',
      });
  });
export const IdentitySelectionOperationsSchema = z
  .strictObject({
    plan: IdentitySelectionPlanSchema,
    receipt: IdentitySelectionReceiptSchema.nullable(),
  })
  .superRefine(({ plan, receipt }, context) => {
    if (
      receipt &&
      (receipt.id !== plan.id ||
        receipt.isin !== plan.input.isin ||
        receipt.version !== plan.input.expectedVersion + 1 ||
        receipt.providerVersion !== plan.input.providerVersion ||
        receipt.providerHash !== plan.input.providerHash ||
        receipt.rationale !== plan.input.rationale ||
        JSON.stringify(receipt.candidate) !== JSON.stringify(plan.candidate) ||
        receipt.status !==
          (plan.input.action === 'select' ? 'approved' : 'withdrawn') ||
        Date.parse(receipt.reviewedAt) < Date.parse(plan.createdAt))
    )
      context.addIssue({
        code: 'custom',
        message: 'Decision must bind the exact saved plan and its version.',
      });
  });
export const IdentitySelectionHistorySchema = z.strictObject({
  receipts: z.array(IdentitySelectionReceiptSchema).max(20),
  nextBefore: z.number().int().positive().nullable(),
});
export const IdentitySelectionPlansSchema = z.strictObject({
  plans: z.array(IdentitySelectionPlanSchema).max(20),
  next: z.uuid().nullable(),
});
export function selectionMatchesProvider(
  selection: z.infer<typeof IdentitySelectionReceiptSchema>,
  identity: z.infer<typeof SecurityIdentitySchema>,
) {
  return (
    identity.resolution ===
      (identity.candidates.length === 1
        ? 'matched'
        : identity.candidates.length
          ? 'ambiguous'
          : 'unresolved') &&
    selection.status === 'approved' &&
    selection.isin === identity.isin &&
    selection.providerVersion === identity.version &&
    selection.providerHash === identity.sourceHash &&
    identity.candidates.some(
      (candidate) =>
        JSON.stringify(candidate) === JSON.stringify(selection.candidate),
    )
  );
}

export function eventSelectionsCurrent(
  event: {
    editorial: {
      links: Array<{
        kind: string;
        selection?: z.infer<typeof IdentitySelectionReceiptSchema> | undefined;
      }>;
    };
  },
  selections: Record<string, unknown>,
) {
  return event.editorial.links.every((link) => {
    if (!link.selection) return true;
    const current = IdentitySelectionPublicSchema.safeParse(
      selections[link.selection.isin],
    );
    return (
      current.success &&
      current.data.state === 'current' &&
      JSON.stringify(current.data.receipt) === JSON.stringify(link.selection)
    );
  });
}
