import { z } from 'zod';
export const workerIds = ['reports', 'reminders'] as const;
export const WorkerIdSchema = z.enum(workerIds);
export type WorkerId = z.infer<typeof WorkerIdSchema>;
export const WorkerCountSchema = z.strictObject({
  count: z.number().int().min(0).max(10000),
  moreAvailable: z.boolean(),
});
export const WorkerControlInputSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  paused: z.boolean(),
  confirm: z.literal(true),
});
export const WorkerControlHistoryQuerySchema = z.strictObject({
  before: z.coerce.number().int().positive().max(2147483647).optional(),
});
export const WorkerControlReceiptSchema = z.strictObject({
  requestId: z.uuid(),
  worker: WorkerIdSchema,
  version: z.number().int().positive(),
  paused: z.boolean(),
  recordedAt: z.iso.datetime(),
});
export const WorkerHealthSchema = z.strictObject({
  worker: WorkerIdSchema,
  version: z.number().int().positive(),
  paused: z.boolean(),
  changedAt: z.iso.datetime(),
  heartbeatAt: z.iso.datetime().nullable(),
  freshness: z.enum(['fresh', 'stale', 'not-observed']),
  lastSuccessAt: z.iso.datetime().nullable(),
  lastFailureAt: z.iso.datetime().nullable(),
  failureCategory: z.enum(['storage', 'preparation']).nullable(),
  queued: WorkerCountSchema,
  due: WorkerCountSchema,
  dueSchedules: WorkerCountSchema.nullable(),
  activeLeases: WorkerCountSchema.nullable(),
  expiredLeases: WorkerCountSchema.nullable(),
  oldestOutstandingAgeSeconds: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable(),
});
export const WorkerHealthOverviewSchema = z.strictObject({
  observedAt: z.iso.datetime(),
  workers: z.array(WorkerHealthSchema).length(2),
});
export const WorkerControlHistorySchema = z.strictObject({
  receipts: z.array(WorkerControlReceiptSchema).max(100),
  moreAvailable: z.boolean(),
  retainedPerWorker: z.literal(1000),
});
export type WorkerHealthOverview = z.infer<typeof WorkerHealthOverviewSchema>;
export type WorkerHealth = z.infer<typeof WorkerHealthSchema>;
export type WorkerControlReceipt = z.infer<typeof WorkerControlReceiptSchema>;
export type WorkerControlInput = z.infer<typeof WorkerControlInputSchema>;
export function workerFreshness(
  heartbeat: string | null,
  observedAt: string,
): 'fresh' | 'stale' | 'not-observed' {
  return heartbeat === null
    ? 'not-observed'
    : Date.parse(observedAt) - Date.parse(heartbeat) <= 30000
      ? 'fresh'
      : 'stale';
}
