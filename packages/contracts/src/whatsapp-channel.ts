import {
  WhatsappScheduleSchema,
  WhatsappOccurrenceSchema,
} from './whatsapp-schedule.js';
import { z } from 'zod';
import { DiscoveryIdSchema } from './discovery.js';
export const WhatsappStartSchema = z.strictObject({
  requestId: z.uuid(),
  phone: z.string().regex(/^[1-9]\d{7,14}$/),
  consent: z.literal(true),
});
export const WhatsappSendSchema = z.strictObject({
  requestId: z.uuid(),
  itemId: DiscoveryIdSchema,
});
export const WhatsappStatusSchema = z.enum([
  'queued',
  'sending',
  'accepted',
  'delivered',
  'read',
  'failed',
  'uncertain',
  'cancelled',
]);
export const WhatsappViewSchema = z.strictObject({
  enabled: z.boolean(),
  connection: z.enum(['none', 'pending', 'verified', 'disabled']),
  maskedPhone: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  jobs: z
    .array(
      z.strictObject({
        id: z.uuid(),
        itemId: DiscoveryIdSchema,
        status: WhatsappStatusSchema,
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        detail: z.string(),
      }),
    )
    .max(100),
});
export const WhatsappVerificationSchema = z.strictObject({
  verificationUrl: z.string().regex(/^https:\/\/wa\.me\/[1-9]\d{7,14}\?text=/),
  expiresAt: z.string().datetime(),
});
export const WhatsappPrivateSchema = z.strictObject({
  phone: z.string().regex(/^[1-9]\d{7,14}$/),
  code: z.string().nullable(),
});
export const WhatsappJobPayloadSchema = z.strictObject({
  title: z.string().max(200),
  summary: z.string().max(800),
  url: z.string().url(),
  sourceHash: z.string(),
  sourceVersion: z.number().int().positive(),
});
/** Strict status advancement: an out-of-order sent notification cannot undo delivery/read. */
export function whatsappAdvance(
  current: z.infer<typeof WhatsappStatusSchema>,
  incoming: 'sent' | 'delivered' | 'read' | 'failed',
) {
  if (current === 'cancelled' || current === 'read') return current;
  if (incoming === 'read') return 'read' as const;
  if (current === 'delivered') return current;
  if (incoming === 'delivered') return 'delivered' as const;
  if (incoming === 'failed') return 'failed' as const;
  return current === 'failed' ? current : ('accepted' as const);
}

export const WhatsappChoicesSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: DiscoveryIdSchema,
        title: z.string(),
        summary: z.string(),
      }),
    )
    .max(50),
  next: DiscoveryIdSchema.nullable(),
});

export const WhatsappExportSchema = z.strictObject({
  scheduling: z
    .strictObject({
      schedule: WhatsappScheduleSchema.nullable(),
      versions: z.array(WhatsappScheduleSchema),
      occurrences: z.array(WhatsappOccurrenceSchema),
    })
    .optional(),
  connection: z
    .strictObject({
      phone: WhatsappPrivateSchema.shape.phone,
      state: z.enum(['pending', 'verified', 'disabled']),
      updatedAt: z.iso.datetime(),
    })
    .nullable(),
  deliveries: z.array(
    z.strictObject({
      id: z.uuid(),
      itemId: DiscoveryIdSchema,
      status: WhatsappStatusSchema,
      createdAt: z.iso.datetime(),
      payload: WhatsappJobPayloadSchema,
    }),
  ),
});
