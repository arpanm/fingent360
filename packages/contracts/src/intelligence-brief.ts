import { z } from 'zod';
import { EventPublicSchema } from './events.js';
export const IntelligenceBriefInputSchema = z
  .strictObject({
    requestId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    title: z.string().trim().min(5).max(160),
    reason: z.string().trim().min(12).max(2000),
    events: z
      .array(
        z.strictObject({ id: z.uuid(), version: z.number().int().positive() }),
      )
      .min(5)
      .max(6),
  })
  .refine(
    (value) =>
      new Set(value.events.map((e) => e.id)).size === value.events.length,
    'Choose five or six distinct reviewed events.',
  );
export const IntelligenceBriefReceiptSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.number().int().positive(),
    preparedAt: z.iso.datetime(),
    input: IntelligenceBriefInputSchema,
    events: z.array(EventPublicSchema).min(5).max(6),
  })
  .superRefine((value, ctx) => {
    if (
      value.version !== value.input.expectedVersion + 1 ||
      value.events.length !== value.input.events.length ||
      value.events.some(
        (e, i) =>
          e.status !== 'published' ||
          !e.event ||
          e.id !== value.input.events[i]?.id ||
          e.event.version !== value.input.events[i]?.version ||
          e.event.editorial.claimKind !== 'fact',
      )
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Every brief point must bind its exact currently admitted reviewed fact event.',
      });
    const evidence = value.events.map((event) =>
      JSON.stringify(
        event.event?.editorial.citations
          .map((c) => ({
            sourceId: c.sourceId,
            version: c.version,
            field: c.field,
            quote: c.quote,
          }))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ),
    );
    if (new Set(evidence).size !== evidence.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate source points cannot fill the brief.',
      });
    const links = value.events.flatMap((e) => e.event?.editorial.links ?? []);
    if (
      !links.some((l) => l.kind === 'sector') ||
      !links.some((l) => l.kind === 'instrument')
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'The brief needs actual reviewed sector and company detail links.',
      });
  });
export const IntelligenceBriefReviewSchema = z.strictObject({
  requestId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  decision: z.enum(['publish', 'withdraw']),
  reason: z.string().trim().min(12).max(2000),
});
export const IntelligenceBriefPointSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.number().int().positive(),
    status: z.enum(['current', 'changed', 'unavailable']),
    event: EventPublicSchema.nullable(),
    reasons: z.array(z.string()),
  })
  .superRefine((value, ctx) => {
    if (
      (value.status === 'current') !== (value.event !== null) ||
      (value.event &&
        (value.event.id !== value.id ||
          value.event.event?.version !== value.version ||
          value.event.status !== 'published' ||
          value.event.event?.editorial.claimKind !== 'fact'))
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Only a current admitted brief point may disclose event content.',
      });
  });
export const IntelligenceBriefPublicSchema = z
  .strictObject({
    id: z.uuid(),
    version: z.number().int().positive(),
    title: z.string(),
    status: z.enum(['published', 'withdrawn']),
    issuedAt: z.iso.datetime(),
    evaluatedAt: z.iso.datetime(),
    points: z.array(IntelligenceBriefPointSchema).max(6),
  })
  .superRefine((value, ctx) => {
    if (
      (value.status === 'withdrawn'
        ? value.points.length !== 0
        : value.points.length < 5) ||
      new Set(value.points.map((point) => point.id)).size !==
        value.points.length
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Published briefs contain five or six points; withdrawn brief text is suppressed.',
      });
  });
export const IntelligenceBriefListSchema = z.strictObject({
  items: z.array(IntelligenceBriefPublicSchema).max(50),
  next: z.uuid().nullable(),
});
export const IntelligenceBriefQueueSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        receipt: IntelligenceBriefReceiptSchema,
        state: z.enum(['draft', 'published', 'withdrawn']),
        publishedVersion: z.number().int().positive().nullable(),
      }),
    )
    .max(50),
  next: z.uuid().nullable(),
});
export const IntelligenceBriefHistorySchema = z.strictObject({
  versions: z
    .array(
      z.strictObject({
        version: z.number().int().positive(),
        issuedAt: z.iso.datetime(),
      }),
    )
    .max(50),
  nextBefore: z.number().int().positive().nullable(),
});
export const IntelligenceBriefSnapshotSchema = z.strictObject({
  capturedAt: z.iso.datetime(),
  items: z.array(IntelligenceBriefPublicSchema).max(100),
  histories: z.record(z.uuid(), IntelligenceBriefHistorySchema),
});
export function projectIntelligenceBrief(
  receipt: z.infer<typeof IntelligenceBriefReceiptSchema>,
  current: z.infer<typeof EventPublicSchema>[],
  issuedAt: string,
  at: string,
  status: 'published' | 'withdrawn' = 'published',
) {
  const value = IntelligenceBriefReceiptSchema.parse(receipt);
  return IntelligenceBriefPublicSchema.parse({
    id: value.id,
    version: value.version,
    title: status === 'withdrawn' ? 'Withdrawn brief' : value.input.title,
    status,
    issuedAt,
    evaluatedAt: at,
    points:
      status === 'withdrawn'
        ? []
        : value.events.map((saved) => {
            const actual = current.find((e) => e.id === saved.id),
              same =
                actual?.status === 'published' &&
                actual.event?.version === saved.event!.version &&
                JSON.stringify(actual.event) === JSON.stringify(saved.event);
            const reasons: string[] = [];
            if (!same)
              reasons.push(
                actual?.event
                  ? 'The reviewed event has changed. This issued point is hidden until a new brief is reviewed.'
                  : 'Event, source, identity or lineage admission is unavailable. This point is hidden.',
              );
            if (
              same &&
              actual!.event!.sources.some(
                (source) =>
                  Date.parse(at) - Date.parse(source.publishedAt) >
                  30 * 86400000,
              )
            )
              reasons.push(
                'Historical source beyond the 30-day editorial review window.',
              );
            if (same && !actual!.event!.editorial.announcedAt)
              reasons.push(
                'Exact event announcement time is not established; inspect the source date labels.',
              );
            return {
              id: saved.id,
              version: saved.event!.version,
              status: same
                ? 'current'
                : actual?.event
                  ? 'changed'
                  : 'unavailable',
              event: same ? actual : null,
              reasons,
            };
          }),
  });
}
