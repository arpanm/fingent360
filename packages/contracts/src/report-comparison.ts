import { z } from 'zod';
import { goalProjection } from './goals.js';
import { quantityMillionths } from './allocations.js';
import { RecordReportSchema, type RecordReport } from './reports.js';

export const ReportComparisonQuerySchema = z
  .strictObject({ first: z.uuid(), second: z.uuid() })
  .refine((v) => v.first !== v.second, 'Choose two different issued reports.');
export const ReportComparisonReferenceSchema = z.strictObject({
  id: z.uuid(),
  label: z.string().max(100),
  capturedAt: z.iso.datetime(),
  issuedAt: z.iso.datetime(),
  policy: z.enum(['saved-record-review-v1', 'saved-record-review-v2']),
  holdingsVersion: z.number().int().nonnegative(),
  allocationVersion: z.number().int().nonnegative(),
});
export const ReportComparisonOptionsSchema = z.strictObject({
  reports: z.array(ReportComparisonReferenceSchema).max(100),
});
const SignedInteger = z.string().regex(/^(0|-?[1-9][0-9]*)$/);
const FieldName = z.enum([
  'name',
  'type',
  'version',
  'target',
  'saved',
  'monthly',
  'months',
  'projected',
  'gap',
  'quantity',
  'cost',
  'goalVersion',
  'holdingsVersion',
  'review',
  'sourceId',
  'sourceVersion',
  'sourceHash',
  'sourceName',
  'sourcePublishedAt',
  'sourceRetrievedAt',
  'targetKind',
  'targetId',
  'targetVersion',
  'targetLabel',
  'note',
  'savedAt',
  'sourceAtCapture',
  'targetAtCapture',
]);
export const ReportComparisonFieldSchema = z
  .strictObject({
    field: FieldName,
    before: z.string().max(4000).nullable(),
    after: z.string().max(4000).nullable(),
    difference: SignedInteger.nullable(),
    unit: z.enum(['text', 'paise', 'millionths', 'integer']),
  })
  .superRefine((v, ctx) => {
    const expected = [
      'target',
      'saved',
      'monthly',
      'projected',
      'gap',
      'cost',
    ].includes(v.field)
      ? 'paise'
      : v.field === 'quantity'
        ? 'millionths'
        : [
              'version',
              'months',
              'goalVersion',
              'holdingsVersion',
              'sourceVersion',
              'targetVersion',
            ].includes(v.field)
          ? 'integer'
          : 'text';
    const invalid = () =>
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid comparison field units or exact difference.',
      });
    if (v.unit !== expected || (v.before === null && v.after === null)) {
      invalid();
      return;
    }
    if (v.unit === 'text') {
      if (v.difference !== null) invalid();
      return;
    }
    if (
      [v.before, v.after].some(
        (n) => n !== null && !/^(0|[1-9][0-9]*)$/.test(n),
      )
    ) {
      invalid();
      return;
    }
    if (v.before === null || v.after === null) {
      if (v.difference !== null) invalid();
      return;
    }
    if (v.difference !== (BigInt(v.after) - BigInt(v.before)).toString())
      invalid();
  });
export const ReportComparisonRowSchema = z
  .strictObject({
    key: z.string().max(100),
    label: z.string().max(200),
    status: z.enum(['added', 'removed', 'changed', 'unchanged']),
    fields: z.array(ReportComparisonFieldSchema).min(1).max(25),
  })
  .superRefine((v, ctx) => {
    const expected = v.fields.every((f) => f.before === null)
      ? 'added'
      : v.fields.every((f) => f.after === null)
        ? 'removed'
        : v.fields.some((f) => f.before !== f.after)
          ? 'changed'
          : 'unchanged';
    if (
      new Set(v.fields.map((f) => f.field)).size !== v.fields.length ||
      expected !== v.status ||
      (['changed', 'unchanged'].includes(v.status) &&
        v.fields.some((f) => f.before === null || f.after === null))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid comparison row identity or presence.',
      });
  });
