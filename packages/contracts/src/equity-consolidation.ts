import { z } from 'zod';
import { EquityCompanySchema } from './equity-coverage.js';
import { adjustmentBindings } from './equity-adjustments.js';

const isin = EquityCompanySchema.shape.isin;
const amount = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/)
  .refine((value) => decimal(value).n > 0n, 'Amount must be positive.');
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const document = z.strictObject({
  role: z.enum(['suspension', 'resumption', 'issuer-terms']),
  url: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }),
  publishedOn: z.iso.date(),
  pdfBase64: z
    .string()
    .min(12)
    .max(2800000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  page: z.number().int().min(1).max(1000),
  transcription: z.string().trim().min(30).max(3000),
});
export const ConsolidationInputSchema = z
  .strictObject({
    requestId: z.uuid(),
    oldIsin: isin,
    newIsin: isin,
    lastOldTradeOn: z.iso.date(),
    suspendedOn: z.iso.date(),
    recordOn: z.iso.date(),
    resumedOn: z.iso.date(),
    oldFaceValue: amount,
    newFaceValue: amount,
    documents: z.array(document).length(3),
    coverageEvidence: z.string().trim().min(30).max(3000),
    rightsEvidence: z.string().trim().min(20).max(3000),
    pureConsolidationConfirmed: z.literal(true),
    rightsConfirmed: z.literal(true),
  })
  .superRefine((v, ctx) => {
    if (
      v.oldIsin === v.newIsin ||
      !(
        v.lastOldTradeOn < v.suspendedOn &&
        v.suspendedOn <= v.recordOn &&
        v.recordOn < v.resumedOn
      )
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Distinct identities and ordered last-trade, suspension, record and resumption dates are required.',
      });
    if (new Set(v.documents.map((d) => d.role)).size !== 3)
      ctx.addIssue({
        code: 'custom',
        message: 'Retain one original for each document role.',
      });
    for (const d of v.documents) {
      if (
        d.role !== 'issuer-terms' &&
        !/^https:\/\/(?:nsearchives|archives)\.nseindia\.com\/content\/circulars\/CML\d+\.pdf$/.test(
          d.url,
        )
      )
        ctx.addIssue({
          code: 'custom',
          message:
            'Exchange notices require an original NSE cash-market listing circular URL.',
        });
      if (
        d.publishedOn > (d.role === 'resumption' ? v.resumedOn : v.suspendedOn)
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Announcement must precede its exchange event.',
        });
    }
  });
const source = document.omit({ pdfBase64: true }).extend({ hash });
const binding = z.strictObject({ editionId: z.uuid(), hash });
export const ConsolidationReceiptSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.literal(1),
    policy: z.literal('reviewed-pure-consolidation-nominal-v1'),
    oldIsin: isin,
    newIsin: isin,
    lastOldTradeOn: z.iso.date(),
    suspendedOn: z.iso.date(),
    recordOn: z.iso.date(),
    resumedOn: z.iso.date(),
    oldFaceValue: amount,
    newFaceValue: amount,
    numerator: z.string().regex(/^[1-9]\d{0,79}$/),
    denominator: z.string().regex(/^[1-9]\d{0,79}$/),
    oldClose: amount,
    oldCloseInNewShareUnits: z
      .string()
      .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/),
    newClose: amount,
    sourceHash: hash,
    documents: z.array(source).length(3),
    oldBindings: z.array(binding).min(1),
    newBindings: z.array(binding).min(1),
    coverageEvidence: z.string(),
    createdAt: z.iso.datetime(),
    reviewedAt: z.iso.datetime().nullable(),
    calibrationEligibility: z.literal(
      'ineligible-suspended-trading-transition',
    ),
  })
  .superRefine((v, ctx) => {
    const old = decimal(v.oldFaceValue),
      next = decimal(v.newFaceValue),
      price = decimal(v.oldClose);
    const n = BigInt(v.numerator),
      d = BigInt(v.denominator);
    if (
      n <= d ||
      n * next.d * old.n !== d * next.n * old.d ||
      v.oldCloseInNewShareUnits !== render(price.n * n, price.d * d) ||
      v.oldIsin === v.newIsin ||
      !(
        v.lastOldTradeOn < v.suspendedOn &&
        v.suspendedOn <= v.recordOn &&
        v.recordOn < v.resumedOn
      ) ||
      new Set(v.documents.map((doc) => doc.role)).size !== 3
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Consolidation dates and exact nominal comparison must reconstruct.',
      });
  });
