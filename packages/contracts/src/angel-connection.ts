import { z } from 'zod';
import { HoldingRowsSchema, HoldingsPreviewSchema } from './holdings.js';
export const AngelConnectionStatusSchema = z.strictObject({
  enabled: z.boolean(),
  state: z.enum([
    'unconfigured',
    'disconnected',
    'pending',
    'connected',
    'expired',
    'revoked',
  ]),
  connectedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  lastFetchedAt: z.iso.datetime().nullable(),
  message: z.string().max(500),
});
export const AngelStartSchema = z.strictObject({ consent: z.literal(true) });
export const AngelStartResultSchema = z.strictObject({
  loginUrl: z.url(),
  expiresAt: z.iso.datetime(),
});
export const AngelFetchSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
  storageConsent: z.literal(true),
});
export const AngelCaptureSchema = z.strictObject({
  id: z.uuid(),
  provider: z.literal('angel'),
  parserVersion: z.literal('angel-settled-holdings-v1'),
  retrievedAt: z.iso.datetime(),
  sourceUrl: z.literal(
    'https://apiconnect.angelone.in/rest/secure/angelbroking/portfolio/v1/getHolding',
  ),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  holdings: HoldingRowsSchema,
  rounding: z.literal('per-row-half-up-paise'),
  costBasis: z.literal('broker-average-price-unverified'),
  warning: z.string().max(500),
});
export const AngelPreviewResultSchema = z.strictObject({
  capture: AngelCaptureSchema,
  preview: HoldingsPreviewSchema,
});
export const AngelRevokeSchema = z.strictObject({ confirm: z.literal(true) });
export const AngelRevokedSchema = z.strictObject({
  revoked: z.literal(true),
  remote: z.enum(['confirmed', 'unavailable', 'not-needed']),
  message: z.string(),
});
export const AngelExportSchema = z.strictObject({
  connection: AngelConnectionStatusSchema,
  captures: z.array(
    AngelCaptureSchema.extend({ rawResponse: z.string().max(2000000) }),
  ),
  events: z.array(z.strictObject({ action: z.string(), at: z.iso.datetime() })),
});
