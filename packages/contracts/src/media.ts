import { z } from 'zod';
import { DiscoveryIdSchema } from './discovery.js';
export const MediaAssetSchema = z.strictObject({
  id: z.uuid(),
  itemId: DiscoveryIdSchema,
  itemVersion: z.number().int().positive(),
  title: z.string().max(500),
  sourceUrl: z.url(),
  sourceIds: z.array(DiscoveryIdSchema).min(1).max(12),
  svg: z.string().max(100000),
  image: z
    .strictObject({
      attemptId: z.uuid(),
      base64: z
        .string()
        .min(1)
        .max(5400000)
        .regex(/^[A-Za-z0-9+/]*={0,2}$/),
      mime: z.literal('image/png'),
      width: z.number().int().min(1).max(4096),
      height: z.number().int().min(1).max(4096),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      provider: z.enum(['openai', 'gemini']),
      model: z.string().max(120),
      createdAt: z.iso.datetime(),
      label: z.literal(
        'AI-generated conceptual illustration; not evidence or a real event photograph.',
      ),
    })
    .optional(),
  captions: z
    .array(
      z.strictObject({
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().positive(),
        text: z.string().max(1000),
      }),
    )
    .min(1)
    .max(12),
  durationMs: z.number().int().positive().max(60000),
  createdAt: z.iso.datetime(),
  status: z.enum(['draft', 'published']),
  generation: z
    .strictObject({
      provider: z.enum(['template', 'openai', 'gemini', 'anthropic']),
      model: z.string().nullable(),
      fallbackReason: z.string().max(160).nullable(),
    })
    .default({ provider: 'template', model: null, fallbackReason: null }),
  label: z.literal('Source-based illustration; not a document photograph.'),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
