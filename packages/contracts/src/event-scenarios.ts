import { NSE_FLOWS_URL, CDSL_FLOWS_URL } from './institutional-flows.js';
import {
  INFOSYS_FY25_SOURCE,
  INFOSYS_ISIN,
  FIU_PIB_SOURCE,
  FIU_PUBLISHED_AT,
  parseInfosysQuarterRevenue,
  parseInfosysGuidance,
  parseFiuPenalty,
} from './company-event-packs.js';
import { BEA_GDP_VINTAGES, parseBeaGdpAnnualized } from './bea-gdp-vintage.js';
import { parseRbiRepoChange } from './rbi-policy-rate.js';
import { parseFedTargetRange } from './fed-target-range.js';
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
      'prior-vintage',
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
      accountingStandard: z
        .enum(['not-specified', 'IFRS', 'Ind-AS'])
        .optional(),
      basis: z.enum(['consolidated', 'standalone']),
      unit: z.enum(['INR', 'INR-lakh', 'INR-crore', 'INR-per-share']),
      ...measurements,
    }),
    z.strictObject({
      family: z.literal('guidance'),
      isin: z.string().regex(/^IN[A-Z0-9]{9}[0-9]$/),
      measure: z.enum([
        'revenue-growth',
        'margin',
        'revenue',
        'revenue-growth-lower-bound',
        'revenue-growth-upper-bound',
      ]),
      growthBasis: z
        .enum(['not-specified', 'constant-currency', 'reported'])
        .optional(),
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
      participant: z.enum(['FPI', 'FII', 'FII/FPI', 'DII']),
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
      'reference' in value &&
      value.reference?.kind === 'prior-vintage' &&
      (value.family !== 'gdp' ||
        value.observed.period !== value.reference.period)
    )
      context.addIssue({
        code: 'custom',
        message: 'Vintage comparison requires the same GDP quarter.',
      });
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
      (value.measure === 'revenue-growth-lower-bound' ||
        value.measure === 'revenue-growth-upper-bound') &&
      (value.growthBasis !== 'constant-currency' || value.reference !== null)
    )
      context.addIssue({
        code: 'custom',
        message:
          'Verified guidance bounds require explicit constant-currency basis and no cross-bound comparison.',
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
    'vintage-revision',
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
function scenarioNumericToken(
  model: z.infer<typeof EventScenarioModelSchema>,
  quote: string,
  value: string,
  reference = false,
) {
  if (
    model.family === 'policy-rate' &&
    model.authority === 'Federal Reserve' &&
    (model.measure === 'target-lower-bound' ||
      model.measure === 'target-upper-bound') &&
    /target range for the federal funds rate/i.test(quote)
  ) {
    const range = parseFedTargetRange(quote);
    return (
      value ===
      (model.measure === 'target-lower-bound' ? range.lower : range.upper)
    );
  }
  if (
    model.family === 'policy-rate' &&
    model.authority === 'RBI' &&
    /policy repo rate/i.test(quote) &&
    /from\b[^]*?\bto\b/i.test(quote)
  ) {
    const change = parseRbiRepoChange(quote);
    return scaled(value) === scaled(reference ? change.prior : change.observed);
  }
  if (model.family === 'gdp' && /Real gross domestic product/i.test(quote)) {
    const gdp = parseBeaGdpAnnualized(quote);
    return (
      model.basis === 'real-quarter-annualized' &&
      gdp.period ===
        (reference ? model.reference?.period : model.observed.period) &&
      scaled(value) === scaled(gdp.value)
    );
  }
  if (
    model.family === 'earnings' &&
    model.isin === INFOSYS_ISIN &&
    model.accountingStandard === 'IFRS'
  ) {
    const parsed = parseInfosysQuarterRevenue(quote);
    return (
      model.metric === 'revenue' &&
      model.basis === 'consolidated' &&
      model.unit === 'INR-crore' &&
      (reference
        ? model.reference?.period === '2024-Q1'
        : model.observed.period === '2025-Q1') &&
      scaled(value) === scaled(reference ? parsed.prior : parsed.observed)
    );
  }
  if (
    model.family === 'guidance' &&
    (model.measure === 'revenue-growth-lower-bound' ||
      model.measure === 'revenue-growth-upper-bound')
  ) {
    const parsed = parseInfosysGuidance(quote);
    return (
      model.isin === INFOSYS_ISIN &&
      model.observed.period === 'FY2026' &&
      scaled(value) ===
        scaled(
          model.measure === 'revenue-growth-lower-bound'
            ? parsed.lower
            : parsed.upper,
        )
    );
  }
  return numericToken(quote, value);
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
  if (
    input.model.family === 'flows' &&
    event.sources.some((source) => source.id.startsWith('institutional-flow-'))
  ) {
    const bound = extractInstitutionalFlowDraft(publicEvent).model;
    if (JSON.stringify(input.model) !== JSON.stringify(bound))
      throw Error(
        'Institutional flow model must retain the exact reviewed source scope, participant, reporting date and net; arbitrary comparison is not supported.',
      );
  }
  const model = input.model,
    warnings = [
      'Source-bound arithmetic describes the specified measure; it does not establish a market reaction or a causal portfolio effect.',
      'Units, period, seasonal basis and release vintage are explicit editorial choices requiring independent review.',
    ];
  if (
    model.family === 'flows' &&
    event.sources.some((source) => source.id.startsWith('institutional-flow-'))
  ) {
    warnings.push(
      'Editorial publication time is the source review time; original source publication time is unknown. The observed period retains the actual reporting/trade date.',
    );
    const reportDate = /(\d{4}-\d{2}-\d{2})$/.exec(model.observed.period)?.[1];
    if (
      reportDate &&
      Date.parse(now) - Date.parse(reportDate + 'T00:00:00Z') > 7 * 86400000
    )
      warnings.push(
        'Historical institutional report beyond seven days; recent capture or review does not make the reported observation current.',
      );
  }
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
    !scenarioNumericToken(model, observedCitation.quote, model.observed.value)
  )
    throw Error(
      'Observed value must occur as an exact standalone token in the selected retained excerpt.',
    );
  const observedSource = event.sources.find(
    (item) => item.id === observedCitation.sourceId,
  )!;
  if (
    model.family === 'policy-rate' &&
    model.authority === 'Federal Reserve' &&
    (model.measure === 'target-lower-bound' ||
      model.measure === 'target-upper-bound') &&
    /target range for the federal funds rate/i.test(observedCitation.quote)
  ) {
    const range = parseFedTargetRange(observedCitation.quote);
    warnings.push(
      `FOMC statement conversion: ${range.rawLower} to ${range.rawUpper} percent becomes ${range.lower} to ${range.upper} percent; exact quarter fractions, version fomc-statement-quarter-fractions-v1.`,
    );
  }
  if (
    (model.family === 'earnings' &&
      model.isin === INFOSYS_ISIN &&
      model.accountingStandard === 'IFRS') ||
    (model.family === 'guidance' &&
      (model.measure === 'revenue-growth-lower-bound' ||
        model.measure === 'revenue-growth-upper-bound'))
  ) {
    if (observedSource.source.url !== INFOSYS_FY25_SOURCE)
      throw Error('Company pack requires the original Infosys FY25Q4 release.');
    warnings.push(
      'Original issuer IFRS reporting and constant-currency guidance are distinct; the verified issuer ISIN is INE009A01021.',
    );
  }
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
    if (
      !citation ||
      !scenarioNumericToken(model, citation.quote, reference.value, true)
    )
      throw Error(
        'Reference value must occur as an exact token in its retained excerpt.',
      );
    const source = event.sources.find((item) => item.id === citation.sourceId)!;
    if (
      model.family === 'earnings' &&
      model.isin === INFOSYS_ISIN &&
      model.accountingStandard === 'IFRS' &&
      source.source.url !== INFOSYS_FY25_SOURCE
    )
      throw Error(
        'Prior company quarter must come from the retained original comparison table.',
      );
    if (reference.kind === 'prior-vintage') {
      const actualObserved = parseBeaGdpAnnualized(observedCitation.quote),
        actualReference = parseBeaGdpAnnualized(citation.quote);
      if (
        model.family !== 'gdp' ||
        model.basis !== 'real-quarter-annualized' ||
        actualObserved.period !== model.observed.period ||
        actualReference.period !== reference.period ||
        scaled(actualObserved.value) !== scaled(model.observed.value) ||
        scaled(actualReference.value) !== scaled(reference.value)
      )
        throw Error(
          'GDP vintage values must be the exact real annualized GDP headline, not another economic measure.',
        );
      const observedMeta = BEA_GDP_VINTAGES.find(
        (meta) => meta.url === observedSource.source.url,
      );
      const referenceMeta = BEA_GDP_VINTAGES.find(
        (meta) => meta.url === source.source.url,
      );
      if (
        model.family !== 'gdp' ||
        !observedMeta ||
        !referenceMeta ||
        model.vintage !== observedMeta.vintage ||
        observedMeta.publishedAt !== observedSource.publishedAt ||
        referenceMeta.publishedAt !== source.publishedAt ||
        Date.parse(source.publishedAt) >= Date.parse(observedSource.publishedAt)
      )
        throw Error(
          'GDP vintage comparison requires correctly ordered original BEA release editions.',
        );
    }
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
      reference.kind === 'prior-vintage'
        ? 'vintage-revision'
        : reference.kind === 'prior-observation'
          ? 'prior-change'
          : reference.kind === 'published-expectation'
            ? 'surprise-versus-published-expectation'
            : 'hypothetical',
    delta: decimal(delta),
    unit: model.unit === 'percent' ? 'percentage-points' : model.unit,
    direction: delta > 0n ? 'up' : delta < 0n ? 'down' : 'unchanged',
    meaning:
      reference.kind === 'prior-vintage'
        ? 'Revision to the same quarter across original published GDP vintages; not a consensus surprise or a change between quarters.'
        : reference.kind === 'prior-observation'
          ? 'Difference from the explicitly cited prior observation; not a consensus surprise.'
          : reference.kind === 'published-expectation'
            ? 'Difference from this particular prior published expectation; not proof of market-wide consensus.'
            : 'Difference from the explicitly hypothetical reference.',
    noAction: 'No portfolio or goal change is calculated or executed.',
    warnings,
  });
}

