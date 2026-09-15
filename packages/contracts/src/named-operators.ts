import { IdentitySelectionReviewSchema } from './identity-selection.js';
import { z } from 'zod';
import { EventReviewSchema } from './events.js';
import { EcbRateReviewSchema } from './ecb-rates.js';
import { OilBenchmarkReviewSchema } from './oil-benchmarks.js';
import { EventLineageReviewSchema } from './event-lineage.js';
import { EcbFxReviewSchema } from './ecb-fx.js';
import { DiscoveryReviewSchema } from './discovery.js';
import { SourceInputSchema, SourceUpdateSchema } from './sources.js';
import {
  OperatorRoleSchema,
  OperatorIdentitySchema,
} from './operator-identity.js';
export {
  OperatorRoleSchema,
  OperatorIdentitySchema,
  type OperatorRole,
} from './operator-identity.js';
export const NamedOperatorLoginSchema = z.strictObject({
  username: z.string().regex(/^[a-z][a-z0-9_]{2,39}$/),
  password: z.string().min(12).max(128),
});
export const OperatorCreateSchema = NamedOperatorLoginSchema.extend({
  role: OperatorRoleSchema,
});
export const OperatorUpdateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  role: OperatorRoleSchema,
  enabled: z.boolean(),
});
export const OperatorRosterSchema = z.strictObject({
  operators: z.array(OperatorIdentitySchema).max(50),
});
export const PublicationProposalInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('ecb-fx'),
    target: z.literal('ecb-reference-fx'),
    body: EcbFxReviewSchema,
  }),
  z.strictObject({
    kind: z.literal('identity-selection'),
    target: z.uuid(),
    body: IdentitySelectionReviewSchema,
  }),
  z.strictObject({
    kind: z.literal('event-lineage'),
    target: z.uuid(),
    body: EventLineageReviewSchema,
  }),
  z.strictObject({
    kind: z.literal('discovery'),
    target: z.string().min(1).max(180),
    body: DiscoveryReviewSchema,
  }),
  z.strictObject({
    kind: z.literal('event'),
    target: z.uuid(),
    body: EventReviewSchema,
  }),
  z.strictObject({
    kind: z.literal('ecb-rates'),
    target: z.literal('ecb-policy-rates'),
    body: EcbRateReviewSchema,
  }),
  z.strictObject({
    kind: z.literal('oil-benchmarks'),
    target: z.literal('world-bank-oil-benchmarks'),
    body: OilBenchmarkReviewSchema,
  }),
  z.strictObject({
    kind: z.literal('media'),
    target: z.string().min(1).max(180),
    body: z.strictObject({
      assetId: z.uuid(),
      publish: z.boolean(),
      imageAttemptId: z.uuid().optional(),
    }),
  }),
  z.strictObject({
    kind: z.literal('source-create'),
    target: z.literal('new'),
    body: SourceInputSchema,
  }),
  z.strictObject({
    kind: z.literal('source-update'),
    target: z.uuid(),
    body: SourceUpdateSchema,
  }),
]);
export type PublicationProposalInput = z.infer<
  typeof PublicationProposalInputSchema
>;
export const PublicationProposalSchema = z
  .strictObject({
    id: z.uuid(),
    sequence: z.string().regex(/^[1-9][0-9]*$/),
    input: PublicationProposalInputSchema,
    proposer: OperatorIdentitySchema,
    createdAt: z.iso.datetime(),
    state: z.enum(['pending', 'approved', 'rejected']),
    reviewer: OperatorIdentitySchema.nullable(),
    reviewedAt: z.iso.datetime().nullable(),
    note: z.string().max(1000).nullable(),
    actionResult: z
      .strictObject({
        sourceId: z.uuid(),
        revision: z.number().int().positive(),
      })
      .nullable(),
  })
  .superRefine((value, context) => {
    if (
      (value.state === 'approved' && value.input.kind === 'source-create') !==
      (value.actionResult !== null)
    )
      context.addIssue({
        code: 'custom',
        message: 'Created source approval must identify its committed record.',
      });
    const pending = value.state === 'pending';
    if (
      pending
        ? value.reviewer !== null ||
          value.reviewedAt !== null ||
          value.note !== null
        : !value.reviewer ||
          !value.reviewedAt ||
          !value.note?.trim() ||
          value.reviewer.id === value.proposer.id ||
          Date.parse(value.reviewedAt) < Date.parse(value.createdAt)
    )
      context.addIssue({
        code: 'custom',
        message: 'Proposal decision identity and chronology do not reconcile.',
      });
  });
export const PublicationProposalPageSchema = z.strictObject({
  proposals: z.array(PublicationProposalSchema).max(50),
  next: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .nullable(),
});
export const PublicationDecisionSchema = z.strictObject({
  note: z.string().trim().min(1).max(1000),
});
export const OperatorPageQuerySchema = z.strictObject({
  after: z
    .string()
    .regex(/^[1-9][0-9]{0,18}$/)
    .refine(
      (value) =>
        /^[1-9][0-9]{0,18}$/.test(value) &&
        BigInt(value) <= 9223372036854775807n,
    )
    .optional(),
});
