import { z } from 'zod';
import {
  OIL_BENCHMARK_URL,
  OIL_BENCHMARK_TERMS,
  OIL_BENCHMARK_LICENSE,
} from './oil-benchmarks.js';
import {
  parsePinkSheetColumns,
  roundPinkSheetValue,
} from './oil-benchmark-parser.js';
export const COMMODITY_SERIES = {
  COPPER: {
    description:
      'LME grade A settlement benchmark; minimum 99.9935% purity. Monthly aggregate, not a live LME quote.',
    providers:
      'Bloomberg Finance L.P.; Engineering and Mining Journal; Platts Metals Week; Thomson Reuters Datastream; World Bank.',
    name: 'Copper',
    column: 'BM',
    header: 'Copper',
    unit: 'USD-per-metric-ton',
    sourceUnit: '($/mt)',
    precision: 0,
  },
  GOLD: {
    description:
      'Method changed in June 2025: monthly average of spot daily rates; earlier values used UK London afternoon fixing. Do not assume an unchanged benchmark across that boundary.',
    providers:
      'Bloomberg Finance L.P.; Kitco.com; IMF International Financial Statistics; London Bullion Market; Metals Week; Platts Metals Week; Shearson Lehman Brothers; Thomson Reuters Datastream; World Bank.',
    name: 'Gold',
    column: 'BR',
    header: 'Gold',
    unit: 'USD-per-troy-ounce',
    sourceUnit: '($/troy oz)',
    precision: 0,
  },
  SILVER: {
    description:
      'UK 99.9% refined silver, London afternoon fixing; displayed here as monthly benchmark context.',
    providers:
      'American Metal Market; Australian Mineral Economics; Bloomberg Finance L.P.; London Bullion Market; Metals Week; Metals Statistics; Platts Metals Week; The Silver Institute; Thomson Reuters Datastream; World Bank.',
    name: 'Silver',
    column: 'BT',
    header: 'Silver',
    unit: 'USD-per-troy-ounce',
    sourceUnit: '($/troy oz)',
    precision: 1,
  },
} as const;
export const CommoditySeriesSchema = z.enum(['COPPER', 'GOLD', 'SILVER']);
export const CommodityObservationSchema = z
  .strictObject({
    series: CommoditySeriesSchema,
    period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
    value: z
      .string()
      .regex(/^(0|[1-9]\d{0,14})(\.\d)?$/)
      .nullable(),
    sourceValue: z.string().max(50).nullable(),
  })
  .superRefine((row, c) => {
    try {
      if (
        (row.sourceValue === null) !== (row.value === null) ||
        (row.sourceValue !== null &&
          roundPinkSheetValue(
            row.sourceValue,
            COMMODITY_SERIES[row.series].precision,
          ) !== row.value)
      )
        throw Error();
    } catch {
      c.addIssue({
        code: 'custom',
        message: 'Stored display value does not reconcile to original cell.',
      });
    }
  });
export const CommodityReceiptSchema = z
  .strictObject({
    id: z.uuid(),
    sourceUrl: z.literal(OIL_BENCHMARK_URL),
    termsUrl: z.literal(OIL_BENCHMARK_TERMS),
    license: z.literal(OIL_BENCHMARK_LICENSE),
    attribution: z.literal(
      'World Bank: Commodity Prices — History and Projections (Pink Sheet); original data providers identified in the retained workbook.',
    ),
    parser: z.literal('world-bank-pink-sheet-metals-v1'),
    bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
    retainedAt: z.iso.datetime(),
    retrievedAt: z.iso.datetime().nullable(),
    acquisition: z.enum(['official-download', 'operator-upload']),
    reportedUpdatedOn: z.iso.date(),
    frequency: z.literal('monthly'),
    vintageBasis: z.literal('retained-revision-only'),
    observations: z.array(CommodityObservationSchema).min(3).max(7200),
  })
  .superRefine((v, c) => {
    if (
      v.reportedUpdatedOn > v.retainedAt.slice(0, 10) ||
      (v.retrievedAt && v.retrievedAt > v.retainedAt)
    )
      c.addIssue({
        code: 'custom',
        message: 'Source update/retrieval cannot follow retention.',
      });
    for (const series of CommoditySeriesSchema.options) {
      const rows = v.observations
        .filter((r) => r.series === series)
        .sort((a, b) => a.period.localeCompare(b.period));
      if (
        !rows.length ||
        rows[0]!.period !== '2000-01' ||
        rows.length !== v.observations.length / 3
      )
        c.addIssue({
          code: 'custom',
          message:
            'All three series require the same monthly grid from January 2000.',
        });
      rows.forEach((r, index) => {
        const period = new Date(Date.UTC(2000, index, 1))
          .toISOString()
          .slice(0, 7);
        if (r.period !== period || r.period >= v.reportedUpdatedOn.slice(0, 7))
          c.addIssue({
            code: 'custom',
            message: 'Duplicate, missing or incomplete observation month.',
          });
      });
    }
  });
export const CommodityCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  body: z.string().min(4).max(4000000).optional(),
  rightsEvidence: z.string().trim().min(20).max(2000),
});
export const CommodityReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(1000),
  rightsVerified: z.boolean(),
});
export const CommodityQueueItemsSchema = z
  .array(
    z.strictObject({
      id: z.uuid(),
      receipt: CommodityReceiptSchema.nullable(),
      error: z.string().nullable(),
      state: z.enum(['draft', 'quarantined', 'publish', 'withdraw']),
    }),
  )
  .max(100);
export const CommodityPublicSchema = z.strictObject({
  receipt: CommodityReceiptSchema,
  reviewedAt: z.iso.datetime(),
  editions: z.array(z.uuid()).max(100),
});
export function parseCommodityWorkbook(bytes: Uint8Array) {
  return parsePinkSheetColumns(
    bytes,
    Object.entries(COMMODITY_SERIES).map(([series, v]) => ({
      series,
      column: v.column,
      header: v.header,
      unit: v.sourceUnit,
      precision: v.precision,
    })),
  );
}
export const CommodityEvidenceSchema = z.strictObject({
  id: z.uuid(),
  sourceUrl: z.literal(OIL_BENCHMARK_URL),
  body: z.string().min(4).max(4000000),
  bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
  encoding: z.literal('base64'),
  retainedAt: z.iso.datetime(),
  rightsEvidence: z.string().max(2000).optional(),
});

export const CommodityQueueSchema = z.strictObject({
  items: CommodityQueueItemsSchema,
  next: z.uuid().nullable(),
});
