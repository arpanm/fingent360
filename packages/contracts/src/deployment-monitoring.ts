import { z } from 'zod';
const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const DeploymentMonitoringSchema = z.strictObject({
  observedAt: z.iso.datetime(),
  scope: z.literal('participating-api-processes'),
  windowMinutes: z.literal(15),
  heartbeatBudgetSeconds: z.literal(180),
  processes: Count,
  staleProcesses: Count,
  lastHeartbeat: z.iso.datetime().nullable(),
  samples: Count,
  completed: Count,
  serverErrors: Count,
  slow: Count,
  disconnected: Count,
  incidents: z
    .array(
      z.strictObject({
        id: z.uuid(),
        kind: z.enum(['server-errors', 'missing-heartbeat']),
        openedAt: z.iso.datetime(),
        resolvedAt: z.iso.datetime().nullable(),
        acknowledgedAt: z.iso.datetime().nullable(),
      }),
    )
    .max(100),
  moreIncidents: z.boolean(),
});
export type DeploymentMonitoring = z.infer<typeof DeploymentMonitoringSchema>;
export const AcknowledgeMonitoringSchema = z.strictObject({ id: z.uuid() });
export const RetireMonitoringProcessesSchema = z.strictObject({
  confirm: z.literal(true),
});
export const RetireMonitoringProcessesReceiptSchema = z.strictObject({
  retired: Count,
});
