import { z } from 'zod';
export const SOVEREIGN_ORIGINALS = [
  {
    kind: 'auction',
    url: 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=62540',
    mime: 'text/html',
    dateBasis: 'publication',
    documentDate: '2026-04-10',
  },
  {
    kind: 'terms',
    url: 'https://egazette.gov.in/WriteReadData/2026/271595.pdf',
    mime: 'application/pdf',
    dateBasis: 'publication',
    documentDate: '2026-04-06',
  },
  {
    kind: 'identity',
    url: 'https://archives.nseindia.com/content/indices/ind_debt_Nifty_Composite.pdf',
    mime: 'application/pdf',
    dateBasis: 'as-of',
    documentDate: '2026-08-31',
  },
  {
    kind: 'conventions',
    url: 'https://m.rbi.org.in/commonman/english/scripts/FAQs.aspx?Id=711',
    mime: 'text/html',
    dateBasis: 'publication',
    documentDate: '2020-04-01',
  },
] as const;
const original = z.strictObject({
  kind: z.enum(['auction', 'terms', 'identity', 'conventions']),
  body: z.string().min(8).max(2800000),
});
export const SovereignCaptureSchema = z
  .strictObject({
    requestId: z.uuid(),
    originals: z.array(original).length(4),
    permissionReference: z.string().trim().min(10).max(2000),
    originalsConfirmed: z.literal(true),
  })
  .superRefine((v, c) => {
    if (new Set(v.originals.map((o) => o.kind)).size !== 4)
      c.addIssue({
        code: 'custom',
        message: 'Provide each exact original once.',
      });
  });
export const SovereignTermsSchema = z.strictObject({
  version: z.literal('goi-648-2035-auction-20260410-v1'),
  isin: z.literal('IN0020250091'),
  name: z.literal('6.48% GS 2035'),
  issuer: z.literal('Government of India'),
  couponBps: z.literal(648),
  issuedOn: z.literal('2025-10-06'),
  maturityOn: z.literal('2035-10-06'),
  auctionOn: z.literal('2026-04-10'),
  settlementOn: z.literal('2026-04-13'),
  previousCouponOn: z.literal('2026-04-06'),
  nextCouponOn: z.literal('2026-10-06'),
  accrualDays: z.literal(7),
  basis: z.literal('30E/360'),
  cutoffPricePaisePer100: z.literal('9667'),
  weightedPricePaisePer100: z.literal('9669'),
  cutoffYtmPercent: z.literal('6.9655'),
  weightedYtmPercent: z.literal('6.9625'),
  quoteKind: z.literal('historical-primary-auction'),
  credit: z.literal('sovereign-issuer-not-credit-agency-rating'),
  liquidity: z.literal('not-established'),
  futurePaymentHolidays: z.literal('not-established'),
  extraction: z.literal('independently-reviewed-original-pack'),
});
export const SOVEREIGN_TERMS = SovereignTermsSchema.parse({
  version: 'goi-648-2035-auction-20260410-v1',
  isin: 'IN0020250091',
  name: '6.48% GS 2035',
  issuer: 'Government of India',
  couponBps: 648,
  issuedOn: '2025-10-06',
  maturityOn: '2035-10-06',
  auctionOn: '2026-04-10',
  settlementOn: '2026-04-13',
  previousCouponOn: '2026-04-06',
  nextCouponOn: '2026-10-06',
  accrualDays: 7,
  basis: '30E/360',
  cutoffPricePaisePer100: '9667',
  weightedPricePaisePer100: '9669',
  cutoffYtmPercent: '6.9655',
  weightedYtmPercent: '6.9625',
  quoteKind: 'historical-primary-auction',
  credit: 'sovereign-issuer-not-credit-agency-rating',
  liquidity: 'not-established',
  futurePaymentHolidays: 'not-established',
  extraction: 'independently-reviewed-original-pack',
});
export const SovereignEditionSchema = z
  .strictObject({
    id: z.uuid(),
    terms: SovereignTermsSchema,
    recordedAt: z.iso.datetime(),
    retrievedAt: z.null(),
    originals: z
      .array(
        z.strictObject({
          kind: original.shape.kind,
          url: z.url(),
          mime: z.enum(['text/html', 'application/pdf']),
          documentDate: z.iso.date(),
          dateBasis: z.enum(['publication', 'as-of']),
          hash: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .length(4),
    state: z.enum(['draft', 'quarantined', 'published', 'withdrawn']),
    error: z.string().nullable(),
    reviewedAt: z.iso.datetime().nullable(),
  })
  .superRefine((v, c) => {
    if (new Set(v.originals.map((o) => o.kind)).size !== 4)
      c.addIssue({
        code: 'custom',
        message: 'Each source original is required.',
      });
    for (const item of v.originals) {
      const known = SOVEREIGN_ORIGINALS.find((o) => o.kind === item.kind);
      if (
        !known ||
        item.url !== known.url ||
        item.mime !== known.mime ||
        item.documentDate !== known.documentDate ||
        item.dateBasis !== known.dateBasis
      )
        c.addIssue({
          code: 'custom',
          message: 'Original does not match the bounded source pack.',
        });
    }
  });
export const SovereignListSchema = z.strictObject({
  editions: z.array(SovereignEditionSchema).max(25),
  nextCursor: z.string().nullable(),
});
export const SovereignSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  editions: z.array(SovereignEditionSchema).max(100),
});
export const SovereignReviewSchema = z.strictObject({
  requestId: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(2000),
  allOriginalsChecked: z.boolean(),
  termsVersion: SovereignTermsSchema.shape.version,
  sourceHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).length(4),
});
export const SovereignCalculationInputSchema = z.strictObject({
  nominalPaise: z.string().regex(/^[1-9]\d{3,15}$/),
  price: z.enum(['cutoff', 'weighted']),
});
export const SovereignCalculationSchema = z.strictObject({
  editionId: z.uuid(),
  termsVersion: SovereignTermsSchema.shape.version,
  input: SovereignCalculationInputSchema,
  settlementOn: z.literal('2026-04-13'),
  cleanPaise: z.string().regex(/^\d+$/),
  accruedPaise: z.string().regex(/^\d+$/),
  dirtyPaise: z.string().regex(/^\d+$/),
  rounding: z.literal('aggregate-half-up-paise'),
  executionPrice: z.literal(false),
  holdingMutation: z.literal(false),
});
export function calculateSovereignAuction(edition: unknown, value: unknown) {
  const source = SovereignEditionSchema.parse(edition),
    input = SovereignCalculationInputSchema.parse(value);
  if (source.state !== 'published')
    throw Error('Published original source pack required.');
  const face = BigInt(input.nominalPaise),
    round = (n: bigint, d: bigint) => (n * 2n + d) / (d * 2n),
    clean = round(
      face *
        BigInt(
          input.price === 'cutoff'
            ? source.terms.cutoffPricePaisePer100
            : source.terms.weightedPricePaisePer100,
        ),
      10000n,
    ),
    accrued = round(face * 648n * 7n, 10000n * 360n);
  return SovereignCalculationSchema.parse({
    editionId: source.id,
    termsVersion: source.terms.version,
    input,
    settlementOn: source.terms.settlementOn,
    cleanPaise: String(clean),
    accruedPaise: String(accrued),
    dirtyPaise: String(clean + accrued),
    rounding: 'aggregate-half-up-paise',
    executionPrice: false,
    holdingMutation: false,
  });
}
