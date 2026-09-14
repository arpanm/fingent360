import { z } from 'zod';
import {
  DiscoveryIdSchema,
  FeedItemSchema,
  type FeedItem,
} from './discovery.js';
import { EventEditorialSchema } from './events.js';

export const EVENT_EXTRACTION_METHOD = 'event-extraction-v1' as const;
export const EVENT_EXTRACTION_SOURCE_TEXT_LIMIT = 24576 as const;
export const EventExtractionMethodSchema = z.enum([
  'template',
  'auto',
  'openai',
  'gemini',
  'anthropic',
]);
export const EventExtractionProviderSchema = z.enum([
  'openai',
  'gemini',
  'anthropic',
]);
const Version = z.number().int().positive().max(2147483647);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Field = z.enum(['title', 'summary', 'body']);
const limits = { title: 200, summary: 1600, body: 4000 } as const;

/** Offsets and lengths use JavaScript UTF-16 code units, never UTF-8 bytes. */
function validUtf16(value: string) {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}
function boundary(value: string, at: number) {
  return !(
    at > 0 &&
    at < value.length &&
    value.charCodeAt(at - 1) >= 0xd800 &&
    value.charCodeAt(at - 1) <= 0xdbff &&
    value.charCodeAt(at) >= 0xdc00 &&
    value.charCodeAt(at) <= 0xdfff
  );
}
function prefix(value: string, limit: number) {
  let end = Math.min(value.length, limit);
  if (!boundary(value, end)) end--;
  return value.slice(0, end);
}
const Text = (min: number, max: number) =>
  z
    .string()
    .refine(
      (value) => value.length >= min && value.length <= max,
      'Text length must fit the UTF-16 bounds.',
    )
    .refine(validUtf16, 'Text must contain complete Unicode characters.');
export const EventExtractionInputSchema = z.strictObject({
  sourceId: DiscoveryIdSchema,
  expectedVersion: Version,
  sourceHash: Hash,
  method: EventExtractionMethodSchema,
});
export const EventExtractionSelectionSchema = z
  .strictObject({
    field: Field,
    start: z.number().int().nonnegative().max(4000),
    end: z.number().int().positive().max(4000),
  })
  .superRefine((selection, context) => {
    if (
      selection.end - selection.start < 8 ||
      selection.end - selection.start > 800 ||
      selection.end > limits[selection.field]
    )
      context.addIssue({
        code: 'custom',
        message: 'Select8–800 UTF-16 units within the bounded source field.',
      });
  });
export type EventExtractionSelection = z.infer<
  typeof EventExtractionSelectionSchema
>;
function overlap(selections: EventExtractionSelection[]) {
  return selections.some((left, index) =>
    selections
      .slice(index + 1)
      .some(
        (right) =>
          left.field === right.field &&
          left.start < right.end &&
          right.start < left.end,
      ),
  );
}
export const EventExtractionSelectionsSchema = z
  .strictObject({
    selections: z.array(EventExtractionSelectionSchema).min(1).max(2),
  })
  .refine(
    (value) => !overlap(value.selections),
    'Selected ranges in one field must be distinct and nonoverlapping.',
  );
const Excerpt = z
  .strictObject({
    field: Field,
    start: z.number().int().nonnegative().max(4000),
    end: z.number().int().positive().max(4000),
    quote: Text(8, 800),
  })
  .superRefine((excerpt, context) => {
    if (
      !EventExtractionSelectionSchema.safeParse({
        field: excerpt.field,
        start: excerpt.start,
        end: excerpt.end,
      }).success ||
      excerpt.end - excerpt.start !== excerpt.quote.length
    )
      context.addIssue({
        code: 'custom',
        message: 'Exact excerpt length must match its source offsets.',
      });
  });
export const EventExtractionCandidateSchema = z
  .strictObject({
    eventId: z.uuid(),
    title: Text(1, 200),
    titleTruncated: z.boolean(),
    excerpts: z.array(Excerpt).min(1).max(2),
  })
  .refine(
    (value) => !overlap(value.excerpts),
    'Candidate excerpts must have distinct nonoverlapping source ranges.',
  );
export type EventExtractionCandidate = z.infer<
  typeof EventExtractionCandidateSchema
>;

