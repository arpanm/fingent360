import { z } from 'zod';
export const TransmissionFamilySchema = z.enum([
  'policy-rate',
  'inflation',
  'gdp',
  'earnings',
  'guidance',
  'regulatory',
  'flows',
]);
export const TransmissionMechanismSchema = z.strictObject({
  version: z.literal('qualitative-transmission-v1'),
  family: TransmissionFamilySchema,
  title: z.string(),
  mechanism: z.string(),
  conditions: z.array(z.string()).min(1),
  countervailing: z.array(z.string()).min(1),
  reference: z.url(),
  reviewedOn: z.literal('2026-09-15'),
  status: z.literal('educational-mechanism-not-identified-causality'),
});
const entries = [
  [
    'policy-rate',
    'Credit costs and demand',
    'Policy rates can influence borrowing costs and spending through financial conditions.',
    'Identify actual debt repricing, deposit mix and borrower demand before attributing a company effect.',
    'Transmission lags, hedges, deposit repricing and changing credit risk can offset the channel.',
    'https://www.federalreserve.gov/faqs/money_12856.htm',
  ],
  [
    'inflation',
    'Purchasing power and cost pass-through',
    'Inflation changes purchasing power; issuer costs and selling prices need separate evidence.',
    'Match the basket, geography and issuer cost/revenue exposure; headline CPI is not the company cost index.',
    'Pricing power, wage growth, input mix and substitution can reverse an assumed margin effect.',
    'https://investor.sebi.gov.in/securities-risks_trade_derivatives.html',
  ],
  [
    'gdp',
    'Demand composition and company exposure',
    'GDP combines several spending components; headline growth does not isolate company demand.',
    'Use the relevant geography, component and original release vintage before mapping an issuer exposure.',
    'Inventories, imports and revisions can move headline GDP without equivalent final customer demand.',
    'https://www.bea.gov/index.php/news/blog/2025-06-03/expenditures-approach-measuring-gdp',
  ],
  [
    'earnings',
    'Reported profit and cash generation',
    'Income and cash flow are distinct; reconcile operating results with cash generation.',
    'Match reporting period, accounting scope and units; inspect actual issuer revenue, profit and cash flow.',
    'One-off items, working capital and accounting changes can offset headline profit growth.',
    'https://www.sec.gov/about/reports-publications/investorpubsbegfinstmtguide',
  ],
  [
    'guidance',
    'Management outlook and uncertainty',
    'Management commentary supplies context and uncertainty, not a realized financial outcome.',
    'Retain the exact range, horizon, currency basis and assumptions from the issuer outlook.',
    'Demand, exchange rates and subsequent revisions can invalidate guidance; a midpoint is not a reported result.',
    'https://www.sec.gov/about/reports-publications/investorpubsbegfinstmtguide',
  ],
  [
    'regulatory',
    'Disclosure and operating constraints',
    'Material disclosures can change the information available to investors about a business.',
    'Read the authority, affected legal entity, effective date, appeal status and specific operating constraint.',
    'An allegation, investigation and final order differ; remediation and appeals can alter consequences.',
    'https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/public-companies',
  ],
  [
    'flows',
    'Investor category and market activity',
    'Reported investor-category flows describe activity within a defined source scope.',
    'Preserve participant category, venue, asset class, date and provisional status before comparing periods.',
    'Net flows are not ownership, available liquidity or a proven cause of an individual share-price move.',
    'https://www.sebi.gov.in/statistics/fpi-investment.html',
  ],
] as const;
export const TRANSMISSION_CATALOG = entries.map(
  ([family, title, mechanism, condition, counter, reference]) =>
    TransmissionMechanismSchema.parse({
      version: 'qualitative-transmission-v1',
      family,
      title,
      mechanism,
      conditions: [condition],
      countervailing: [counter],
      reference,
      reviewedOn: '2026-09-15',
      status: 'educational-mechanism-not-identified-causality',
    }),
);
export const TransmissionBindingSchema =
  TransmissionMechanismSchema.superRefine((v, c) => {
    const known = TRANSMISSION_CATALOG.find((row) => row.family === v.family);
    if (JSON.stringify(known) !== JSON.stringify(v))
      c.addIssue({
        code: 'custom',
        message: 'Transmission catalog payload differs from its exact version.',
      });
  });
export function transmissionFor(family: string) {
  return TRANSMISSION_CATALOG.find((entry) => entry.family === family);
}
export const TransmissionOutcomeSchema = z.strictObject({
  binding: TransmissionBindingSchema,
  reviewId: z.uuid(),
  reviewVersion: z.number().int().positive(),
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  sector: z.string(),
  isin: z.string(),
  outcome: z.enum(['review-before-interpretation', 'qualitative-context-only']),
  reasons: z.array(z.string()).min(1),
  holdingAction: z.literal('unchanged'),
  goalAction: z.literal('unchanged'),
  numericalImpact: z.null(),
});
export function transmissionOutcome(
  binding: z.infer<typeof TransmissionBindingSchema>,
  input: {
    reviewId: string;
    reviewVersion: number;
    eventId: string;
    eventVersion: number;
    sector: string;
    isin: string;
    eventFamily: string;
    direction: string;
    stale: boolean;
    warnings: string[];
  },
) {
  const admitted = TransmissionBindingSchema.parse(binding);
  if (admitted.family !== input.eventFamily)
    throw Error(
      'Transmission family does not match the exact reviewed event family.',
    );
  const reasons = [
    ...input.warnings,
    ...(input.stale
      ? ['Event evidence is outside the 30-day review window.']
      : []),
    ...(input.direction === 'mixed' || input.direction === 'unknown'
      ? ['Directional interpretation remains mixed or unknown.']
      : []),
    'Keep the recorded holding and goal unchanged; no trade or goal revision follows from this qualitative mechanism.',
    ...admitted.conditions,
    ...admitted.countervailing,
  ];
  return TransmissionOutcomeSchema.parse({
    binding: admitted,
    reviewId: input.reviewId,
    reviewVersion: input.reviewVersion,
    eventId: input.eventId,
    eventVersion: input.eventVersion,
    sector: input.sector,
    isin: input.isin,
    outcome:
      input.stale ||
      input.warnings.length ||
      ['mixed', 'unknown'].includes(input.direction)
        ? 'review-before-interpretation'
        : 'qualitative-context-only',
    reasons,
    holdingAction: 'unchanged',
    goalAction: 'unchanged',
    numericalImpact: null,
  });
}
