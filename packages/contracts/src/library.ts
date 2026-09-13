import { z } from 'zod';
import { FeedItemSchema } from './discovery.js';
export const LibraryItemIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9._:-]+$/);
const TopicsSchema = z
  .array(z.string().min(1).max(80))
  .max(30)
  .refine((v) => new Set(v).size === v.length, 'Choose each topic once.');
export const LibraryPreferencesSchema = z
  .strictObject({
    topics: TopicsSchema,
    mutedTopics: TopicsSchema,
    mode: z.enum(['chronological', 'for_you']),
  })
  .refine(
    (v) => !v.topics.some((topic) => v.mutedTopics.includes(topic)),
    'A topic cannot be followed and muted.',
  );
export const LibrarySaveInputSchema = z.strictObject({
  version: z.number().int().positive().optional(),
});
export const LibraryReactionInputSchema = z.strictObject({
  reaction: z.enum(['more', 'less']),
});
export const LibraryPositionInputSchema = z.strictObject({
  version: z.number().int().positive(),
  percent: z.number().int().min(0).max(100),
});
export const LibrarySavedSchema = z.strictObject({
  itemId: LibraryItemIdSchema,
  version: z.number().int().positive(),
  title: z.string(),
  summary: z.string(),
  sourceUrl: z.url(),
  savedAt: z.iso.datetime(),
  currentStatus: z.enum(['published', 'withdrawn', 'draft', 'unavailable']),
  currentVersion: z.number().int().positive().nullable(),
});
const TimeZoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Choose a valid time zone.');
export const LibraryReminderInputSchema = z.strictObject({
  itemId: LibraryItemIdSchema,
  dueAt: z.iso.datetime(),
  timeZone: TimeZoneSchema,
  idempotencyKey: z.uuid(),
});
export const LibraryReminderUpdateSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  dueAt: z.iso.datetime(),
  timeZone: TimeZoneSchema,
});
export const LibraryReminderCancelSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
});
export const LibraryReminderSchema = z.strictObject({
  id: z.uuid(),
  itemId: LibraryItemIdSchema,
  title: z.string(),
  dueAt: z.iso.datetime(),
  timeZone: TimeZoneSchema,
  status: z.enum(['pending', 'delivered', 'cancelled']),
  version: z.number().int().positive(),
});
export const LibraryNotificationSchema = z.strictObject({
  id: z.uuid(),
  reminderId: z.uuid(),
  itemId: LibraryItemIdSchema,
  title: z.string(),
  deliveredAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export const LibrarySchema = z.strictObject({
  saved: z.array(LibrarySavedSchema),
  reactions: z.array(
    z.strictObject({
      itemId: LibraryItemIdSchema,
      reaction: z.enum(['more', 'less']),
    }),
  ),
  positions: z.array(
    LibraryPositionInputSchema.extend({
      itemId: LibraryItemIdSchema,
      updatedAt: z.iso.datetime(),
    }),
  ),
  preferences: LibraryPreferencesSchema,
  reminders: z.array(LibraryReminderSchema),
  notifications: z.array(LibraryNotificationSchema),
});
export type Library = z.infer<typeof LibrarySchema>;
export type LibraryPreferences = z.infer<typeof LibraryPreferencesSchema>;
export type LibraryReminder = z.infer<typeof LibraryReminderSchema>;

export const FeedRankingSchema = z.strictObject({
  items: z.array(FeedItemSchema),
  evaluatedAt: z.iso.datetime(),
  nextCursor: z
    .string()
    .max(256)
    .regex(/^[A-Za-z0-9_-]+$/)
    .nullable(),
  whyShown: z.record(z.string(), z.string()),
  policyVersion: z.literal('explicit-v1'),
});
