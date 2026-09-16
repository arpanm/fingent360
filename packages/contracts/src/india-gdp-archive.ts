import { z } from 'zod';
export const IndiaGdpArchiveRequestSchema = z.strictObject({
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  rightsEvidence: z.string().trim().min(20).max(2000),
  rightsConfirmed: z.literal(true),
});
export const IndiaGdpArchiveResultSchema = z.strictObject({
  month: z.string(),
  indexHash: z.string().regex(/^[a-f0-9]{64}$/),
  captureHash: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.iso.datetime(),
  failures: z
    .array(z.strictObject({ url: z.url(), reason: z.string() }))
    .max(8),
  results: z
    .array(
      z.strictObject({
        id: z.uuid(),
        status: z.enum(['retained', 'quarantined']),
        reason: z.string().nullable(),
      }),
    )
    .max(8),
});
