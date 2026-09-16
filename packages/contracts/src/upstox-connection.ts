import { z } from 'zod';
import { HoldingRowsSchema, HoldingsPreviewSchema } from './holdings.js';
export const UpstoxConnectionStatusSchema = z.strictObject({
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
export const UpstoxStartSchema = z.strictObject({ consent: z.literal(true) });
export const UpstoxStartResultSchema = z.strictObject({
  loginUrl: z.url(),
  expiresAt: z.iso.datetime(),
});
export const UpstoxFetchSchema = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
  storageConsent: z.literal(true),
});
export const UpstoxCaptureSchema = z.strictObject({
  id: z.uuid(),
  provider: z.literal('upstox'),
  parserVersion: z.literal('upstox-settled-holdings-v1'),
  retrievedAt: z.iso.datetime(),
  sourceUrl: z.literal(
    'https://api.upstox.com/v2/portfolio/long-term-holdings',
  ),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  holdings: HoldingRowsSchema,
  rounding: z.literal('per-row-half-up-paise'),
  costBasis: z.literal('broker-average-price-unverified'),
  warning: z.string().max(500),
});
export const UpstoxPreviewResultSchema = z.strictObject({
  capture: UpstoxCaptureSchema,
  preview: HoldingsPreviewSchema,
});
export const UpstoxRevokeSchema = z.strictObject({ confirm: z.literal(true) });
export const UpstoxRevokedSchema = z.strictObject({
  revoked: z.literal(true),
  remote: z.enum(['confirmed', 'unavailable', 'not-needed']),
  message: z.string(),
});
export const UpstoxExportSchema = z.strictObject({
  connection: UpstoxConnectionStatusSchema,
  captures: z.array(
    UpstoxCaptureSchema.extend({ rawResponse: z.string().max(2000000) }),
  ),
  events: z.array(z.strictObject({ action: z.string(), at: z.iso.datetime() })),
});
