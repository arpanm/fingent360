import { sbiDisplayed } from './portfolio-decimal.js';
export const AXIS_PORTFOLIO_URL =
  'https://transact.axismf.com/cms/sites/default/files/Statutory/Monthly%20Portfolio-28%2002%2026.xlsx';
import { z } from 'zod';
export const SBI_PORTFOLIO_URL =
  'https://www.sbimf.com/docs/default-source/scheme-portfolios/sbi-contra-fund-monthly-portfolio---august-2026.xlsx?sfvrsn=3d25bf11_2';
export const SBI_PORTFOLIO_JULY_URL =
  'https://www.sbimf.com/docs/default-source/scheme-portfolios/sbi-contra-fund-monthly-portfolio---july-2026.xlsx?sfvrsn=5d225bc7_2';
export const SBI_PORTFOLIO_SOURCES = [
  {
    url: SBI_PORTFOLIO_URL,
    date: '2026-08-31',
    serial: '46265',
    label: 'SBI Contra August 2026',
  },
  {
    url: SBI_PORTFOLIO_JULY_URL,
    date: '2026-07-31',
    serial: '46234',
    label: 'SBI Contra July 2026',
  },
] as const;
export const FUND_PORTFOLIO_SOURCES = [
  ...SBI_PORTFOLIO_SOURCES,
  {
    url: AXIS_PORTFOLIO_URL,
    date: '2026-02-28',
    label: 'Axis NIFTY50 ETF February2026',
  },
] as const;
export const SbiPortfolioUrlSchema = z.enum([
  SBI_PORTFOLIO_URL,
  SBI_PORTFOLIO_JULY_URL,
  AXIS_PORTFOLIO_URL,
]);
export const SBI_PORTFOLIO_PARSER = 'sbi-contra-august-2026-v1';
const amount = z.string().regex(/^-?(0|[1-9][0-9]{0,13})\.[0-9]{2}$/);
export const SbiPortfolioRowSchema = z.strictObject({
  sourceCells: z.array(z.string()).max(9).optional(),
  yieldPercent: amount.nullable().optional(),
  row: z.number().int().positive(),
  name: z.string().min(1).max(200),
  isin: z
    .string()
    .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)
    .nullable(),
  classification: z.string().max(160),
  quantity: z
    .string()
    .regex(/^-?(0|[1-9][0-9]{0,17})$/)
    .nullable(),
  amountLakh: amount,
  reportedWeightPercent: z.union([amount, z.literal('#')]),
  section: z.enum([
    'equity',
    'stock-options',
    'reit',
    'foreign',
    'treasury',
    'treps',
    'current',
    'derivatives',
  ]),
  direction: z.enum(['Long', 'Short']).nullable(),
});
export const SbiPortfolioSchema = z
  .strictObject({
    parser: z.enum([
      SBI_PORTFOLIO_PARSER,
      'sbi-contra-structural-v2',
      'axis-nifty50-february-2026-v1',
    ]),
    scheme: z.enum(['SBI Contra Fund', 'Axis NIFTY 50 ETF']),
    asOf: z.enum(['2026-08-31', '2026-07-31', '2026-02-28']),
    currency: z.literal('INR'),
    amountUnit: z.literal('lakh'),
    displayScale: z.literal(2),
    aumLakh: amount,
    sourceTotals: z
      .array(z.tuple([z.string(), z.string(), z.string()]))
      .length(4)
      .optional(),
    rows: z.array(SbiPortfolioRowSchema).min(1).max(200),
    totals: z
      .array(
        z.strictObject({
          section: SbiPortfolioRowSchema.shape.section,
          amountLakh: amount,
          reportedWeightPercent: z.union([amount, z.literal('#')]),
        }),
      )
      .min(1)
      .max(8),
    warnings: z.array(z.string().max(500)).max(210),
    quality: z.enum(['reconciled-disclosure', 'source-discrepancy']),
    completeExposure: z.literal(false),
  })
  .superRefine((v, c) => {
    if (v.parser === 'axis-nifty50-february-2026-v1') {
      const rawTotals = v.sourceTotals;
      try {
        if (
          !rawTotals ||
          rawTotals[3]?.[0] !== 'aum' ||
          sbiDisplayed(rawTotals[3][1]) !== v.aumLakh ||
          rawTotals[3][2] !== '1' ||
          v.totals.length !== 3 ||
          new Set(v.rows.map((r) => r.row)).size !== 52
        )
          throw Error();
        for (let i = 0; i < 3; i++) {
          const raw = rawTotals[i]!,
            total = v.totals[i]!;
          if (
            raw[0] !== total.section ||
            sbiDisplayed(raw[1]) !== total.amountLakh ||
            sbiDisplayed(
              raw[2].replace(
                /(?:[Ee]([+-]?\d+))?$/,
                (_m, e: string | undefined) => 'e' + String(Number(e ?? 0) + 2),
              ),
            ) !== total.reportedWeightPercent
          )
            throw Error();
        }
      } catch {
        c.addIssue({
          code: 'custom',
          message:
            'Axis totals do not reconstruct from retained original cells.',
        });
      }
      if (
        v.scheme !== 'Axis NIFTY 50 ETF' ||
        v.asOf !== '2026-02-28' ||
        v.rows.length !== 52
      )
        c.addIssue({
          code: 'custom',
          message: 'Axis scheme/date/row count does not match its policy.',
        });
      for (const row of v.rows) {
        try {
          const cells = row.sourceCells;
          if (
            !cells ||
            cells.length !== 9 ||
            cells[1] !== row.name ||
            cells[2] !== (row.isin ?? '') ||
            cells[3] !== row.classification ||
            cells[4] !== (row.quantity ?? '') ||
            sbiDisplayed(cells[5]!) !== row.amountLakh ||
            sbiDisplayed(
              cells[6]!.replace(
                /(?:[Ee]([+-]?\d+))?$/,
                (_m, e: string | undefined) => 'e' + String(Number(e ?? 0) + 2),
              ),
            ) !== row.reportedWeightPercent
          )
            throw Error();
          if (row.row >= 7 && row.row <= 56) {
            if (row.section !== 'equity' || row.yieldPercent !== null)
              throw Error();
          } else if (row.row === 62) {
            if (
              row.section !== 'treps' ||
              sbiDisplayed(
                cells[7]!.replace(
                  /(?:[Ee]([+-]?\d+))?$/,
                  (_m, e: string | undefined) =>
                    'e' + String(Number(e ?? 0) + 2),
                ),
              ) !== row.yieldPercent
            )
              throw Error();
          } else if (
            row.row !== 65 ||
            row.section !== 'current' ||
            row.yieldPercent !== null
          )
            throw Error();
        } catch {
          c.addIssue({
            code: 'custom',
            message:
              'Axis row does not reconstruct from retained lexical cells.',
          });
        }
      }
    } else if (
      v.scheme !== 'SBI Contra Fund' ||
      !['2026-08-31', '2026-07-31'].includes(v.asOf)
    )
      c.addIssue({
        code: 'custom',
        message: 'SBI scheme/date conflicts with its parser.',
      });
  });
