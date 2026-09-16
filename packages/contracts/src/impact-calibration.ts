import {
  AdjustmentWindowSchema,
  adjustmentBindings,
  normalizeAdjustedClose,
} from './equity-adjustments.js';
import { z } from 'zod';
import { EquityCompanySchema } from './equity-coverage.js';
import { EcbFxPublicSchema } from './ecb-fx.js';
export const ImpactCalibrationInputSchema = z.strictObject({
  isin: EquityCompanySchema.shape.isin,
  storageConsent: z.literal(true),
});
const Fit = z.strictObject({
  slope: z.number().finite(),
  intercept: z.number().finite(),
  standardError: z.number().finite().nonnegative(),
  conditionalNormalInterval: z.tuple([
    z.number().finite(),
    z.number().finite(),
  ]),
  residualLagOne: z.number().finite(),
  rSquared: z.number().finite(),
});
export const ImpactCalibrationResultSchema = z.strictObject({
  model: z.enum([
    'daily-fx-company-ols-v1',
    'daily-fx-company-adjusted-ols-v1',
  ]),
  status: z.enum(['insufficient-data', 'diagnostic-only']),
  pairs: z.number().int().nonnegative(),
  firstOn: z.iso.date().nullable(),
  lastOn: z.iso.date().nullable(),
  fit: Fit.nullable(),
  reasons: z.array(z.string()).min(1),
  forecastEnabled: z.literal(false),
  quantifiedPortfolioImpact: z.null(),
});
export const ImpactCalibrationReceiptSchema = z
  .strictObject({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    input: ImpactCalibrationInputSchema,
    equity: EquityCompanySchema.nullable(),
    factor: EcbFxPublicSchema,
    adjustmentCoverage: AdjustmentWindowSchema.nullable().optional(),
    result: ImpactCalibrationResultSchema,
  })
  .superRefine((v, ctx) => {
    if (
      (v.equity && v.equity.isin !== v.input.isin) ||
      JSON.stringify(v.result) !==
        JSON.stringify(
          calibrateImpact(
            v.equity,
            v.factor,
            v.createdAt,
            v.adjustmentCoverage ?? null,
          ),
        )
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Calibration must reconstruct from its retained exact source editions.',
      });
  });
