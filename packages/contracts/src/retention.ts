import { z } from 'zod';

export const retentionPolicy = 'expired-records-v1' as const;
export const retentionScopes = [
  {
    id: 'account-sessions',
    label: 'Expired account sessions',
    limit: 100,
    action: 'delete',
  },
  {
    id: 'operator-sessions',
    label: 'Expired operations sessions',
    limit: 100,
    action: 'delete',
  },
  {
    id: 'account-login-attempts',
    label: 'Expired account sign-in counters',
    limit: 100,
    action: 'delete',
  },
  {
    id: 'operator-login-attempts',
    label: 'Expired operations sign-in counters',
    limit: 100,
    action: 'delete',
  },
  {
    id: 'recovery-attempts',
    label: 'Expired recovery counters',
    limit: 100,
    action: 'delete',
  },
  {
    id: 'feedback-content',
    label: 'Expired feedback content and attachments',
    limit: 20,
    action: 'scrub',
  },
  {
    id: 'feedback-rate-windows',
    label: 'Feedback rate counters older than two days',
    limit: 100,
    action: 'delete',
  },
  {
    id: 'holding-previews',
    label: 'Expired unconfirmed holdings previews',
    limit: 100,
    action: 'delete',
  },
] as const;
export const RetentionScopeSchema = z.enum(
  retentionScopes.map((scope) => scope.id),
);
export type RetentionScope = z.infer<typeof RetentionScopeSchema>;
export const RetentionCountSchema = z
  .strictObject({
    scope: RetentionScopeSchema,
    count: z.number().int().nonnegative().max(100),
    moreAvailable: z.boolean(),
  })
  .refine(
    (value) =>
      value.count <=
      retentionScopes.find((scope) => scope.id === value.scope)!.limit,
    'Count exceeds the scope batch limit.',
  );
export const RetentionCountsSchema = z
  .array(RetentionCountSchema)
  .length(retentionScopes.length)
  .refine(
    (values) =>
      values.every(
        (value, index) => value.scope === retentionScopes[index]!.id,
      ),
    'Include each retention scope once in policy order.',
  );
export const RetentionPreviewInputSchema = z.strictObject({
  requestId: z.uuid(),
});
export const RetentionExecuteInputSchema = z.strictObject({
  confirm: z.literal(true),
});
export const RetentionRecordSchema = z
  .strictObject({
    id: z.uuid(),
    policyVersion: z.literal(retentionPolicy),
    createdAt: z.iso.datetime(),
    cutoffAt: z.iso.datetime(),
    status: z.enum(['ready', 'completed', 'failed']),
    attempts: z.number().int().nonnegative(),
    lastAttemptAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    preview: RetentionCountsSchema,
    result: RetentionCountsSchema.nullable(),
  })
  .superRefine((record, context) => {
    const completed = record.status === 'completed';
    if (completed !== (record.result !== null && record.completedAt !== null))
      context.addIssue({
        code: 'custom',
        message:
          'Completed cleanup requires its recorded result and completion time.',
      });
    if (!completed && (record.result !== null || record.completedAt !== null))
      context.addIssue({
        code: 'custom',
        message: 'Unfinished cleanup cannot contain a completed result.',
      });
    if (
      (record.attempts === 0) !== (record.lastAttemptAt === null) ||
      (record.status === 'ready') !== (record.attempts === 0)
    )
      context.addIssue({
        code: 'custom',
        message: 'Cleanup status must agree with its recorded attempts.',
      });
  });
export const RetentionHistorySchema = z.strictObject({
  records: z.array(RetentionRecordSchema).max(20),
  nextCursor: z.string().max(200).nullable(),
});
export const RetentionHistoryQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(200).optional(),
});
export type RetentionRecord = z.infer<typeof RetentionRecordSchema>;
export type RetentionCount = z.infer<typeof RetentionCountSchema>;
