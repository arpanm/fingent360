import { z } from 'zod';

export const feedbackLimits = {
  imageBytes: 2_000_000,
  audioBytes: 4_000_000,
  audioMs: 120_000,
  text: 5000,
} as const;
const base64 = (bytes: number) =>
  z
    .string()
    .min(4)
    .max(Math.ceil(bytes / 3) * 4)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
export const FeedbackImageSchema = z.strictObject({
  mime: z.literal('image/png'),
  base64: base64(feedbackLimits.imageBytes),
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
});
export const FeedbackAudioSchema = z.strictObject({
  mime: z.enum(['audio/webm', 'audio/mp4', 'audio/ogg']),
  base64: base64(feedbackLimits.audioBytes),
  durationMs: z.number().int().min(1).max(feedbackLimits.audioMs),
});
export const FeedbackContextSchema = z.strictObject({
  screen: z
    .string()
    .max(100)
    .regex(/^[A-Za-z0-9/_-]*$/),
  runtime: z.enum(['web', 'offline', 'connected']),
  appVersion: z.string().max(100),
  viewport: z.strictObject({
    width: z.number().int().min(1).max(10000),
    height: z.number().int().min(1).max(10000),
  }),
  capturedAt: z.iso.datetime(),
});
export const FeedbackSubmissionSchema = z
  .strictObject({
    id: z.uuid(),
    receiptToken: z.string().regex(/^[a-f0-9]{64}$/),
    text: z.string().trim().max(feedbackLimits.text),
    image: FeedbackImageSchema.nullable(),
    audio: FeedbackAudioSchema.nullable(),
    context: FeedbackContextSchema,
    consent: z.literal(true),
  })
  .refine((value) => value.text.length > 0 || value.audio !== null, {
    message: 'Add written or voice feedback.',
    path: ['text'],
  });
export const FeedbackStatusSchema = z.enum([
  'received',
  'reviewing',
  'resolved',
]);
export const FeedbackReceiptSchema = z.strictObject({
  id: z.uuid(),
  status: FeedbackStatusSchema,
  receivedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().positive(),
});
export const FeedbackReportSchema = FeedbackReceiptSchema.extend({
  text: z.string().max(feedbackLimits.text),
  context: FeedbackContextSchema,
  image: FeedbackImageSchema.nullable(),
  audio: FeedbackAudioSchema.nullable(),
});
export const FeedbackListSchema = z.strictObject({
  items: z
    .array(
      FeedbackReceiptSchema.extend({
        text: z.string().max(feedbackLimits.text),
        context: FeedbackContextSchema,
        hasImage: z.boolean(),
        hasAudio: z.boolean(),
      }),
    )
    .max(50),
  nextCursor: z.string().max(200).nullable(),
});
export const FeedbackReviewSchema = z.strictObject({
  expectedVersion: z.number().int().positive(),
  status: FeedbackStatusSchema,
});
export type FeedbackSubmission = z.infer<typeof FeedbackSubmissionSchema>;
export type FeedbackReceipt = z.infer<typeof FeedbackReceiptSchema>;
export type FeedbackReport = z.infer<typeof FeedbackReportSchema>;
export type FeedbackImage = z.infer<typeof FeedbackImageSchema>;
export type FeedbackAudio = z.infer<typeof FeedbackAudioSchema>;