/** Only source text enters the optional selector. The dispatcher separately caps JSON UTF-8 bytes. */
export function eventExtractionMaterial(source: FeedItem) {
  const admitted = FeedItemSchema.parse(source);
  if (admitted.status !== 'published' || !admitted.sourceHash)
    throw Error(
      'Event extraction requires an admitted published source edition.',
    );
  const material = {
    title: prefix(admitted.title, limits.title),
    summary: prefix(admitted.summary, limits.summary),
    body: prefix(admitted.body, limits.body),
  };
  if (!Object.values(material).every(validUtf16))
    throw Error('Source text contains an incomplete Unicode character.');
  return material;
}

/** A model may select offsets only. Quotes are reconstructed here, never accepted from its output. */
export function validateEventExtractionSelection(
  source: FeedItem,
  value: unknown,
): EventExtractionSelection[] {
  const selected = EventExtractionSelectionsSchema.parse(value).selections;
  const material = eventExtractionMaterial(source);
  for (const selection of selected) {
    const text = material[selection.field];
    if (
      selection.end > text.length ||
      !boundary(text, selection.start) ||
      !boundary(text, selection.end)
    )
      throw Error(
        'Selected excerpt is outside the admitted source text or splits a Unicode character.',
      );
  }
  return selected;
}

export function buildEventExtractionCandidate(
  source: FeedItem,
  eventId: string,
  selections?: EventExtractionSelection[],
): EventExtractionCandidate {
  const material = eventExtractionMaterial(source);
  let selected = selections;
  if (selected === undefined) {
    for (const field of ['body', 'summary', 'title'] as const) {
      const quote = prefix(material[field], 800);
      if (quote.length >= 8 && quote.trim().length) {
        selected = [{ field, start: 0, end: quote.length }];
        break;
      }
    }
    if (!selected)
      throw Error(
        'This source has no complete excerpt of at least8 UTF-16 units.',
      );
  }
  const validated = validateEventExtractionSelection(source, {
    selections: selected,
  });
  return EventExtractionCandidateSchema.parse({
    eventId: z.uuid().parse(eventId).toLowerCase(),
    title: material.title,
    titleTruncated: material.title.length < source.title.length,
    excerpts: validated.map((selection) => ({
      ...selection,
      quote: material[selection.field].slice(selection.start, selection.end),
    })),
  });
}

export const EventExtractionAttemptSchema = z
  .strictObject({
    requestId: z.uuid(),
    methodVersion: z.literal(EVENT_EXTRACTION_METHOD),
    source: z.strictObject({
      id: DiscoveryIdSchema,
      version: Version,
      hash: Hash,
    }),
    requestedMethod: EventExtractionMethodSchema,
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
    status: z.enum(['running', 'prepared', 'failed']),
    outcome: z.enum([
      'pending',
      'template',
      'model',
      'not-configured',
      'provider-failed',
      'invalid-selection',
      'source-changed',
      'interrupted',
      'storage',
    ]),
    provider: EventExtractionProviderSchema.nullable(),
    model: z.string().min(1).max(200).nullable(),
    candidate: EventExtractionCandidateSchema.nullable(),
  })
  .superRefine((attempt, context) => {
    const providerPresent = attempt.provider !== null;
    const invalidProvider =
      providerPresent !== (attempt.model !== null) ||
      (attempt.requestedMethod === 'template' && providerPresent) ||
      (!['template', 'auto'].includes(attempt.requestedMethod) &&
        providerPresent &&
        attempt.provider !== attempt.requestedMethod);
    const invalidTime =
      attempt.finishedAt !== null &&
      Date.parse(attempt.finishedAt) < Date.parse(attempt.startedAt);
    let invalidOutcome: boolean;
    if (attempt.status === 'running') {
      invalidOutcome =
        attempt.outcome !== 'pending' ||
        attempt.finishedAt !== null ||
        attempt.candidate !== null;
    } else if (attempt.status === 'prepared') {
      invalidOutcome =
        attempt.finishedAt === null ||
        attempt.candidate === null ||
        ![
          'template',
          'model',
          'not-configured',
          'provider-failed',
          'invalid-selection',
        ].includes(attempt.outcome) ||
        (attempt.outcome === 'template' &&
          (attempt.requestedMethod !== 'template' || providerPresent)) ||
        (attempt.outcome === 'not-configured' &&
          (attempt.requestedMethod === 'template' || providerPresent)) ||
        (['model', 'provider-failed', 'invalid-selection'].includes(
          attempt.outcome,
        ) &&
          !providerPresent);
    } else {
      invalidOutcome =
        attempt.finishedAt === null ||
        attempt.candidate !== null ||
        ![
          'provider-failed',
          'invalid-selection',
          'source-changed',
          'interrupted',
          'storage',
        ].includes(attempt.outcome) ||
        (attempt.outcome === 'provider-failed' && !providerPresent);
    }
    if (invalidProvider || invalidTime || invalidOutcome)
      context.addIssue({
        code: 'custom',
        message:
          'Extraction status, method, attempted provider, timing and retained candidate must reconcile.',
      });
  });
