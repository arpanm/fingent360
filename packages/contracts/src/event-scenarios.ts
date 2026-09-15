import { z } from 'zod';
import { EventPublicSchema } from './events.js';
const Decimal = z.string().regex(/^-?(0|[1-9][0-9]{0,15})(\.[0-9]{1,8})?$/);
const Observed = z.strictObject({
  value: Decimal,
  citation: z.number().int().min(0).max(4),
  period: z.string().trim().min(1).max(120),
});
const Reference = z
  .strictObject({
    value: Decimal,
    citation: z.number().int().min(0).max(4).nullable(),
    period: z.string().trim().min(1).max(120),
    kind: z.enum([
      'prior-observation',
      'published-expectation',
      'scenario-assumption',
    ]),
  })
  .superRefine((value, ctx) => {
    if ((value.kind === 'scenario-assumption') !== (value.citation === null))
      ctx.addIssue({
        code: 'custom',
        message:
          'Observed/expected reference requires a source; a hypothetical assumption has no source citation.',
      });
  });
const measurements = { observed: Observed, reference: Reference.nullable() };
export const EventScenarioModelSchema = z
  .discriminatedUnion('family', [
    z.strictObject({
      family: z.literal('policy-rate'),
      authority: z.enum(['RBI', 'Federal Reserve']),
      measure: z.enum([
        'policy-rate',
        'target-lower-bound',
        'target-upper-bound',
        'primary-credit-rate',
      ]),
      unit: z.literal('percent'),
      ...measurements,
    }),
    z.strictObject({
      family: z.literal('inflation'),
      index: z.enum(['headline-CPI', 'core-CPI']),
      basis: z.enum(['year-on-year', 'month-on-month']),
      adjustment: z.enum(['seasonally-adjusted', 'not-seasonally-adjusted']),
      unit: z.literal('percent'),
      ...measurements,
    }),
    z.strictObject({
      family: z.literal('gdp'),
      basis: z.enum([
        'real-year-on-year',
        'real-quarter-on-quarter',
        'real-quarter-annualized',
        'nominal-year-on-year',
      ]),
      vintage: z.enum(['advance', 'second', 'third', 'revised']),
      unit: z.literal('percent'),
      ...measurements,
    }),
    z.strictObject({
      family: z.literal('earnings'),
      isin: z.string().regex(/^IN[A-Z0-9]{9}[0-9]$/),
      metric: z.enum(['revenue', 'profit-after-tax', 'eps']),
      basis: z.enum(['consolidated', 'standalone']),
      unit: z.enum(['INR', 'INR-lakh', 'INR-crore', 'INR-per-share']),
      ...measurements,
    }),
    z.strictObject({
      family: z.literal('guidance'),
      isin: z.string().regex(/^IN[A-Z0-9]{9}[0-9]$/),
      measure: z.enum(['revenue-growth', 'margin', 'revenue']),
      unit: z.enum(['percent', 'INR', 'INR-lakh', 'INR-crore']),
      ...measurements,
    }),
    z.strictObject({
      family: z.literal('regulatory'),
      authority: z.enum([
        'SEBI',
        'RBI',
        'exchange',
        'court',
        'company-board',
        'other-regulator',
      ]),
      category: z.enum(['enforcement', 'rule-change', 'governance-disclosure']),
      citation: z.number().int().min(0).max(4),
      interpretation: z.string().trim().min(8).max(1000),
    }),
    z.strictObject({
      family: z.literal('flows'),
      participant: z.enum(['FPI', 'FII', 'DII']),
      segment: z.enum([
        'cash-equity-provisional',
        'equity-total',
        'debt',
        'derivatives',
      ]),
      unit: z.literal('INR-crore'),
      ...measurements,
    }),
  ])
  .superRefine((value, context) => {
    if (
      value.family === 'policy-rate' &&
      ((value.authority === 'RBI' && value.measure !== 'policy-rate') ||
        (value.authority === 'Federal Reserve' &&
          value.measure === 'policy-rate'))
    )
      context.addIssue({
        code: 'custom',
        message:
          'Name RBI policy rate or the specific Federal Reserve target bound/primary credit rate.',
      });
    if (
      value.family === 'earnings' &&
      (value.metric === 'eps') !== (value.unit === 'INR-per-share')
    )
      context.addIssue({
        code: 'custom',
        message:
          'EPS must use INR per share; aggregate earnings measures cannot.',
      });
    if (
      value.family === 'guidance' &&
      (value.measure === 'revenue') === (value.unit === 'percent')
    )
      context.addIssue({
        code: 'custom',
        message:
          'Revenue guidance needs a currency scale; margin/growth guidance needs percent.',
      });
  });
