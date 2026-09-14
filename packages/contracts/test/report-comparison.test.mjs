import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRecordReports,
  issueRecordReport,
  emptyAllocation,
  ReportComparisonQuerySchema,
  ReportComparisonSchema,
} from '../dist/index.js';
const firstId = '10000000-0000-4000-8000-000000000001';
const secondId = '10000000-0000-4000-8000-000000000002';
const goalId = '10000000-0000-4000-8000-000000000003';
const t1 = '2026-01-01T00:00:00.000Z',
  t2 = '2026-01-02T00:00:00.000Z';
function snapshot(at = t1) {
  return {
    capturedAt: at,
    goals: [
      {
        id: goalId,
        version: 1,
        name: 'Synthetic goal',
        type: 'education',
        targetMinor: '9999999999999999',
        savedMinor: '9999999999999000',
        monthlyMinor: '1',
        horizonMonths: 12,
        currency: 'INR',
        scale: 2,
        assumptions: 'no-growth-nominal-v1',
        storageConsent: true,
        createdAt: t1,
        updatedAt: t1,
        projectedMinor: '9999999999999012',
        gapMinor: '987',
      },
    ],
    holdings: {
      version: 1,
      holdings: [
        {
          isin: 'INE002A01018',
          quantity: '999999999999.999999',
          totalCostMinor: '9999999999999999',
        },
      ],
      totalCostMinor: '9999999999999999',
      currency: 'INR',
      scale: 2,
      provenance: 'user-entered-unverified',
      updatedAt: t1,
    },
    allocations: emptyAllocation(),
  };
}
function original(id, at, edit = () => {}) {
  const s = snapshot(at);
  edit(s);
  return issueRecordReport(id, 'Synthetic original', s, at);
}
test('exact whole-paise and millionth differences exceed safe Number range; direction ignores selection order', () => {
  const a = original(firstId, t1),
    b = original(secondId, t2, (s) => {
      s.goals[0].monthlyMinor = '2';
      s.goals[0].version = 2;
      s.holdings.holdings[0].quantity = '999999999999.999998';
      s.holdings.holdings[0].totalCostMinor = '9999999999999998';
    });
  const result = compareRecordReports(b, a, t2);
  assert.equal(result.earlier.id, firstId);
  assert.equal(
    result.holdings[0].fields.find((f) => f.field === 'quantity').difference,
    '-1',
  );
  assert.equal(result.recordedCost.difference, '-1');
  assert.equal(
    result.goals[0].fields.find((f) => f.field === 'projected').difference,
    '12',
  );
  assert.equal(
    result.goals[0].fields.find((f) => f.field === 'gap').difference,
    '-12',
  );
  assert.deepEqual(result, compareRecordReports(a, b, t2));
  assert.equal(result.research.comparable, false);
});
test('added and removed records have no invented numeric baseline; unchanged fractional spellings normalize', () => {
  const a = original(firstId, t1, (s) => {
    s.holdings.holdings[0].quantity = '3.1';
  });
  const b = original(secondId, t2, (s) => {
    s.holdings.holdings[0].quantity = '3.100000';
    s.goals = [];
    s.allocations.rows = [
      {
        goalId,
        goalVersion: 1,
        isin: 'INE002A01018',
        quantity: '1',
        goalName: 'Old binding',
        recordedCostMinor: '10',
      },
    ];
  });
  const r = compareRecordReports(a, b, t2);
  assert.equal(r.holdings[0].status, 'unchanged');
  assert.equal(r.goals[0].status, 'removed');
  assert.ok(
    r.goals[0].fields.every((f) => f.after === null && f.difference === null),
  );
  assert.equal(r.allocations[0].status, 'added');
  assert.ok(
    r.allocations[0].fields.every(
      (f) => f.before === null && f.difference === null,
    ),
  );
});
test('ties use issue time then stable ID; strict input and duplicate originals fail closed', () => {
  const a = original(firstId, t1),
    b = original(secondId, t1);
  const r = compareRecordReports(b, a, t2);
  assert.equal(r.earlier.id, firstId);
  assert.equal(r.tiedCaptureTimes, true);
  assert.throws(() => compareRecordReports(a, a, t2));
  assert.throws(() => compareRecordReports({ ...a, unknown: 'field' }, b, t2));
  const invalid = structuredClone(a);
  invalid.snapshot.goals.push(invalid.snapshot.goals[0]);
  assert.throws(() => compareRecordReports(invalid, b, t2));
  assert.equal(
    ReportComparisonQuerySchema.safeParse({
      first: firstId,
      second: secondId,
      extra: 1,
    }).success,
    false,
  );
  assert.equal(
    ReportComparisonSchema.safeParse({ ...r, marketReturn: '10%' }).success,
    false,
  );
});
test('v1 absence is not v2 removal; v2 note and binding changes retain dated context', () => {
  const v1 = original(firstId, t1);
  const source = {
    itemId: 'synthetic-source',
    version: 1,
    sourceHash: 'a'.repeat(64),
    name: 'Synthetic source fixture',
    url: 'https://example.com/fixture',
    publishedAt: t1,
    effectiveLabel: 'Synthetic fixture',
    retrievedAt: t1,
  };
  const receipt = {
    revision: {
      id: goalId,
      version: 1,
      action: 'create',
      source,
      target: {
        binding: { kind: 'goal', id: goalId, version: 1 },
        label: 'Synthetic goal',
      },
      note: 'First private note',
      savedAt: t1,
      consentedAt: t1,
      removed: false,
    },
    reviewReasons: [],
    sourceAtCapture: source,
    targetAtCapture: null,
  };
  const s = snapshot(t2);
  s.researchConnections = {
    evaluatedAt: t2,
    bundleGeneratedAt: null,
    receipts: [receipt],
  };
  const v2 = issueRecordReport(secondId, 'v2 fixture', s, t2);
  const mixed = compareRecordReports(v1, v2, t2);
  assert.equal(mixed.research.comparable, false);
  assert.deepEqual(mixed.research.rows, []);
  assert.equal(mixed.research.earlierCapturedAt, null);
  const older = structuredClone(v2);
  older.id = firstId;
  older.snapshot.capturedAt = t1;
  older.issuedAt = t1;
  const newer = structuredClone(v2);
  newer.snapshot.researchConnections.receipts[0].revision.note =
    '<script>text only</script>';
  newer.snapshot.researchConnections.receipts[0].revision.version = 2;
  const compared = compareRecordReports(older, newer, t2);
  assert.equal(compared.research.comparable, true);
  assert.equal(compared.research.rows[0].status, 'changed');
  assert.equal(
    compared.research.rows[0].fields.find((f) => f.field === 'note').after,
    '<script>text only</script>',
  );
});
test('typed response rejects nonnumeric rendering values, wrong units, inconsistent differences and duplicate row keys', () => {
  const r = compareRecordReports(
    original(firstId, t1),
    original(secondId, t2),
    t2,
  );
  for (const corrupt of [
    { ...r, recordedCost: { ...r.recordedCost, before: 'not a number' } },
    { ...r, recordedCost: { ...r.recordedCost, unit: 'text' } },
    { ...r, recordedCost: { ...r.recordedCost, difference: '1' } },
    { ...r, goals: [...r.goals, r.goals[0]] },
  ])
    assert.equal(ReportComparisonSchema.safeParse(corrupt).success, false);
});