export const ConsolidationReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(3000),
  originalsAndTermsConfirmed: z.boolean(),
});
export const ConsolidationQueueSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        receipt: ConsolidationReceiptSchema,
        state: z.enum(['draft', 'publish', 'withdraw']),
      }),
    )
    .max(20),
  next: z.uuid().nullable(),
});
export const ConsolidationPublicSchema = z.strictObject({
  bridges: z
    .array(
      ConsolidationReceiptSchema.refine(
        (v) => v.reviewedAt !== null,
        'Only independently published bridges may be public.',
      ),
    )
    .max(100),
  capturedAt: z.iso.datetime(),
});
function decimal(value: string) {
  const [w, f = ''] = value.split('.');
  return { n: BigInt(w! + f), d: 10n ** BigInt(f.length) };
}
function gcd(a: bigint, b: bigint): bigint {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}
function render(n: bigint, d: bigint) {
  const scaled = (n * 1000000000000n * 2n + d) / (2n * d);
  const s = scaled.toString().padStart(13, '0');
  return `${s.slice(0, -12)}.${s.slice(-12)}`
    .replace(/0+$/, '')
    .replace(/\.$/, '');
}
export function buildConsolidation(
  input: z.infer<typeof ConsolidationInputSchema>,
  oldCompany: z.infer<typeof EquityCompanySchema>,
  newCompany: z.infer<typeof EquityCompanySchema>,
  sourceHash: string,
  documents: z.infer<typeof source>[],
  createdAt: string,
) {
  if (
    oldCompany.isin !== input.oldIsin ||
    newCompany.isin !== input.newIsin ||
    oldCompany.truncated ||
    newCompany.truncated
  )
    throw Error('Complete old and new company evidence is required.');
  if (input.resumedOn > createdAt.slice(0, 10))
    throw Error('Future trading resumption cannot be admitted.');
  function identity(
    company: z.infer<typeof EquityCompanySchema>,
    date: string,
    face: string,
  ) {
    const rows = company.records
      .flatMap((r) =>
        r.observation.kind === 'identity' &&
        r.observation.exchange === 'NSE' &&
        r.observation.effectiveOn <= date
          ? [r.observation]
          : [],
      )
      .sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn));
    const newest = rows[0];
    if (
      !newest ||
      rows
        .filter((r) => r.effectiveOn === newest.effectiveOn)
        .some(
          (r) =>
            r.symbol !== newest.symbol ||
            r.series !== newest.series ||
            r.faceValue !== face,
        ) ||
      newest.faceValue !== face
    )
      throw Error(
        'Publish an unambiguous NSE identity with the stated face value first.',
      );
    return newest;
  }
  const oldIdentity = identity(
      oldCompany,
      input.lastOldTradeOn,
      input.oldFaceValue,
    ),
    newIdentity = identity(newCompany, input.resumedOn, input.newFaceValue);
  if (oldIdentity.symbol !== newIdentity.symbol)
    throw Error('Concurrent symbol changes need a separate identity policy.');
  function close(company: z.infer<typeof EquityCompanySchema>, date: string) {
    const rows = company.records.flatMap((r) =>
      r.observation.kind === 'price' &&
      r.observation.exchange === 'NSE' &&
      r.observation.effectiveOn === date
        ? [r.observation.close]
        : [],
    );
    if (!rows.length || new Set(rows).size !== 1 || decimal(rows[0]!).n <= 0n)
      throw Error(
        'Each boundary needs one unambiguous positive admitted traded close.',
      );
    return rows[0]!;
  }
  for (const company of [oldCompany, newCompany])
    for (const { observation: o } of company.records) {
      if (
        o.kind === 'price' &&
        o.exchange === 'NSE' &&
        o.effectiveOn >= input.suspendedOn &&
        o.effectiveOn < input.resumedOn
      )
        throw Error('A traded close conflicts with the declared suspension.');
      if (o.kind === 'corporate-action' && !o.nseAction)
        throw Error(
          'An action lacks an exact exchange ex-date; transition completeness is unqualified.',
        );
      if (
        o.kind === 'corporate-action' &&
        o.nseAction &&
        o.nseAction.exOn >= input.lastOldTradeOn &&
        o.nseAction.exOn <= input.resumedOn &&
        !/^Consolidation(?: of (?:Equity )?Shares)?$/i.test(o.purpose.trim())
      )
        throw Error(
          'Another action or compound purpose requires a separate policy.',
        );
    }
  if (
    oldCompany.records.some(
      (r) =>
        r.observation.kind === 'price' &&
        r.observation.effectiveOn >= input.resumedOn,
    ) ||
    newCompany.records.some(
      (r) =>
        r.observation.kind === 'price' &&
        r.observation.effectiveOn <= input.lastOldTradeOn,
    )
  )
    throw Error('A traded close conflicts with the old/new security boundary.');
  const old = decimal(input.oldFaceValue),
    next = decimal(input.newFaceValue);
  let n = next.n * old.d,
    d = next.d * old.n;
  if (n <= d) throw Error('A consolidation requires an increased face value.');
  const divisor = gcd(n, d);
  n /= divisor;
  d /= divisor;
  const oldClose = close(oldCompany, input.lastOldTradeOn),
    price = decimal(oldClose);
  return ConsolidationReceiptSchema.parse({
    id: input.requestId,
    version: 1,
    policy: 'reviewed-pure-consolidation-nominal-v1',
    oldIsin: input.oldIsin,
    newIsin: input.newIsin,
    lastOldTradeOn: input.lastOldTradeOn,
    suspendedOn: input.suspendedOn,
    recordOn: input.recordOn,
    resumedOn: input.resumedOn,
    oldFaceValue: input.oldFaceValue,
    newFaceValue: input.newFaceValue,
    numerator: n.toString(),
    denominator: d.toString(),
    oldClose,
    oldCloseInNewShareUnits: render(price.n * n, price.d * d),
    newClose: close(newCompany, input.resumedOn),
    sourceHash,
    documents,
    oldBindings: adjustmentBindings(oldCompany),
    newBindings: adjustmentBindings(newCompany),
    coverageEvidence: input.coverageEvidence,
    createdAt,
    reviewedAt: null,
    calibrationEligibility: 'ineligible-suspended-trading-transition',
  });
}