export const EventScenarioInputSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  revisionReason: z.string().trim().min(5).max(1000),
  model: EventScenarioModelSchema,
});
export const EventScenarioReviewSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(5).max(1000),
});
export const EventScenarioResultSchema = z.strictObject({
  comparison: z.enum([
    'prior-change',
    'surprise-versus-published-expectation',
    'hypothetical',
    'no-reference',
    'regulatory-context',
  ]),
  delta: z
    .string()
    .regex(/^-?(0|[1-9][0-9]{0,16})(\.[0-9]{1,8})?$/)
    .nullable(),
  unit: z.string(),
  direction: z.enum(['up', 'down', 'unchanged', 'not-quantified']),
  meaning: z.string(),
  noAction: z.literal('No portfolio or goal change is calculated or executed.'),
  warnings: z.array(z.string()).min(1),
});
export const EventScenarioReceiptSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    policy: z.literal('source-bound-event-delta-v1'),
    input: EventScenarioInputSchema,
    event: EventPublicSchema,
    result: EventScenarioResultSchema,
  })
  .superRefine((value, context) => {
    try {
      if (
        value.version !== value.input.expectedVersion + 1 ||
        JSON.stringify(
          calculateEventScenario(value.input, value.event, value.createdAt),
        ) !== JSON.stringify(value.result)
      )
        throw Error('mismatch');
    } catch {
      context.addIssue({
        code: 'custom',
        message:
          'Scenario must reconstruct from its exact reviewed event and model.',
      });
    }
  });
export const EventScenarioPublicSchema = z
  .strictObject({
    id: z.uuid(),
    state: z.enum(['published', 'withdrawn', 'unavailable']),
    receipt: EventScenarioReceiptSchema.nullable(),
    reviewedAt: z.iso.datetime().nullable(),
    reviewReasons: z.array(z.string()).default([]),
  })
  .superRefine((v, c) => {
    if (
      (v.state === 'published') !== (v.receipt !== null) ||
      (v.receipt && v.receipt.id !== v.id)
    )
      c.addIssue({
        code: 'custom',
        message: 'Unavailable scenario content must be redacted.',
      });
  });