export const ReportComparisonSchema = z
  .strictObject({
    policy: z.literal('issued-record-comparison-v1'),
    checkedAt: z.iso.datetime(),
    earlier: ReportComparisonReferenceSchema,
    later: ReportComparisonReferenceSchema,
    tiedCaptureTimes: z.boolean(),
    goals: z.array(ReportComparisonRowSchema).max(200),
    holdings: z.array(ReportComparisonRowSchema).max(400),
    allocations: z.array(ReportComparisonRowSchema).max(400),
    recordedCost: ReportComparisonFieldSchema,
    research: z.strictObject({
      earlierCapturedAt: z.iso.datetime().nullable(),
      laterCapturedAt: z.iso.datetime().nullable(),
      comparable: z.boolean(),
      rows: z.array(ReportComparisonRowSchema).max(40),
    }),
  })
  .superRefine((v, ctx) => {
    const fail = () =>
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid comparison baselines or research availability.',
      });
    if (
      v.earlier.id === v.later.id ||
      [v.goals, v.holdings, v.allocations, v.research.rows].some(
        (rs) => new Set(rs.map((r) => r.key)).size !== rs.length,
      )
    )
      fail();
    if (
      v.research.comparable !==
        (v.research.earlierCapturedAt !== null &&
          v.research.laterCapturedAt !== null) ||
      (!v.research.comparable && v.research.rows.length !== 0)
    )
      fail();
  });
export type ReportComparison = z.infer<typeof ReportComparisonSchema>;
export type ReportComparisonReference = z.infer<
  typeof ReportComparisonReferenceSchema
