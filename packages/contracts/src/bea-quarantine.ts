import { z } from 'zod';
import { FeedItemSchema, DiscoveryIdSchema } from './discovery.js';
export const BEA_RECOVERY_PARSER = 'bea-retained-rss-v1';
const UUID = z.uuid().transform((v) => v.toLowerCase());
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const BeaAttemptEventSchema = z.strictObject({
  id: UUID,
  attemptId: UUID,
  at: z.iso.datetime(),
  kind: z.enum(['started', 'retained', 'parsed', 'staged', 'failed']),
  message: z.string().max(300),
  hash: Hash.nullable(),
  bytes: z.number().int().min(0).max(1000000).nullable(),
  retrievedAt: z.iso.datetime().nullable(),
});
export const BeaAttemptSchema = z.strictObject({
  id: UUID,
  sourceRunId: UUID,
  startedAt: z.iso.datetime(),
  events: z.array(BeaAttemptEventSchema).max(20),
});
export const BeaAttemptPageSchema = z.strictObject({
  attempts: z.array(BeaAttemptSchema).max(30),
  next: UUID.nullable(),
  legacy: z.literal('Legacy unlinked evidence cannot be revalidated.'),
});
export const BeaRevalidateInputSchema = z.strictObject({ requestId: UUID });
export const BeaCandidateSchema = z.strictObject({
  item: FeedItemSchema,
  baseline: FeedItemSchema.nullable(),
});
export const BeaValidationSchema = z.strictObject({
  requestId: UUID,
  attemptId: UUID,
  parser: z.literal(BEA_RECOVERY_PARSER),
  outcome: z.enum(['accepted', 'rejected']),
  message: z.string().max(300),
  hash: Hash,
  validatedAt: z.iso.datetime(),
  candidates: z.array(BeaCandidateSchema).max(200),
  fingerprint: Hash,
});
export const BeaStageInputSchema = z.strictObject({
  requestId: UUID,
  validationId: UUID,
  fingerprint: Hash,
});
export const BeaStageSchema = z.strictObject({
  requestId: UUID,
  validationId: UUID,
  stagedAt: z.iso.datetime(),
  items: z
    .array(
      z.strictObject({
        id: DiscoveryIdSchema,
        version: z.number().int().positive(),
        changed: z.boolean(),
      }),
    )
    .max(200),
});
export const BeaRetainedSchema = z.strictObject({
  attemptId: UUID,
  hash: Hash,
  bytes: z.number().int().max(1000000),
  retrievedAt: z.iso.datetime(),
  body: z.string().max(1000000),
});
export type BeaValidation = z.infer<typeof BeaValidationSchema>;
export const BeaHistorySchema = z.strictObject({
  entries: z
    .array(
      z.strictObject({
        id: UUID,
        at: z.iso.datetime(),
        outcome: z.enum(['accepted', 'rejected']),
        staged: BeaStageSchema.nullable(),
      }),
    )
    .max(30),
  next: UUID.nullable(),
});

export const BeaPageQuerySchema = z.strictObject({ after: UUID.optional() });