export const EventScenarioListSchema = z.strictObject({
  items: z.array(EventScenarioPublicSchema).max(50),
  next: z.uuid().nullable(),
});
export const EventScenarioQueueSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        receipt: EventScenarioReceiptSchema,
        state: z.enum(['draft', 'published', 'withdrawn']),
        publishedVersion: z.number().int().positive().nullable(),
      }),
    )
    .max(50),
  next: z.uuid().nullable(),
});
export const EventScenarioHistorySchema = z.strictObject({
  versions: z
    .array(
      z.strictObject({
        version: z.number().int().positive(),
        createdAt: z.iso.datetime(),
      }),
    )
    .max(50),
  nextBefore: z.number().int().positive().nullable(),
});
export const EventScenarioSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  items: z.array(EventScenarioPublicSchema).max(1000),
  histories: z.record(z.string(), EventScenarioHistorySchema),
});
export type EventScenarioInput = z.infer<typeof EventScenarioInputSchema>;
export type EventScenarioReceipt = z.infer<typeof EventScenarioReceiptSchema>;
const scaled = (value: string) => {
  const negative = value.startsWith('-'),
    [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const n = BigInt(whole!) * 100000000n + BigInt(fraction.padEnd(8, '0'));
  return negative ? -n : n;
};
function decimal(value: bigint) {
  const n = value < 0n ? -value : value,
    fraction = (n % 100000000n).toString().padStart(8, '0').replace(/0+$/, '');
  return `${value < 0n ? '-' : ''}${n / 100000000n}${fraction ? '.' + fraction : ''}`;
}
export function exactEventDelta(observed: string, reference: string) {
  Decimal.parse(observed);
  Decimal.parse(reference);
  return decimal(scaled(observed) - scaled(reference));
}
function numericToken(quote: string, value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^0-9.,-])${escaped}($|[^0-9.,])`).test(quote);
}
export function calculateEventScenario(
  raw: EventScenarioInput,
  rawEvent: z.infer<typeof EventPublicSchema>,
  now: string,
) {
  const input = EventScenarioInputSchema.parse(raw),
    publicEvent = EventPublicSchema.parse(rawEvent),
    event = publicEvent.event;
  if (
    !event ||
    publicEvent.status !== 'published' ||
    event.id !== input.eventId ||
    event.version !== input.eventVersion
  )
    throw Error('Select the current admitted reviewed event edition.');
  const model = input.model,
    warnings = [
      'Source-bound arithmetic describes the specified measure; it does not establish a market reaction or a causal portfolio effect.',
      'Units, period, seasonal basis and release vintage are explicit editorial choices requiring independent review.',
    ];
  if (model.family === 'guidance')
    warnings.push(
      'Company guidance is forward-looking; a difference is not a realised earnings outcome.',
    );
  if (model.family === 'flows')
    warnings.push(
      'Do not combine provisional cash flows with total FPI or derivatives measures.',
    );
  if (
    event.sources.some(
      (source) => Date.parse(source.publishedAt) > Date.parse(now),
    )
  )
    warnings.push('A retained source publication timestamp is in the future.');
  if (event.editorial.claimKind !== 'fact')
    warnings.push(
      `Underlying event is labelled ${event.editorial.claimKind}; this is not promoted to an observed fact.`,
    );
  if (
    event.sources.some(
      (source) =>
        Date.parse(now) - Date.parse(source.publishedAt) > 30 * 86400000,
    )
  )
    warnings.push(
      'This is historical evidence beyond the 30-day context window.',
    );
  if (model.family === 'regulatory') {
    if (!event.editorial.citations[model.citation])
      throw Error('Regulatory context requires an actual retained excerpt.');
    const time = event.editorial.effectiveAt;
    return EventScenarioResultSchema.parse({
      comparison: 'regulatory-context',
      delta: null,
      unit: 'not-applicable',
      direction: 'not-quantified',
      meaning: time
        ? `Reviewed effective time ${time}; ${Date.parse(time) > Date.parse(now) ? 'not yet effective' : 'effective time reached'}.`
        : 'Effective time has not been established.',
      noAction: 'No portfolio or goal change is calculated or executed.',
      warnings: [
        ...warnings,
        'Editorial interpretation is not a legal determination.',
      ],
    });
  }
  if (
    'isin' in model &&
    !event.editorial.links.some(
      (link) => link.kind === 'instrument' && link.isin === model.isin,
    )
  )
    throw Error(
      'Company scenario needs the event’s reviewed instrument identity.',
    );
  const observedCitation = event.editorial.citations[model.observed.citation];
  if (
    !observedCitation ||
    !numericToken(observedCitation.quote, model.observed.value)
  )
    throw Error(
      'Observed value must occur as an exact standalone token in the selected retained excerpt.',
    );
  const observedSource = event.sources.find(
    (item) => item.id === observedCitation.sourceId,
  )!;
  const reference = model.reference;
  if (!reference)
    return EventScenarioResultSchema.parse({
      comparison: 'no-reference',
      delta: null,
      unit: model.unit,
      direction: 'not-quantified',
      meaning:
        'No observed prior value or published expectation was supplied; no surprise is inferred.',
      noAction: 'No portfolio or goal change is calculated or executed.',
      warnings,
    });
  if (reference.citation !== null) {
    const citation = event.editorial.citations[reference.citation];
    if (!citation || !numericToken(citation.quote, reference.value))
      throw Error(
        'Reference value must occur as an exact token in its retained excerpt.',
      );
    const source = event.sources.find((item) => item.id === citation.sourceId)!;
    if (
      reference.kind === 'prior-observation' &&
      Date.parse(source.publishedAt) > Date.parse(observedSource.publishedAt)
    )
      warnings.push(
        'Prior-period reference was retrieved from a later publication vintage; do not treat it as known at the observed release time.',
      );
    if (
      reference.kind === 'published-expectation' &&
      (reference.period !== model.observed.period ||
        Date.parse(source.publishedAt) >=
          Date.parse(observedSource.publishedAt))
    )
      throw Error(
        'A published expectation must concern the same period and predate the observed release.',
      );
  }
  const delta = scaled(model.observed.value) - scaled(reference.value);
  if (reference.kind === 'scenario-assumption')
    warnings.push(
      'Reference is an explicit hypothetical assumption, not a sourced consensus expectation.',
    );
  return EventScenarioResultSchema.parse({
    comparison:
      reference.kind === 'prior-observation'
        ? 'prior-change'
        : reference.kind === 'published-expectation'
          ? 'surprise-versus-published-expectation'
          : 'hypothetical',
    delta: decimal(delta),
    unit: model.unit === 'percent' ? 'percentage-points' : model.unit,
    direction: delta > 0n ? 'up' : delta < 0n ? 'down' : 'unchanged',
    meaning:
      reference.kind === 'prior-observation'
        ? 'Difference from the explicitly cited prior observation; not a consensus surprise.'
        : reference.kind === 'published-expectation'
          ? 'Difference from this particular prior published expectation; not proof of market-wide consensus.'
          : 'Difference from the explicitly hypothetical reference.',
    noAction: 'No portfolio or goal change is calculated or executed.',
    warnings,
  });
}
