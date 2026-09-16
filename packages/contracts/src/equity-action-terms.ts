import { z } from 'zod';
import { EquityCompanySchema } from './equity-coverage.js';
import { adjustmentBindings } from './equity-adjustments.js';
const isin = EquityCompanySchema.shape.isin,
  hash = z.string().regex(/^[a-f0-9]{64}$/),
  positive = z.string().regex(/^[1-9]\d{0,7}$/),
  money = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/);
const original = z.strictObject({
  url: z.url().refine((v) => {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password;
  }),
  publishedOn: z.iso.date(),
  mediaType: z.enum(['application/pdf', 'text/html']),
  bytesBase64: z
    .string()
    .min(12)
    .max(11000000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  section: z.string().trim().min(1).max(100),
  transcription: z.string().trim().min(30).max(6000),
});
const terms = z
  .strictObject({
    kind: z.enum(['rights', 'stock-swap-merger']),
    oldIsin: isin,
    newIsin: isin,
    oldUnits: positive,
    newUnits: positive,
    subscriptionPrice: money,
    fixedCashPerOldShare: z.literal('0'),
    exOn: z.iso.date(),
    recordOn: z.iso.date(),
    effectiveOn: z.iso.date(),
    priceOn: z.iso.date(),
    opensOn: z.iso.date().nullable(),
    closesOn: z.iso.date().nullable(),
    renunciationEndsOn: z.iso.date().nullable(),
    fractionTreatment: z.string().trim().min(20).max(1000),
  })
  .superRefine((v, c) => {
    const bad = (message: string) => c.addIssue({ code: 'custom', message });
    if (v.priceOn >= v.exOn || v.recordOn < v.exOn)
      bad(
        'Reference close must precede ex-date; record date cannot precede ex-date.',
      );
    if (v.kind === 'rights') {
      if (
        v.oldIsin !== v.newIsin ||
        dec(v.subscriptionPrice).n <= 0n ||
        !v.opensOn ||
        !v.closesOn ||
        !v.renunciationEndsOn ||
        !(
          v.recordOn < v.opensOn &&
          v.opensOn <= v.renunciationEndsOn &&
          v.renunciationEndsOn <= v.closesOn
        ) ||
        v.effectiveOn !== v.exOn
      )
        bad(
          'Rights require one identity, fully payable subscription price and ordered issue dates.',
        );
    } else if (
      v.oldIsin === v.newIsin ||
      v.subscriptionPrice !== '0' ||
      v.opensOn ||
      v.closesOn ||
      v.renunciationEndsOn ||
      v.effectiveOn > v.recordOn
    )
      bad(
        'Pure stock swap requires two identities, no subscription/fixed cash and no rights dates.',
      );
  });
export const ActionTermsInputSchema = z.strictObject({
  requestId: z.uuid(),
  terms,
  original,
  rightsEvidence: z.string().trim().min(20).max(3000),
  rightsConfirmed: z.literal(true),
  completeTermsConfirmed: z.literal(true),
});
const fraction = z.strictObject({
  numerator: z.string().regex(/^\d+$/),
  denominator: z.string().regex(/^[1-9]\d*$/),
  display: z.string().regex(/^\d+(?:\.\d{1,12})?$/),
});
const binding = z.strictObject({ editionId: z.uuid(), hash });
export const ActionTermsReceiptSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.literal(1),
    policy: z.literal('reviewed-rights-merger-comparison-v1'),
    terms,
    sourceHash: hash,
    original: original.omit({ bytesBase64: true }).extend({ hash }),
    oldClose: money,
    newClose: money,
    comparison: fraction,
    comparisonBasis: z.enum([
      'theoretical-full-subscription-rights',
      'transferor-price-per-transferee-share-unit',
    ]),
    oldBindings: z.array(binding).min(1),
    newBindings: z.array(binding).min(1),
    createdAt: z.iso.datetime(),
    reviewedAt: z.iso.datetime().nullable(),
    calibrationEligibility: z.literal(
      'ineligible-conditional-complex-action-comparison',
    ),
  })
  .superRefine((v, c) => {
    const expected = calculate(v.terms, v.oldClose);
    if (
      JSON.stringify(expected) !== JSON.stringify(v.comparison) ||
      v.comparisonBasis !==
        (v.terms.kind === 'rights'
          ? 'theoretical-full-subscription-rights'
          : 'transferor-price-per-transferee-share-unit') ||
      v.original.publishedOn > v.createdAt.slice(0, 10) ||
      v.terms.priceOn > v.createdAt.slice(0, 10) ||
      dec(v.oldClose).n <= 0n ||
      dec(v.newClose).n <= 0n ||
      (v.terms.kind === 'rights' && v.newClose !== v.oldClose)
    )
      c.addIssue({
        code: 'custom',
        message: 'Source dates and exact comparison must reconstruct.',
      });
  });
