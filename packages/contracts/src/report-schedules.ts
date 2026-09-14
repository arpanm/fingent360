import { z } from 'zod';
export const ScheduleConfigSchema = z.strictObject({
  label: z.string().trim().min(1).max(80),
  frequency: z.enum(['daily', 'weekly']),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v }).format();
        return true;
      } catch {
        return false;
      }
    }, 'Choose an IANA timezone.'),
  weekday: z.number().int().min(0).max(6),
  policy: z.literal('saved-record-review-v1'),
});
export const ReportScheduleSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
  config: ScheduleConfigSchema,
  status: z.enum(['active', 'paused', 'deleted']),
  savedAt: z.iso.datetime(),
  nextDueAt: z.iso.datetime().nullable(),
  message: z.string().max(300),
});
export const ScheduleWriteSchema = z
  .strictObject({
    requestId: z.uuid(),
    expectedVersion: z.number().int().min(0),
    action: z.enum(['save', 'pause', 'resume', 'delete']),
    config: ScheduleConfigSchema.optional(),
    consent: z.literal(true),
  })
  .superRefine((v, c) => {
    if (v.action === 'save' && !v.config)
      c.addIssue({
        code: 'custom',
        message: 'Configuration required.',
        path: ['config'],
      });
    if (v.action !== 'save' && v.config)
      c.addIssue({
        code: 'custom',
        message: 'Configuration is only accepted when saving.',
        path: ['config'],
      });
  });
export const ScheduleOccurrenceSchema = z.strictObject({
  id: z.uuid(),
  scheduleId: z.uuid(),
  scheduleVersion: z.number().int().positive(),
  dueAt: z.iso.datetime(),
  capturedAt: z.iso.datetime(),
  skipped: z.number().int().nonnegative(),
  status: z.enum(['queued', 'capacity', 'failed']),
  reportId: z.uuid().nullable(),
  message: z.string().max(300),
});
export const ScheduleReceiptSchema = z.strictObject({
  requestId: z.uuid(),
  schedule: ReportScheduleSchema,
});
export const ReportSchedulesSchema = z.strictObject({
  schedules: z.array(ReportScheduleSchema).max(105),
  occurrences: z.array(ScheduleOccurrenceSchema).max(100),
  evaluatedAt: z.iso.datetime(),
  mode: z.enum(['connected', 'device']),
});
export const ScheduleExportQuerySchema = z.strictObject({
  editionAfter: z.coerce.number().int().nonnegative().safe().default(0),
  receiptAfter: z.coerce.number().int().nonnegative().safe().default(0),
  occurrenceAfter: z.coerce.number().int().nonnegative().safe().default(0),
  editionUntil: z.coerce.number().int().nonnegative().safe().optional(),
  receiptUntil: z.coerce.number().int().nonnegative().safe().optional(),
  occurrenceUntil: z.coerce.number().int().nonnegative().safe().optional(),
});
export const ScheduleExportSchema = z.strictObject({
  ownerId: z.uuid(),
  editions: z.array(ReportScheduleSchema).max(100),
  receipts: z.array(ScheduleReceiptSchema).max(100),
  occurrences: z.array(ScheduleOccurrenceSchema).max(100),
  next: z
    .strictObject({
      editionAfter: z.number().int().nonnegative().safe(),
      receiptAfter: z.number().int().nonnegative().safe(),
      occurrenceAfter: z.number().int().nonnegative().safe(),
      editionUntil: z.number().int().nonnegative().safe(),
      receiptUntil: z.number().int().nonnegative().safe(),
      occurrenceUntil: z.number().int().nonnegative().safe(),
    })
    .nullable(),
});
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;
export type ReportSchedule = z.infer<typeof ReportScheduleSchema>;
export type ScheduleOccurrence = z.infer<typeof ScheduleOccurrenceSchema>;
function parts(format: Intl.DateTimeFormat, at: number) {
  const p = Object.fromEntries(
    format.formatToParts(at).map((x) => [x.type, x.value]),
  );
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}
function wall(p: ReturnType<typeof parts>) {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
}
/** Resolve local calendar time without using the host timezone. Fold: first; gap: next valid minute. */
export function scheduleInstant(config: ScheduleConfig, date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = config.time.split(':').map(Number);
  const requested = Date.UTC(year!, month! - 1, day!, hour!, minute!);
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const offsets = new Set<number>();
  for (let h = -36; h <= 36; h += 6) {
    const at = requested + h * 3600000;
    offsets.add(wall(parts(f, at)) - at);
  }
  for (let shift = 0; shift <= 180; shift++) {
    const target = requested + shift * 60000;
    const valid = [...offsets]
      .map((offset) => target - offset)
      .filter((at) => wall(parts(f, at)) === target)
      .sort((a, b) => a - b);
    if (valid[0] !== undefined) return new Date(valid[0]).toISOString();
  }
  throw new Error(
    'This local time cannot be resolved within the supported three-hour daylight-saving gap.',
  );
}
export function nextScheduleDue(config: ScheduleConfig, after: string): string {
  const at = Date.parse(after),
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    p = parts(f, at);
  const start = Date.UTC(p.year, p.month - 1, p.day);
  for (let day = 0; day <= 8; day++) {
    const date = new Date(start + day * 86400000);
    if (config.frequency === 'weekly' && date.getUTCDay() !== config.weekday)
      continue;
    const candidate = scheduleInstant(config, date.toISOString().slice(0, 10));
    if (Date.parse(candidate) > at) return candidate;
  }
  throw new Error('No next schedule occurrence within eight days.');
}
export function latestScheduleDue(
  config: ScheduleConfig,
  first: string,
  now: string,
) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const current = parts(f, Date.parse(now)),
    initial = parts(f, Date.parse(first));
  const start = Date.UTC(current.year, current.month - 1, current.day),
    begin = Date.UTC(initial.year, initial.month - 1, initial.day);
  for (let day = 0; day <= 8; day++) {
    const date = new Date(start - day * 86400000);
    if (config.frequency === 'weekly' && date.getUTCDay() !== config.weekday)
      continue;
    const due = scheduleInstant(config, date.toISOString().slice(0, 10));
    if (
      Date.parse(due) <= Date.parse(now) &&
      Date.parse(due) >= Date.parse(first)
    ) {
      const skipped = Math.max(
        0,
        Math.floor(
          (date.getTime() - begin) /
            86400000 /
            (config.frequency === 'weekly' ? 7 : 1),
        ),
      );
      return { dueAt: due, nextDueAt: nextScheduleDue(config, due), skipped };
    }
  }
  throw new Error('No due occurrence.');
}

export const CompleteScheduleExportSchema = z.strictObject({
  ownerId: z.uuid(),
  editions: z.array(ReportScheduleSchema),
  receipts: z.array(ScheduleReceiptSchema),
  occurrences: z.array(ScheduleOccurrenceSchema),
  complete: z.literal(true),
});
