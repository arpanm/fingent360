import { z } from 'zod';
export const MacroIndicatorSchema = z.enum(['NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG']);
export type MacroIndicator = z.infer<typeof MacroIndicatorSchema>;
export const MacroValueSchema = z.string().regex(/^-?(0|[1-9]\d{0,17})(\.\d{1,30})?$/);
export const MacroObservationSchema = z.strictObject({
  id: z.uuid(), indicator: MacroIndicatorSchema, year: z.number().int().min(1960).max(2200),
  value: MacroValueSchema.nullable(), unit: z.literal('annual_percent'), country: z.literal('IND'),
  providerUpdatedAt: z.iso.date(), retrievedAt: z.iso.datetime(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/), sourceUrl: z.url(),
  revision: z.number().int().positive(), supersedesId: z.uuid().nullable(),
});
export const MacroRunSchema = z.strictObject({
  id: z.uuid(), indicator: MacroIndicatorSchema, startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(), status: z.enum(['running', 'succeeded', 'failed']),
  message: z.string(), inserted: z.number().int().nonnegative(),
});
export const MacroSourceSchema = z.strictObject({
  indicator: MacroIndicatorSchema, title: z.string(), explanation: z.string(),
  sourceUrl: z.url(), apiUrl: z.url(), attribution: z.string(),
  license: z.literal('CC BY 4.0'), termsUrl: z.url(), rightsReviewedAt: z.iso.date(),
  freshness: z.enum(['never_synced', 'recently_checked', 'refresh_due']),
  lastSuccessAt: z.iso.datetime().nullable(), latestRun: MacroRunSchema.nullable(),
  observations: z.array(MacroObservationSchema),
});
export const MacroDashboardSchema = z.strictObject({
  sources: z.array(MacroSourceSchema), evaluatedAt: z.iso.datetime(), operatorConfigured: z.boolean(),
});
export const MacroRefreshSchema = z.strictObject({ indicator: MacroIndicatorSchema });
export const MacroHistorySchema = z.array(MacroObservationSchema);
export const MacroEvidenceSchema = z.strictObject({
  hash: z.string().regex(/^[a-f0-9]{64}$/), url: z.url(), retrievedAt: z.iso.datetime(),
  body: z.string().max(1000000),
});
export type MacroObservation = z.infer<typeof MacroObservationSchema>;
export type MacroDashboard = z.infer<typeof MacroDashboardSchema>;
export type MacroRun = z.infer<typeof MacroRunSchema>;