export const FedPolicyDraftSchema = z.strictObject({
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  basis: z.literal('reviewed-official-fomc-citations'),
  lower: EventScenarioModelSchema,
  upper: EventScenarioModelSchema,
});
export function extractFedPolicyDraft(
  publicEvent: z.infer<typeof EventPublicSchema>,
) {
  if (publicEvent.status !== 'published' || !publicEvent.event)
    throw Error('Choose a currently published reviewed event.');
  const event = publicEvent.event;
  const rows = event.editorial.citations
    .flatMap((citation, index) => {
      const source = event.sources.find(
        (item) => item.id === citation.sourceId,
      );
      if (!source) return [];
      const match =
        /^https:\/\/www\.federalreserve\.gov\/newsevents\/pressreleases\/monetary(\d{4})(\d{2})(\d{2})a\.htm$/.exec(
          source.source.url,
        );
      if (!match) return [];
      const date = `${match[1]}-${match[2]}-${match[3]}`;
      if (source.publishedAt.slice(0, 10) !== date)
        throw Error('Statement date and retained publication date disagree.');
      return [{ index, date, ...parseFedTargetRange(citation.quote) }];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length)
    throw Error(
      'No supported official FOMC target-range citation is retained in this event.',
    );
  const dates = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const old = dates.get(row.date);
    if (old && (old.lower !== row.lower || old.upper !== row.upper))
      throw Error('Conflicting same-date FOMC ranges need source review.');
    dates.set(row.date, row);
  }
  const unique = [...dates.values()],
    observed = unique[0]!,
    reference = unique[1];
  const model = (bound: 'lower' | 'upper') => ({
    family: 'policy-rate',
    authority: 'Federal Reserve',
    measure: bound === 'lower' ? 'target-lower-bound' : 'target-upper-bound',
    unit: 'percent',
    observed: {
      value: observed[bound],
      citation: observed.index,
      period: observed.date,
    },
    reference: reference
      ? {
          value: reference[bound],
          citation: reference.index,
          period: reference.date,
          kind: 'prior-observation',
        }
      : null,
  });
  return FedPolicyDraftSchema.parse({
    eventId: event.id,
    eventVersion: event.version,
    basis: 'reviewed-official-fomc-citations',
    lower: model('lower'),
    upper: model('upper'),
  });
}

