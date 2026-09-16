import { z } from 'zod';
import { ScheduleConfigSchema, nextScheduleDue } from './report-schedules.js';
export const WhatsappScheduleConfigSchema = ScheduleConfigSchema.pick({
  frequency: true,
  time: true,
  timezone: true,
  weekday: true,
})
  .extend({
    sourceIds: z
      .array(
        z.enum([
          'glossary',
          'fed',
          'pib',
          'bea',
          'ecb-statistics',
          'ecb-press',
          'world-bank',
          'bea-gdp-original',
        ]),
      )
      .min(1)
      .max(8)
      .refine((v) => new Set(v).size === v.length),
    maxItems: z.number().int().min(1).max(3),
    maxAgeHours: z.number().int().min(1).max(168),
  })
  .strict();
export const WhatsappScheduleWriteSchema = z
  .strictObject({
    requestId: z.uuid(),
    expectedVersion: z.number().int().min(0),
    action: z.enum(['save', 'pause', 'resume', 'delete']),
    consent: z.literal(true),
    config: WhatsappScheduleConfigSchema.optional(),
  })
  .superRefine((v, c) => {
    if ((v.action === 'save') !== !!v.config)
      c.addIssue({
        code: 'custom',
        message: 'Configuration is required only when saving.',
        path: ['config'],
      });
  });
export const WhatsappScheduleSchema = z.strictObject({
  version: z.number().int().positive(),
  state: z.enum(['active', 'paused', 'deleted']),
  config: WhatsappScheduleConfigSchema,
  savedAt: z.iso.datetime(),
  nextDueAt: z.iso.datetime().nullable(),
});
export const WhatsappOccurrenceSchema = z.strictObject({
  id: z.uuid(),
  scheduleVersion: z.number().int().positive(),
  dueAt: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  outcome: z.enum(['queued', 'empty', 'unavailable', 'skipped']),
  detail: z.string().max(300),
  jobIds: z.array(z.uuid()).max(3),
});
export const WhatsappScheduleViewSchema = z.strictObject({
  schedule: WhatsappScheduleSchema.nullable(),
  occurrences: z.array(WhatsappOccurrenceSchema).max(100),
  availableSources: z.array(z.string()).max(8),
});
export function nextWhatsappDue(
  config: z.infer<typeof WhatsappScheduleConfigSchema>,
  after: string,
) {
  return nextScheduleDue(
    {
      ...config,
      label: 'Public WhatsApp summaries',
      policy: 'saved-record-review-v1',
    },
    after,
  );
}
