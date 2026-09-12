import { z } from 'zod';
const SourceUrlSchema = z
  .url()
  .max(2000)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }, 'Use an HTTPS URL without credentials.');
export const SourceInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(160),
    category: z.string().trim().min(1).max(120),
    sourceUrl: SourceUrlSchema,
    termsUrl: SourceUrlSchema,
    rightsStatus: z.enum(['unreviewed', 'restricted', 'approved']),
    constraints: z.string().trim().min(1).max(4000),
    reviewEvidence: z.string().trim().max(4000),
    reviewedAt: z.iso.datetime().nullable(),
    published: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (
      value.rightsStatus !== 'unreviewed' &&
      (!value.reviewedAt || !value.reviewEvidence)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Reviewed sources require a review time and evidence.',
        path: ['reviewEvidence'],
      });
    if (value.reviewedAt && Date.parse(value.reviewedAt) > Date.now())
      ctx.addIssue({
        code: 'custom',
        message: 'Review time cannot be in the future.',
        path: ['reviewedAt'],
      });
    if (value.published && value.rightsStatus !== 'approved')
      ctx.addIssue({
        code: 'custom',
        message: 'Only approved metadata can be published.',
        path: ['published'],
      });
  });
export const SourceRecordSchema = z.strictObject({
  id: z.uuid(),
  revision: z.number().int().positive(),
  recordedAt: z.iso.datetime(),
  data: SourceInputSchema,
});
export const SourceListSchema = z.array(SourceRecordSchema);
export const SourceUpdateSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  data: SourceInputSchema,
});
export type SourceInput = z.infer<typeof SourceInputSchema>;
export type SourceRecord = z.infer<typeof SourceRecordSchema>;