export const RbiPolicyDraftSchema = z.strictObject({
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  basis: z.literal('reviewed-official-rbi-repo-citation'),
  model: EventScenarioModelSchema,
});
export function extractRbiPolicyDraft(
  publicEvent: z.infer<typeof EventPublicSchema>,
) {
  if (publicEvent.status !== 'published' || !publicEvent.event)
    throw Error('Choose a currently published reviewed event.');
  const event = publicEvent.event;
  const rows = event.editorial.citations.flatMap((citation, index) => {
    const source = event.sources.find((item) => item.id === citation.sourceId);
    if (!source) return [];
    const url = new URL(source.source.url);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'www.rbi.org.in' ||
      url.pathname !== '/Scripts/NotificationUser.aspx' ||
      url.searchParams.get('Id') !== '12854'
    )
      return [];
    if (!source.effectiveLabel.includes('2025-06-06'))
      throw Error(
        'Retained source must state the actual circular date 2025-06-06; its exact publication time is not established.',
      );
    return [{ index, ...parseRbiRepoChange(citation.quote) }];
  });
  if (rows.length !== 1)
    throw Error(
      'Retain exactly one supported original RBI June 2025 repo decision citation.',
    );
  const row = rows[0]!;
  if (row.prior !== '6' || row.observed !== '5.5')
    throw Error('Repo values disagree with RBI/2025-26/42.');
  return RbiPolicyDraftSchema.parse({
    eventId: event.id,
    eventVersion: event.version,
    basis: 'reviewed-official-rbi-repo-citation',
    model: {
      family: 'policy-rate',
      authority: 'RBI',
      measure: 'policy-rate',
      unit: 'percent',
      observed: {
        value: row.observed,
        citation: row.index,
        period: '2025-06-06 (release date; time unavailable)',
      },
      reference: {
        value: row.prior,
        citation: row.index,
        period: 'Prior repo rate explicitly stated in the same circular',
        kind: 'prior-observation',
      },
    },
  });
}

