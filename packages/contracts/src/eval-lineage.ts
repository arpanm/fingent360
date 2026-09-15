import { EventExtractionAttemptSchema } from './event-extraction.js';
import { z } from 'zod';
import { FeedItemSchema, DiscoveryIdSchema } from './discovery.js';
export const PublicMediaReferenceSchema = z.strictObject({
  assetId: z.uuid(),
  imageAttemptId: z.uuid().nullable(),
  imageHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});
export const PublicViewContextSchema = z.strictObject({
  kind: z.enum(['reader', 'story']),
  capturedAt: z.iso.datetime(),
  item: FeedItemSchema,
  media: PublicMediaReferenceSchema.optional(),
  runtime: z.enum(['web', 'offline', 'connected']).optional(),
});
export const EvalQuerySchema = z.strictObject({
  sourceId: DiscoveryIdSchema.optional(),
  before: z
    .string()
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});
export const EvalTraceSchema = z.strictObject({
  id: z.uuid(),
  sourceId: DiscoveryIdSchema,
  sourceVersion: z.number().int().positive(),
  kind: z.enum(['media-caption', 'event-extraction']),
  provider: z.string(),
  model: z.string(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  status: z.enum(['running', 'succeeded', 'failed']),
  instructions: z.string(),
  input: z.string(),
  rawOutput: z.string().nullable(),
  textOutput: z.string().nullable(),
  outcome: z.string(),
});
export const EvalViewSchema = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  sourceId: DiscoveryIdSchema,
  sourceVersion: z.number().int().positive(),
  capturedAt: z.iso.datetime(),
  payload: FeedItemSchema,
});
export const EvalDetailSchema = z.strictObject({
  sourceId: DiscoveryIdSchema,
  current: z.boolean(),
  traces: z.array(EvalTraceSchema),
  views: z.array(EvalViewSchema),
  feedback: z.array(
    z.strictObject({
      id: z.uuid(),
      status: z.string(),
      receivedAt: z.iso.datetime(),
      text: z.string().nullable(),
      view: PublicViewContextSchema,
    }),
  ),
  compositions: z.array(
    z.strictObject({
      id: z.string(),
      item: FeedItemSchema,
      media: PublicMediaReferenceSchema,
      captions: z.array(
        z.strictObject({
          startMs: z.number(),
          endMs: z.number(),
          text: z.string(),
        }),
      ),
      capturedAt: z.iso.datetime(),
    }),
  ),
  eventAttempts: z.array(EventExtractionAttemptSchema),
  imageAttempts: z.array(
    z.strictObject({
      id: z.uuid(),
      assetId: z.uuid(),
      provider: z.string(),
      model: z.string(),
      status: z.string(),
      startedAt: z.iso.datetime(),
      message: z.string(),
    }),
  ),
  sourceHashes: z.array(z.string()),
  note: z.string(),
});
export const EvalListSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      sourceId: DiscoveryIdSchema,
      sourceVersion: z.number().int().positive(),
      capturedAt: z.iso.datetime(),
    }),
  ),
  nextBefore: z.string().nullable(),
});
export const PrivateAiHistoryEntrySchema = z.strictObject({
  id: z.uuid(),
  provider: z.string().max(40),
  model: z.string().max(120),
  instructions: z.string().max(12000),
  input: z.string().max(40000),
  rawOutput: z.string().max(65536).nullable(),
  textOutput: z.string().max(65536).nullable(),
  status: z.enum(['running', 'succeeded', 'failed']),
  outcome: z.string().max(300),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  consentVersion: z.number().int().positive(),
});
export const PrivateAiHistorySchema = z.strictObject({
  enabled: z.boolean(),
  entries: z.array(PrivateAiHistoryEntrySchema).max(50),
  retentionDays: z.literal(7),
});
