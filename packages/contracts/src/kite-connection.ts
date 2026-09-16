import { z } from 'zod';
import { HoldingRowsSchema, HoldingsPreviewSchema } from './holdings.js';
export const KiteConnectionStatusSchema = z.strictObject({
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
export const KiteStartSchema = z.strictObject({ consent: z.literal(true) });
export const KiteStartResultSchema = z.strictObject({
  loginUrl: z.url(),
  expiresAt: z.iso.datetime(),
});
export const KiteFetchSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
  storageConsent: z.literal(true),
});
export const KiteCaptureSchema = z.strictObject({
  id: z.uuid(),
  provider: z.literal('zerodha-kite'),
  parserVersion: z.literal('kite-settled-holdings-v1'),
  retrievedAt: z.iso.datetime(),
  sourceUrl: z.literal('https://api.kite.trade/portfolio/holdings'),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  holdings: HoldingRowsSchema,
  rounding: z.literal('per-row-half-up-paise'),
  costBasis: z.literal('broker-average-price-unverified'),
  warning: z.string().max(500),
});
export const KitePreviewResultSchema = z.strictObject({
  capture: KiteCaptureSchema,
  preview: HoldingsPreviewSchema,
});
export const KiteRevokeSchema = z.strictObject({ confirm: z.literal(true) });
export const KiteRevokedSchema = z.strictObject({
  revoked: z.literal(true),
  remote: z.enum(['confirmed', 'unavailable', 'not-needed']),
  message: z.string(),
});
export const KiteExportSchema = z.strictObject({
  connection: KiteConnectionStatusSchema,
  captures: z.array(
    KiteCaptureSchema.extend({ rawResponse: z.string().max(2000000) }),
  ),
  events: z.array(z.strictObject({ action: z.string(), at: z.iso.datetime() })),
});
