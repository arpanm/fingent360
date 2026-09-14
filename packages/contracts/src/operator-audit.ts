import { z } from 'zod';

export const auditModules = [
  'publishing',
  'macro',
  'sources',
  'media',
  'identities',
  'retention',
  'other',
] as const;
export const AuditModuleSchema = z.enum(auditModules);
export type AuditModule = z.infer<typeof AuditModuleSchema>;
export const auditEvents = [
  'discovery.refresh.requested',
  'discovery.review.requested',
  'macro.refresh.requested',
  'source.create.requested',
  'source.update.requested',
  'media.generate.requested',
  'security-identity-refresh',
  'retention-preview',
  'retention-completed',
  'retention-failed',
  'other',
] as const;
export const AuditEventSchema = z.enum(auditEvents);
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export const auditEventInfo: Record<
  AuditEvent,
  { module: AuditModule; label: string; stage: 'request' | 'record' }
> = {
  'discovery.refresh.requested': {
    module: 'publishing',
    label: 'Discovery refresh requested',
    stage: 'request',
  },
  'discovery.review.requested': {
    module: 'publishing',
    label: 'Publication review requested',
    stage: 'request',
  },
  'macro.refresh.requested': {
    module: 'macro',
    label: 'Macro refresh requested',
    stage: 'request',
  },
  'source.create.requested': {
    module: 'sources',
    label: 'Source metadata creation requested',
    stage: 'request',
  },
  'source.update.requested': {
    module: 'sources',
    label: 'Source metadata update requested',
    stage: 'request',
  },
  'media.generate.requested': {
    module: 'media',
    label: 'Visual preparation requested',
    stage: 'request',
  },
  'security-identity-refresh': {
    module: 'identities',
    label: 'Identity refresh requested',
    stage: 'request',
  },
  'retention-preview': {
    module: 'retention',
    label: 'Cleanup preview recorded',
    stage: 'record',
  },
  'retention-completed': {
    module: 'retention',
    label: 'Cleanup completion recorded',
    stage: 'record',
  },
  'retention-failed': {
    module: 'retention',
    label: 'Cleanup failure recorded',
    stage: 'record',
  },
  other: { module: 'other', label: 'Other recorded activity', stage: 'record' },
};
export const auditModuleLabels: Record<AuditModule, string> = {
  publishing: 'Publishing',
  macro: 'Macro ingestion',
  sources: 'Source registry',
  media: 'Visual preparation',
  identities: 'Security identities',
  retention: 'Expired data cleanup',
  other: 'Other activity',
};
export function projectAuditEvent(action: unknown): AuditEvent {
  return typeof action === 'string' &&
    auditEvents.some((event) => event === action)
    ? (action as AuditEvent)
    : 'other';
}
const Day = z.iso.date().refine((day) => {
  const parsed = new Date(`${day}T00:00:00Z`);
  return (
    day >= '0001-01-01' &&
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === day
  );
}, 'Enter a real UTC date.');
export const AuditFiltersSchema = z
  .strictObject({
    module: AuditModuleSchema.optional(),
    event: AuditEventSchema.optional(),
    from: Day.optional(),
    through: Day.optional(),
  })
  .refine(
    (f) => !f.from || !f.through || f.from <= f.through,
    'The first date must not follow the last date.',
  )
  .refine(
    (f) => !f.module || !f.event || auditEventInfo[f.event].module === f.module,
    'Choose an event from the selected section.',
  );
export type AuditFilters = z.infer<typeof AuditFiltersSchema>;
export const AuditCursorSchema = z
  .string()
  .min(40)
  .max(2400)
  .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
export const AuditQuerySchema = z.union([
  AuditFiltersSchema,
  z.strictObject({ cursor: AuditCursorSchema }),
]);
// Six fractional digits keep the database key intact across tied milliseconds.
export const AuditPositionSchema = z.strictObject({
  id: z.uuid(),
  recordedAt: z.iso.datetime({ precision: 6 }),
});
export function compareAuditPositions(
  a: z.infer<typeof AuditPositionSchema>,
  b: z.infer<typeof AuditPositionSchema>,
) {
  if (a.recordedAt !== b.recordedAt)
    return a.recordedAt < b.recordedAt ? -1 : 1;
  const left = a.id.toLowerCase(),
    right = b.id.toLowerCase();
  return left === right ? 0 : left < right ? -1 : 1;
}
export const AuditRowSchema = AuditPositionSchema.extend({
  event: AuditEventSchema,
  module: AuditModuleSchema,
}).refine((row) => auditEventInfo[row.event].module === row.module);
export type AuditRow = z.infer<typeof AuditRowSchema>;
export const AuditPageSchema = z
  .strictObject({
    items: z.array(AuditRowSchema).max(50),
    filters: AuditFiltersSchema,
    upper: AuditPositionSchema.nullable(),
    nextCursor: AuditCursorSchema.nullable(),
    pageSize: z.literal(50),
  })
  .refine((page) => !page.nextCursor || page.items.length === 50)
  .refine((page) => page.upper !== null || page.items.length === 0)
  .refine(
    (page) =>
      new Set(page.items.map((item) => item.id)).size === page.items.length,
  )
  .refine((page) =>
    page.items.every(
      (item, index) =>
        (!page.upper || compareAuditPositions(item, page.upper) <= 0) &&
        (index === 0 ||
          compareAuditPositions(page.items[index - 1]!, item) > 0),
    ),
  );
export type AuditPage = z.infer<typeof AuditPageSchema>;