export const ActionTermsReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(20).max(3000),
  originalsAndTermsConfirmed: z.boolean(),
});
export const ActionTermsQueueSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        receipt: ActionTermsReceiptSchema,
        state: z.enum(['draft', 'publish', 'withdraw']),
      }),
    )
    .max(20),
  next: z.uuid().nullable(),
});
export const ActionTermsPublicSchema = z.strictObject({
  actions: z
    .array(
      ActionTermsReceiptSchema.refine(
        (v) => v.reviewedAt !== null,
        'Only reviewed terms may be public.',
      ),
    )
    .max(100),
  capturedAt: z.iso.datetime(),
});
function dec(v: string) {
  const [w, f = ''] = v.split('.');
  return { n: BigInt(w! + f), d: 10n ** BigInt(f.length) };
}
function calculate(t: z.infer<typeof terms>, close: string) {
  const p = dec(close),
    s = dec(t.subscriptionPrice),
    old = BigInt(t.oldUnits),
    next = BigInt(t.newUnits);
  let n = t.kind === 'rights' ? old * p.n * s.d + next * s.n * p.d : p.n * old,
    d = t.kind === 'rights' ? (old + next) * p.d * s.d : p.d * next;
  let a = n,
    b = d;
  while (b) {
    [a, b] = [b, a % b];
  }
  n /= a;
  d /= a;
  const units = (n * 1000000000000n * 2n + d) / (2n * d),
    value = units.toString().padStart(13, '0');
  return {
    numerator: n.toString(),
    denominator: d.toString(),
    display: `${value.slice(0, -12)}.${value.slice(-12)}`
      .replace(/0+$/, '')
      .replace(/\.$/, ''),
  };
}
export function buildActionTerms(
  input: z.infer<typeof ActionTermsInputSchema>,
  oldCompany: z.infer<typeof EquityCompanySchema>,
  newCompany: z.infer<typeof EquityCompanySchema>,
  sourceHash: string,
  documentHash: string,
  createdAt: string,
) {
  const t = input.terms;
  if (
    oldCompany.isin !== t.oldIsin ||
    newCompany.isin !== t.newIsin ||
    oldCompany.truncated ||
    newCompany.truncated
  )
    throw Error('Complete exact company sources required.');
  function close(company: z.infer<typeof EquityCompanySchema>) {
    const identities = company.records.filter(
      (r) =>
        r.observation.kind === 'identity' &&
        r.observation.exchange === 'NSE' &&
        r.observation.effectiveOn <= t.priceOn,
    );
    if (!identities.length) throw Error('Admit dated NSE identity first.');
    const latest = identities
      .map((r) => r.observation.effectiveOn)
      .sort()
      .at(-1);
    const names = identities
      .filter((r) => r.observation.effectiveOn === latest)
      .map((r) =>
        r.observation.kind === 'identity'
          ? `${r.observation.symbol}|${r.observation.series}`
          : '',
      );
    if (new Set(names).size !== 1)
      throw Error('Conflicting dated security identity.');
    if (
      company.records.some(
        (r) =>
          r.observation.kind === 'price' &&
          r.observation.exchange === 'NSE' &&
          r.observation.effectiveOn > t.priceOn &&
          r.observation.effectiveOn < t.exOn,
      )
    )
      throw Error(
        'A later admitted pre-ex-date close exists; select the latest retained common reference date.',
      );
    const values = company.records.flatMap((r) =>
      r.observation.kind === 'price' &&
      r.observation.exchange === 'NSE' &&
      r.observation.effectiveOn === t.priceOn
        ? [r.observation.close]
        : [],
    );
    if (!values.length || new Set(values).size !== 1 || dec(values[0]!).n <= 0n)
      throw Error(
        'Each issuer needs one unambiguous positive close on the same reference day.',
      );
    return values[0]!;
  }
  const action = oldCompany.records.some(
    (r) =>
      r.observation.kind === 'corporate-action' &&
      r.observation.nseAction?.exOn === t.exOn &&
      r.observation.recordOn === t.recordOn &&
      (t.kind === 'rights' ? /rights/i : /merger|amalgamation/i).test(
        r.observation.purpose,
      ),
  );
  if (!action)
    throw Error(
      'Admit the exact issuer action with matching ex-date and record date first.',
    );
  const quote = input.original.transcription;
  if (
    !quote.includes(t.oldUnits) ||
    !quote.includes(t.newUnits) ||
    (t.kind === 'rights' && !quote.includes(t.subscriptionPrice))
  )
    throw Error(
      'Original transcription must include exact ratio and subscription terms.',
    );
  const oldClose = close(oldCompany),
    newClose = close(newCompany),
    doc = original.omit({ bytesBase64: true }).parse({
      url: input.original.url,
      publishedOn: input.original.publishedOn,
      mediaType: input.original.mediaType,
      section: input.original.section,
      transcription: input.original.transcription,
    });
  return ActionTermsReceiptSchema.parse({
    id: input.requestId,
    version: 1,
    policy: 'reviewed-rights-merger-comparison-v1',
    terms: t,
    sourceHash,
    original: { ...doc, hash: documentHash },
    oldClose,
    newClose,
    comparison: calculate(t, oldClose),
    comparisonBasis:
      t.kind === 'rights'
        ? 'theoretical-full-subscription-rights'
        : 'transferor-price-per-transferee-share-unit',
    oldBindings: adjustmentBindings(oldCompany),
    newBindings: adjustmentBindings(newCompany),
    createdAt,
    reviewedAt: null,
    calibrationEligibility: 'ineligible-conditional-complex-action-comparison',
  });
}
