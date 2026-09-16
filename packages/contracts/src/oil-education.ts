import { z } from 'zod';
import { EventPublicSchema } from './events.js';
import { ResearchGovernanceRevisionSchema } from './research-governance.js';
export const OIL_EDUCATION_SOURCE =
  'https://www.goindigo.in/press-releases/indigo-revises-fuel-charges-due-to-rising-atf-costs.html';
export const OIL_EDUCATION_ISIN = 'INE646L01027';
export const OIL_EDUCATION_ANCHOR =
  'Although fully offsetting the fuel price increase would require substantial fare revisions, IndiGo has passed on a relatively smaller amount';
export const OilEducationCaptureSchema = z.strictObject({
  requestId: z.uuid(),
  body: z.string().min(50).max(1000000),
  rightsEvidence: z.string().trim().min(20).max(2000),
  rightsConfirmed: z.literal(true),
});
export const OilEducationReviewSchema = z.strictObject({
  requestId: z.uuid(),
  id: z.uuid(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(12).max(2000),
  rightsVerified: z.boolean(),
});
export const OilEducationSourceReceiptSchema = z.strictObject({
  id: z.uuid(),
  sourceUrl: z.literal(OIL_EDUCATION_SOURCE),
  sourceDate: z.literal('2026-04-01'),
  datePrecision: z.literal('date-only'),
  isin: z.literal(OIL_EDUCATION_ISIN),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  bodyHash: z.string().regex(/^[a-f0-9]{64}$/),
  retrievedAt: z.iso.datetime(),
  anchor: z.literal(OIL_EDUCATION_ANCHOR),
  parser: z.literal('indigo-atf-cost-context-v1'),
});
export const OilEducationQueueSchema = z
  .array(
    z.strictObject({
      id: z.uuid(),
      error: z.string().nullable(),
      receipt: OilEducationSourceReceiptSchema.nullable(),
      state: z.enum(['draft', 'quarantined', 'publish', 'withdraw']),
    }),
  )
  .max(100);
export function parseOilEducationSource(
  raw: unknown,
  sourceHash: string,
  bodyHash: string,
  retrievedAt: string,
) {
  const input = OilEducationCaptureSchema.parse(raw),
    plain = input.body
      .replace(/<script\b[^>]*>[^]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[^]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  if (
    retrievedAt.slice(0, 10) < '2026-04-01' ||
    !plain.includes('National, 1 April 2026:') ||
    !plain.includes(OIL_EDUCATION_ANCHOR)
  )
    throw Error(
      'Retain the exact verified 1-Apr-2026 issuer fuel-cost disclosure; changed source layouts require review.',
    );
  return OilEducationSourceReceiptSchema.parse({
    id: input.requestId,
    sourceUrl: OIL_EDUCATION_SOURCE,
    sourceDate: '2026-04-01',
    datePrecision: 'date-only',
    isin: OIL_EDUCATION_ISIN,
    sourceHash,
    bodyHash,
    retrievedAt,
    anchor: OIL_EDUCATION_ANCHOR,
    parser: 'indigo-atf-cost-context-v1',
  });
}
export const OilEducationProofSchema = z.strictObject({
  policy: z.literal('indigo-atf-context-2026-v1'),
  sourceId: z.string(),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceDate: z.literal('2026-04-01'),
  datePrecision: z.literal('date-only'),
  mechanism: z.literal('Aviation fuel costs and incomplete fare pass-through'),
  companyIsin: z.literal(OIL_EDUCATION_ISIN),
  sector: z.literal('Airlines'),
  assessment: z.literal('qualitative-context-only'),
  noAction: z.literal(
    'Keep the recorded holding and goal unchanged; no trade or allocation is proposed.',
  ),
  limitations: z.array(z.string()).min(1),
});
export function oilEducationSource(event: z.infer<typeof EventPublicSchema>) {
  if (event.status !== 'published' || !event.event) return null;
  return (
    event.event.sources.find(
      (source) =>
        source.id.startsWith('oil-education-') &&
        source.source.url === OIL_EDUCATION_SOURCE &&
        source.effectiveLabel ===
          'Issuer report date 2026-04-01; exact release time unknown' &&
        source.sourceHash &&
        source.body.includes(OIL_EDUCATION_ANCHOR),
    ) ?? null
  );
}
export function oilEducationProof(
  event: z.infer<typeof EventPublicSchema>,
  context: z.infer<typeof ResearchGovernanceRevisionSchema> | undefined,
  isin: string,
  sector: string,
) {
  const source = oilEducationSource(event);
  if (
    !source ||
    isin !== OIL_EDUCATION_ISIN ||
    sector !== 'Airlines' ||
    !context ||
    context.input.content.kind !== 'causal-context' ||
    context.input.content.isin !== isin ||
    context.input.content.sector !== sector
  )
    throw Error(
      'Oil walkthrough requires the admitted original issuer report, exact airline holding and independently released company context.',
    );
  const citation = event.event!.editorial.citations.findIndex(
    (row) =>
      row.sourceId === source.id &&
      row.field === 'body' &&
      row.quote.includes(OIL_EDUCATION_ANCHOR),
  );
  if (citation < 0 || !context.input.citations.includes(citation))
    throw Error(
      'Released mechanism must cite the exact issuer fuel-cost and incomplete pass-through evidence.',
    );
  return OilEducationProofSchema.parse({
    policy: 'indigo-atf-context-2026-v1',
    sourceId: source.id,
    sourceHash: source.sourceHash,
    sourceDate: '2026-04-01',
    datePrecision: 'date-only',
    mechanism: 'Aviation fuel costs and incomplete fare pass-through',
    companyIsin: isin,
    sector,
    assessment: 'qualitative-context-only',
    noAction:
      'Keep the recorded holding and goal unchanged; no trade or allocation is proposed.',
    limitations: [
      'The issuer describes aviation turbine fuel and fare pass-through; this is not a one-for-one Brent or WTI sensitivity.',
      'Demand, exchange rates, fuel arrangements, taxes and competitive pricing can offset or change operating effects.',
      'No stock-price change, earnings estimate, probability or goal shortfall caused by this event has been calculated.',
      'The source provides a date without an exact publication time. Its later editorial review time does not make this a current oil-price observation.',
    ],
  });
}