export const ImpactCalibrationListSchema = z.strictObject({
  receipts: z.array(ImpactCalibrationReceiptSchema).max(50),
});
export function calibrateImpact(
  equity: z.infer<typeof EquityCompanySchema> | null,
  factor: z.infer<typeof EcbFxPublicSchema>,
  at: string,
  adjustment: z.infer<typeof AdjustmentWindowSchema> | null = null,
) {
  const reasons: string[] = [],
    prices = new Map<string, number>();
  let conflicting = false;
  for (const record of equity?.records ?? []) {
    const o = record.observation;
    if (o.kind !== 'price') continue;
    const v = Number(o.close);
    if (prices.has(o.effectiveOn) && prices.get(o.effectiveOn) !== v)
      conflicting = true;
    prices.set(o.effectiveOn, v);
  }
  if (conflicting)
    reasons.push('Conflicting admitted company closes prevent fitting.');
  if (equity?.truncated)
    reasons.push('Company history is truncated; coverage is incomplete.');
  let admittedAdjustment = false;
  if (adjustment) {
    if (
      adjustment.isin !== equity?.isin ||
      !adjustment.reviewedAt ||
      !equity ||
      JSON.stringify(adjustment.retainedBindings) !==
        JSON.stringify(adjustmentBindings(equity)) ||
      adjustment.prices.some(
        (row) =>
          normalizeAdjustedClose(row.rawClose, row.date, adjustment.factors) !==
            row.normalizedClose ||
          !equity.records.some(
            (record) =>
              record.editionId === row.editionId &&
              record.hash === row.hash &&
              record.observation.kind === 'price' &&
              record.observation.effectiveOn === row.date &&
              record.observation.close === row.rawClose,
          ),
      )
    )
      reasons.push(
        'Adjustment coverage is not independently reviewed for this company.',
      );
    else {
      admittedAdjustment = true;
      prices.clear();
      for (const row of adjustment.prices)
        prices.set(row.date, Number(row.normalizedClose));
    }
  }
  const joined = (
    factor.status === 'published' ? (factor.edition?.observations ?? []) : []
  )
    .filter((o) => prices.has(o.date) && o.date <= at.slice(0, 10))
    .map((o) => ({
      date: o.date,
      x: Number(o.derivedInrPerUsd.value),
      y: prices.get(o.date)!,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const pairs: { x: number; y: number }[] = [];
  let gaps = false;
  for (let i = 1; i < joined.length; i++) {
    const a = joined[i - 1]!,
      b = joined[i]!;
    if (Date.parse(b.date) - Date.parse(a.date) > 7 * 86400000) {
      gaps = true;
      continue;
    }
    if (a.x <= 0 || a.y <= 0 || b.x <= 0 || b.y <= 0) continue;
    pairs.push({ x: (b.x / a.x - 1) * 100, y: (b.y / a.y - 1) * 100 });
  }
  const firstOn = joined[0]?.date ?? null,
    lastOn = joined.at(-1)?.date ?? null;
  if (pairs.length < 60)
    reasons.push(
      `Need at least 60 paired daily returns; available ${pairs.length}.`,
    );
  if (
    !firstOn ||
    !lastOn ||
    Date.parse(lastOn) - Date.parse(firstOn) < 84 * 86400000
  )
    reasons.push('Need at least 84 calendar days of common history.');
  if (
    !lastOn ||
    Date.parse(at.slice(0, 10)) - Date.parse(lastOn) > 7 * 86400000
  )
    reasons.push(
      'Latest common observation must be within seven calendar days.',
    );
  if (gaps)
    reasons.push('Common history contains a gap longer than seven days.');
  if (factor.status !== 'published')
    reasons.push('A currently published ECB factor edition is required.');
  let fit: z.infer<typeof Fit> | null = null;
  if (!reasons.length) {
    const n = pairs.length,
      mx = pairs.reduce((s, p) => s + p.x, 0) / n,
      my = pairs.reduce((s, p) => s + p.y, 0) / n,
      sxx = pairs.reduce((s, p) => s + (p.x - mx) ** 2, 0),
      syy = pairs.reduce((s, p) => s + (p.y - my) ** 2, 0),
      sxy = pairs.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
    if (sxx < 1e-12 || syy < 1e-12)
      reasons.push(
        'Factor/company return variance is insufficient for a stable fit.',
      );
    else {
      const slope = sxy / sxx,
        intercept = my - slope * mx,
        residuals = pairs.map((p) => p.y - intercept - slope * p.x),
        rss = residuals.reduce((s, r) => s + r * r, 0),
        standardError = Math.sqrt(rss / (n - 2) / sxx),
        residualLagOne = rss
          ? residuals.slice(1).reduce((s, r, i) => s + r * residuals[i]!, 0) /
            rss
          : 0;
      fit = {
        slope,
        intercept,
        standardError,
        conditionalNormalInterval: [
          slope - 1.96 * standardError,
          slope + 1.96 * standardError,
        ],
        residualLagOne,
        rSquared: Math.max(0, Math.min(1, 1 - rss / syy)),
      };
      if (Math.abs(residualLagOne) > 0.2)
        reasons.push(
          'Residual serial correlation exceeds the explicit 0.2 review threshold; uncertainty is not qualified.',
        );
    }
  }
  if (!admittedAdjustment)
    reasons.push(
      'NSE/BSE close history is unadjusted; verified corporate-action adjustment coverage is required before any forecast.',
    );
  else
    reasons.push(
      `Uses independently reviewed source-window normalization ${adjustment!.id}; split/bonus and cash-dividend factors are preserved, not reinvested total return.`,
    );
  reasons.push(
    'OLS describes paired historical percentage returns, not a causal coefficient. Conditional normal intervals assume an adequate linear model and independent constant-variance residuals; these assumptions are not established.',
    'No portfolio loss, goal change, expected return or trade is generated.',
  );
  return ImpactCalibrationResultSchema.parse({
    model: admittedAdjustment
      ? 'daily-fx-company-adjusted-ols-v1'
      : 'daily-fx-company-ols-v1',
    status: fit ? 'diagnostic-only' : 'insufficient-data',
    pairs: pairs.length,
    firstOn,
    lastOn,
    fit,
    reasons,
    forecastEnabled: false,
    quantifiedPortfolioImpact: null,
  });
}