export const SbiPortfolioCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  sourceUrl: SbiPortfolioUrlSchema.default(SBI_PORTFOLIO_URL),
  permissionReference: z.string().trim().min(10).max(2000),
  body: z.string().max(2800000).optional(),
});
export const SbiPortfolioEditionSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceUrl: SbiPortfolioUrlSchema,
  retrievedAt: z.iso.datetime(),
  portfolio: SbiPortfolioSchema.nullable(),
  error: z.string().max(500).nullable(),
  state: z.enum(['quarantined', 'draft', 'published', 'withdrawn']),
  mapping: z
    .strictObject({
      schemeCode: z.string().regex(/^[0-9]{5,8}$/),
      navEditionId: z.uuid(),
      schemeName: z.string(),
      plan: z.string().nullable(),
      option: z.string().nullable(),
    })
    .nullable(),
  reviewedAt: z.iso.datetime().nullable(),
});
export const SbiPortfolioReviewSchema = z.strictObject({
  requestId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  schemeCode: z
    .string()
    .regex(/^[0-9]{5,8}$/)
    .optional(),
  reason: z.string().trim().min(20).max(2000),
  acknowledgeDiscrepancy: z.boolean().default(false),
});
export const SbiPortfolioListSchema = z.strictObject({
  editions: z.array(SbiPortfolioEditionSchema).max(30),
});
export const SbiPortfolioSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  editions: z.array(SbiPortfolioEditionSchema).max(100),
});
export type SbiPortfolio = z.infer<typeof SbiPortfolioSchema>;

export const SbiPortfolioEvidenceSchema = z.strictObject({
  id: z.uuid(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  body: z.string().min(1).max(2800000),
  encoding: z.literal('base64'),
});