export const BeaGdpDraftSchema = z.strictObject({
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  basis: z.literal('reviewed-original-bea-gdp-vintages'),
  model: EventScenarioModelSchema,
});
export function extractBeaGdpDraft(
  publicEvent: z.infer<typeof EventPublicSchema>,
) {
  if (publicEvent.status !== 'published' || !publicEvent.event)
    throw Error('Choose a currently published reviewed event.');
  const event = publicEvent.event;
  const rows = event.editorial.citations
    .flatMap((citation, index) => {
      const source = event.sources.find(
          (item) => item.id === citation.sourceId,
        ),
        meta = BEA_GDP_VINTAGES.find((item) => item.url === source?.source.url);
      if (!source || !meta) return [];
      if (source.publishedAt !== meta.publishedAt)
        throw Error(
          'GDP source publication time differs from its original release.',
        );
      const parsed = parseBeaGdpAnnualized(citation.quote);
      if (parsed.period !== '2025-Q2')
        throw Error('GDP source quarter does not match its release.');
      return [{ index, ...meta, ...parsed }];
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (
    rows.length !== 2 ||
    rows[0]!.vintage !== 'third' ||
    rows[1]!.vintage !== 'second'
  )
    throw Error(
      'Retain the distinct second and third original Q2 2025 GDP estimates.',
    );
  const observed = rows[0]!,
    reference = rows[1]!;
  return BeaGdpDraftSchema.parse({
    eventId: event.id,
    eventVersion: event.version,
    basis: 'reviewed-original-bea-gdp-vintages',
    model: {
      family: 'gdp',
      basis: 'real-quarter-annualized',
      vintage: observed.vintage,
      unit: 'percent',
      observed: {
        value: observed.value,
        citation: observed.index,
        period: observed.period,
      },
      reference: {
        value: reference.value,
        citation: reference.index,
        period: reference.period,
        kind: 'prior-vintage',
      },
    },
  });
}

export const CompanyPackDraftSchema = z.strictObject({
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  basis: z.literal('reviewed-infosys-fy25-original-citations'),
  earnings: EventScenarioModelSchema,
  guidanceLower: EventScenarioModelSchema,
  guidanceUpper: EventScenarioModelSchema,
});
export function extractCompanyPackDraft(
  publicEvent: z.infer<typeof EventPublicSchema>,
) {
  if (publicEvent.status !== 'published' || !publicEvent.event)
    throw Error('Choose a currently published reviewed event.');
  const event = publicEvent.event;
  if (
    !event.editorial.links.some(
      (link) => link.kind === 'instrument' && link.isin === INFOSYS_ISIN,
    )
  )
    throw Error(
      'Review the actual Infosys canonical identity before extraction.',
    );
  const rows = event.editorial.citations.flatMap((citation, index) => {
    const source = event.sources.find((item) => item.id === citation.sourceId);
    return source?.source.url === INFOSYS_FY25_SOURCE
      ? [{ index, quote: citation.quote }]
      : [];
  });
  const revenues = rows.filter((row) => /^Revenues\s/.test(row.quote)),
    guidance = rows.filter((row) => /^Guidance for FY26:/.test(row.quote));
  if (revenues.length !== 1 || guidance.length !== 1)
    throw Error(
      'Retain the original quarterly revenue row and separate FY26 guidance excerpt.',
    );
  const revenue = parseInfosysQuarterRevenue(revenues[0]!.quote),
    range = parseInfosysGuidance(guidance[0]!.quote);
  const earnings = {
    family: 'earnings',
    isin: INFOSYS_ISIN,
    metric: 'revenue',
    accountingStandard: 'IFRS',
    basis: 'consolidated',
    unit: 'INR-crore',
    observed: {
      value: revenue.observed,
      period: '2025-Q1',
      citation: revenues[0]!.index,
    },
    reference: {
      value: revenue.prior,
      period: '2024-Q1',
      citation: revenues[0]!.index,
      kind: 'prior-observation',
    },
  };
  const bound = (side: 'lower' | 'upper') => ({
    family: 'guidance',
    isin: INFOSYS_ISIN,
    measure: 'revenue-growth-' + side + '-bound',
    growthBasis: 'constant-currency',
    unit: 'percent',
    observed: {
      value: range[side],
      period: 'FY2026',
      citation: guidance[0]!.index,
    },
    reference: null,
  });
  return CompanyPackDraftSchema.parse({
    eventId: event.id,
    eventVersion: event.version,
    basis: 'reviewed-infosys-fy25-original-citations',
    earnings,
    guidanceLower: bound('lower'),
    guidanceUpper: bound('upper'),
  });
}
export const GovernancePackDraftSchema = z.strictObject({
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  basis: z.literal('original-fiu-pib-enforcement'),
  model: EventScenarioModelSchema,
});
export function extractGovernancePackDraft(
  publicEvent: z.infer<typeof EventPublicSchema>,
) {
  if (publicEvent.status !== 'published' || !publicEvent.event)
    throw Error('Choose a currently published reviewed event.');
  const event = publicEvent.event;
  if (event.editorial.links.some((link) => link.kind === 'instrument'))
    throw Error(
      'This bank-specific pack must not infer a listed-parent identity.',
    );
  const rows = event.editorial.citations.flatMap((citation, index) => {
    const source = event.sources.find((item) => item.id === citation.sourceId);
    if (!source || source.source.url !== FIU_PIB_SOURCE) return [];
    if (source.publishedAt !== FIU_PUBLISHED_AT)
      throw Error('Original FIU release publication time must match.');
    return [{ index, ...parseFiuPenalty(citation.quote) }];
  });
  if (rows.length !== 1)
    throw Error('Retain the original FIU-IND enforcement headline.');
  return GovernancePackDraftSchema.parse({
    eventId: event.id,
    eventVersion: event.version,
    basis: 'original-fiu-pib-enforcement',
    model: {
      family: 'regulatory',
      authority: 'other-regulator',
      category: 'enforcement',
      citation: rows[0]!.index,
      interpretation:
        'FIU-IND reports a historical INR 54900000 penalty on Paytm Payments Bank Ltd. This does not identify listed One97 as the penalised entity or quantify a market/portfolio effect.',
    },
  });
}

export const InstitutionalFlowDraftSchema = z.strictObject({
  eventId: z.uuid(),
  eventVersion: z.number().int().positive(),
  model: EventScenarioModelSchema,
});
export function extractInstitutionalFlowDraft(
  publicEvent: z.infer<typeof EventPublicSchema>,
) {
  if (publicEvent.status !== 'published' || !publicEvent.event)
    throw Error('Choose a currently published reviewed event.');
  const event = publicEvent.event;
  const rows = event.editorial.citations.flatMap((citation, index) => {
    const source = event.sources.find((s) => s.id === citation.sourceId);
    if (
      !source?.id.startsWith('institutional-flow-') ||
      citation.field !== 'body' ||
      !source.body.split('\n').includes(citation.quote)
    )
      return [];
    const match =
      /^(NSE|NSE-BSE-MSEI|CDSL Equity|CDSL Debt) \| (provisional trade date|custodian reporting date) (\d{4}-\d{2}-\d{2}) \| (FII\/FPI|DII|FPI) \| purchases (-?\d+\.\d{2}) INR crore \| sales (-?\d+\.\d{2}) INR crore \| net (-?\d+\.\d{2}) INR crore\.$/.exec(
        citation.quote,
      );
    if (!match) return [];
    const scope = match[1]!,
      nse = scope.startsWith('NSE');
    if (
      source.source.url !== (nse ? NSE_FLOWS_URL : CDSL_FLOWS_URL) ||
      match[2] !==
        (nse ? 'provisional trade date' : 'custodian reporting date') ||
      (nse ? !['FII/FPI', 'DII'].includes(match[4]!) : match[4] !== 'FPI')
    )
      throw Error(
        'Flow source, participant or reporting basis does not agree.',
      );
    return [
      {
        family: 'flows',
        participant: match[4],
        segment: nse
          ? 'cash-equity-provisional'
          : scope === 'CDSL Equity'
            ? 'equity-total'
            : 'debt',
        unit: 'INR-crore',
        observed: {
          value: match[7],
          citation: index,
          period: scope + ' | ' + match[2] + ' ' + match[3],
        },
        reference: null,
      },
    ];
  });
  if (rows.length !== 1)
    throw Error(
      'Use exactly one complete net-flow row citation; do not merge scopes, routes, dates or derivatives with cash.',
    );
  return InstitutionalFlowDraftSchema.parse({
    eventId: event.id,
    eventVersion: event.version,
    model: rows[0],
  });
}