export type EventExtractionAttempt = z.infer<
  typeof EventExtractionAttemptSchema
>;
export const EventExtractionDecisionInputSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      requestId: z.uuid(),
      kind: z.literal('decline'),
      reason: z.string().trim().min(1).max(1000),
    }),
    z.strictObject({
      requestId: z.uuid(),
      kind: z.literal('draft'),
      reason: z.string().trim().min(1).max(1000),
      editorial: EventEditorialSchema,
    }),
  ])
  .superRefine((decision, context) => {
    if (
      decision.kind === 'draft' &&
      (decision.editorial.announcedAt !== null ||
        decision.editorial.effectiveAt !== null ||
        decision.editorial.links.length !== 0 ||
        decision.editorial.citations.length > 2)
    )
      context.addIssue({
        code: 'custom',
        message:
          'An extraction draft has1–2 exact source citations, unknown dates and no inferred context links. Review additions in the ordinary event editor.',
      });
  });
export const EventExtractionDecisionSchema = z
  .strictObject({
    requestId: z.uuid(),
    extractionId: z.uuid(),
    kind: z.enum(['decline', 'draft']),
    reason: z.string().min(1).max(1000),
    decidedAt: z.iso.datetime(),
    eventId: z.uuid().nullable(),
    eventVersion: z.literal(1).nullable(),
  })
  .refine(
    (decision) =>
      decision.kind === 'draft'
        ? decision.eventId !== null && decision.eventVersion === 1
        : decision.eventId === null && decision.eventVersion === null,
    'Only an explicit draft decision creates one candidate event revision.',
  );
export type EventExtractionDecision = z.infer<
  typeof EventExtractionDecisionSchema
>;
export const EventExtractionOptionsSchema = z
  .strictObject({
    providers: z
      .array(
        z.strictObject({
          provider: EventExtractionProviderSchema,
          model: z.string().min(1).max(200),
        }),
      )
      .max(3),
    defaultMethod: z.enum(['template', 'auto']),
    sourceTextLimit: z.literal(EVENT_EXTRACTION_SOURCE_TEXT_LIMIT),
  })
  .refine(
    (value) =>
      new Set(value.providers.map((item) => item.provider)).size ===
      value.providers.length,
    'Configured providers must be distinct.',
  );
export const EventExtractionViewSchema = z
  .strictObject({
    attempt: EventExtractionAttemptSchema,
    decision: EventExtractionDecisionSchema.nullable(),
    currentSource: z.enum(['current', 'changed', 'withdrawn', 'missing']),
  })
  .superRefine((value, context) => {
    const { attempt, decision } = value;
    if (
      decision &&
      (decision.extractionId !== attempt.requestId ||
        attempt.status !== 'prepared' ||
        attempt.finishedAt === null ||
        Date.parse(decision.decidedAt) < Date.parse(attempt.finishedAt) ||
        (decision.kind === 'draft' &&
          decision.eventId !== attempt.candidate?.eventId))
    )
      context.addIssue({
        code: 'custom',
        message:
          'Decision must follow and bind this exact prepared extraction candidate.',
      });
  });
export type EventExtractionView = z.infer<typeof EventExtractionViewSchema>;
export const EventExtractionListSchema = z
  .strictObject({
    items: z.array(EventExtractionViewSchema).max(20),
    next: z.uuid().nullable(),
  })
  .refine(
    (value) =>
      new Set(value.items.map((item) => item.attempt.requestId.toLowerCase()))
        .size === value.items.length,
    'Extraction list identities must be distinct.',
  );