>;
export type ReportComparisonField = z.infer<typeof ReportComparisonFieldSchema>;
export type ReportComparisonRow = z.infer<typeof ReportComparisonRowSchema>;
export function reportComparisonReference(
  report: RecordReport,
): ReportComparisonReference {
  return ReportComparisonReferenceSchema.parse({
    id: report.id,
    label: report.label,
    capturedAt: report.snapshot.capturedAt,
    issuedAt: report.issuedAt,
    policy: report.policy,
    holdingsVersion: report.snapshot.holdings.version,
    allocationVersion: report.snapshot.allocations.version,
  });
}
type Value = { value: string; unit: ReportComparisonField['unit'] };
type Values = Partial<Record<ReportComparisonField['field'], Value>>;
type Item = { key: string; label: string; values: Values };
const text = (value: string): Value => ({ value, unit: 'text' });
const integer = (value: number): Value => ({
  value: String(value),
  unit: 'integer',
});
const money = (value: string): Value => ({ value, unit: 'paise' });
const quantity = (value: string): Value => ({
  value: quantityMillionths(value).toString(),
  unit: 'millionths',
});
function field(
  name: ReportComparisonField['field'],
  before?: Value,
  after?: Value,
): ReportComparisonField {
  const unit = (before ?? after)!.unit;
  if (before && after && before.unit !== after.unit)
    throw Error('Unsupported comparison units.');
  return {
    field: name,
    before: before?.value ?? null,
    after: after?.value ?? null,
    unit,
    difference:
      unit !== 'text' && before && after
        ? (BigInt(after.value) - BigInt(before.value)).toString()
        : null,
  };
}
function rows(before: Item[], after: Item[]): ReportComparisonRow[] {
  if (
    new Set(before.map((r) => r.key)).size !== before.length ||
    new Set(after.map((r) => r.key)).size !== after.length
  )
    throw Error('Duplicate original record identity.');
  return [...new Set([...before, ...after].map((r) => r.key))]
    .sort()
    .map((key) => {
      const a = before.find((r) => r.key === key),
        b = after.find((r) => r.key === key);
      const names = [
        ...new Set([
          ...Object.keys(a?.values ?? {}),
          ...Object.keys(b?.values ?? {}),
        ]),
      ] as Array<ReportComparisonField['field']>;
      const fields = names.map((name) =>
        field(name, a?.values[name], b?.values[name]),
      );
      return {
        key,
        label: (b ?? a)!.label,
        status: !a
          ? 'added'
          : !b
            ? 'removed'
            : fields.some((v) => v.before !== v.after)
              ? 'changed'
              : 'unchanged',
        fields,
      };
    });
}
function goals(r: RecordReport): Item[] {
  return r.snapshot.goals.map((g) => {
    const p = goalProjection(g);
    return {
      key: g.id,
      label: g.name,
      values: {
        name: text(g.name),
        type: text(g.type),
        version: integer(g.version),
        target: money(g.targetMinor),
        saved: money(g.savedMinor),
        monthly: money(g.monthlyMinor),
        months: integer(g.horizonMonths),
        projected: money(p.projectedMinor),
        gap: money(p.gapMinor),
      },
    };
  });
}
function holdings(r: RecordReport): Item[] {
  return r.snapshot.holdings.holdings.map((h) => ({
    key: h.isin,
    label: h.isin,
    values: { quantity: quantity(h.quantity), cost: money(h.totalCostMinor) },
  }));
}
function allocations(r: RecordReport): Item[] {
  return r.snapshot.allocations.rows.map((a) => ({
    key: `${a.goalId}:${a.isin}`,
    label: `${a.goalName} · ${a.isin}`,
    values: {
      name: text(a.goalName),
      goalVersion: integer(a.goalVersion),
      holdingsVersion: integer(r.snapshot.allocations.holdingsVersion),
      quantity: quantity(a.quantity),
      cost: money(a.recordedCostMinor),
      review: text(
        r.allocationReview
          .find((v) => v.goalId === a.goalId && v.isin === a.isin)
          ?.reasons.join(' ') ?? 'No review reason captured.',
      ),
    },
  }));
}
function research(r: RecordReport): Item[] {
  if (r.policy !== 'saved-record-review-v2') return [];
  return r.snapshot.researchConnections.receipts.map(
    ({ revision: v, reviewReasons, sourceAtCapture, targetAtCapture }) => ({
      key: v.id,
      label: v.target.label,
      values: {
        version: integer(v.version),
        note: text(v.note),
        sourceId: text(v.source.itemId),
        sourceVersion: integer(v.source.version),
        sourceHash: text(v.source.sourceHash),
        sourceName: text(v.source.name),
        sourcePublishedAt: text(v.source.publishedAt),
        sourceRetrievedAt: text(v.source.retrievedAt),
        targetKind: text(v.target.binding.kind),
        targetId: text(v.target.binding.id),
        targetVersion: integer(v.target.binding.version),
        targetLabel: text(v.target.label),
        savedAt: text(v.savedAt),
        review: text(reviewReasons.join(' ') || 'No review reason captured.'),
        sourceAtCapture: text(
          sourceAtCapture
            ? `${sourceAtCapture.itemId} / v${sourceAtCapture.version} / ${sourceAtCapture.sourceHash}`
            : 'Unavailable at capture',
        ),
        targetAtCapture: text(
          targetAtCapture
            ? `${targetAtCapture.binding.kind} / ${targetAtCapture.binding.id} / v${targetAtCapture.binding.version} / ${targetAtCapture.label}`
            : 'Unavailable at capture',
        ),
      },
    }),
  );
}
/** Pure transient view of strict originals; no current account/provider reads or stored comparison. */
export function compareRecordReports(
  first: RecordReport,
  second: RecordReport,
  checkedAt: string,
): ReportComparison {
  const originals = [
    RecordReportSchema.parse(first),
    RecordReportSchema.parse(second),
  ];
  ReportComparisonQuerySchema.parse({ first: first.id, second: second.id });
  originals.sort(
    (a, b) =>
      Date.parse(a.snapshot.capturedAt) - Date.parse(b.snapshot.capturedAt) ||
      Date.parse(a.issuedAt) - Date.parse(b.issuedAt) ||
      a.id.localeCompare(b.id),
  );
  const [a, b] = originals as [RecordReport, RecordReport];
  const comparable =
    a.policy === 'saved-record-review-v2' &&
    b.policy === 'saved-record-review-v2';
  return ReportComparisonSchema.parse({
    policy: 'issued-record-comparison-v1',
    checkedAt,
    earlier: reportComparisonReference(a),
    later: reportComparisonReference(b),
    tiedCaptureTimes:
      Date.parse(a.snapshot.capturedAt) === Date.parse(b.snapshot.capturedAt),
    goals: rows(goals(a), goals(b)),
    holdings: rows(holdings(a), holdings(b)),
    allocations: rows(allocations(a), allocations(b)),
    recordedCost: field(
      'cost',
      money(a.recordedHoldingsCostMinor),
      money(b.recordedHoldingsCostMinor),
    ),
    research: {
      earlierCapturedAt:
        a.policy === 'saved-record-review-v2'
          ? a.snapshot.researchConnections.evaluatedAt
          : null,
      laterCapturedAt:
        b.policy === 'saved-record-review-v2'
          ? b.snapshot.researchConnections.evaluatedAt
          : null,
      comparable,
      rows: comparable ? rows(research(a), research(b)) : [],
    },
  });
}
