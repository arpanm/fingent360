import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMaterial,
  emptyMaterial,
  syncMaterialContext,
  MaterialWriteSchema,
  MaterialNoticeSchema,
  MaterialThresholdSchema,
  MaterialExportSchema,
} from '../dist/index.js';
const indicator = 'NY.GDP.MKTP.KD.ZG',
  other = 'FP.CPI.TOTL.ZG';
const at = '2026-09-14T00:00:00.000Z';
let count = 0;
function observation(year, value, revision = 1) {
  return {
    id: `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}`,
    indicator,
    year,
    value,
    revision,
    unit: 'annual_percent',
    country: 'IND',
    providerUpdatedAt: '2026-09-13',
    retrievedAt: '2026-09-13T00:00:00.000Z',
    sourceHash: 'a'.repeat(64),
    sourceUrl: 'https://example.com/synthetic-only',
    supersedesId: null,
  };
}
const sources = (latest) => [{ indicator, latest, lastSuccessAt: at }];
const write = (state, extra) =>
  MaterialWriteSchema.parse({
    requestId: `10000000-0000-4000-8000-${String(++count).padStart(12, '0')}`,
    expectedVersion: state.version,
    ...extra,
  });
function configure(latest, threshold = '1') {
  const state = { ...emptyMaterial(), followed: [indicator] };
  return applyMaterial(
    state,
    write(state, {
      action: 'configure',
      policies: [{ indicator, thresholdPoints: threshold }],
      storageConsent: true,
    }),
    sources(latest),
    at,
  ).state;
}
const check = (state, latest) =>
  applyMaterial(state, write(state, { action: 'check' }), sources(latest), at);
test('material thresholds reject malformed/unknown input and reconcile exact decimal differences without rounding', () => {
  for (const threshold of [
    '0',
    '-1',
    '101',
    'NaN',
    '1e-6',
    '0.0000001',
    '01',
    '',
  ])
    assert.equal(MaterialThresholdSchema.safeParse(threshold).success, false);
  assert.equal(MaterialThresholdSchema.parse('1.000000'), '1');
  const before = observation(2022, '-0.000000000000000000000000000001');
  const state = configure(before, '0.000001');
  const result = check(state, observation(2023, '0.000001'));
  assert.equal(
    result.outcomes[0].differencePoints,
    '0.000001000000000000000000000001',
  );
  assert.equal(result.outcomes[0].outcome, 'material');
  assert.equal(state.baselines[0].observation.id, before.id);
  assert.equal(
    MaterialNoticeSchema.safeParse({
      ...result.state.notices[0],
      differencePoints: '0.000001',
    }).success,
    false,
  );
  assert.equal(
    MaterialNoticeSchema.safeParse({
      ...result.state.notices[0],
      before: { ...before, value: 'NaN' },
    }).success,
    false,
  );
  assert.equal(
    MaterialWriteSchema.safeParse({
      ...write(state, { action: 'check' }),
      extra: true,
    }).success,
    false,
  );
});
test('each fresh transition advances baseline, while revisions/unchanged do not create material notices', () => {
  let state = configure(observation(2020, '1'));
  let result = check(state, observation(2021, '1.6'));
  assert.equal(result.outcomes[0].outcome, 'below-threshold');
  state = result.state;
  result = check(state, observation(2022, '2.2'));
  assert.equal(result.outcomes[0].outcome, 'below-threshold');
  assert.equal(result.outcomes[0].before.value, '1.6');
  const revised = observation(2022, '15', 2);
  result = check(result.state, revised);
  assert.equal(result.outcomes[0].outcome, 'revision');
  assert.deepEqual(result.state.notices, []);
  result = check(result.state, revised);
  assert.equal(result.outcomes[0].outcome, 'unchanged');
  result = check(result.state, observation(2023, '17'));
  assert.equal(result.state.notices[0].before.id, revised.id);
  const original = result.state.notices[0];
  result = check(result.state, observation(2024, '20'));
  assert.equal(result.state.notices.length, 1);
  assert.equal(result.state.notices[0].version, 2);
  assert.equal(original.after.value, '17');
  assert.throws(() =>
    applyMaterial(
      result.state,
      write(result.state, {
        action: 'acknowledge',
        indicator,
        noticeVersion: 1,
        read: true,
      }),
      [],
      at,
    ),
  );
  for (const read of [true, false]) {
    result = applyMaterial(
      result.state,
      write(result.state, {
        action: 'acknowledge',
        indicator,
        noticeVersion: 2,
        read,
      }),
      [],
      at,
    );
    assert.equal(result.state.notices[0].read, read);
  }
});
test('missing/stale/future/older observations retain valid baselines; pending reset waits for actual fresh evidence', () => {
  const initial = observation(2020, '1'),
    state = configure(initial);
  for (const [latest, success, outcome] of [
    [observation(2021, null, 2), at, 'missing'],
    [observation(2021, '3'), '2026-08-01T00:00:00.000Z', 'stale'],
    [observation(2027, '3'), at, 'future-data'],
    [
      { ...observation(2021, '3'), retrievedAt: '2026-09-15T00:00:00.000Z' },
      at,
      'future-data',
    ],
    [observation(2019, '3'), at, 'older-period'],
  ]) {
    const receipt = applyMaterial(
      state,
      write(state, { action: 'check' }),
      [{ indicator, latest, lastSuccessAt: success }],
      at,
    );
    assert.equal(receipt.outcomes[0].outcome, outcome);
    assert.deepEqual(receipt.state.baselines[0].observation, initial);
    assert.deepEqual(receipt.state.notices, []);
  }
  const pending = configure(observation(2027, '3'));
  assert.equal(pending.baselines[0].pendingReset, true);
  assert.equal(
    check(pending, observation(2021, '6')).outcomes[0].outcome,
    'baseline',
  );
  const notice = check(state, observation(2021, '3')).state.notices[0];
  assert.equal(
    MaterialNoticeSchema.safeParse({
      ...notice,
      checkedAt: '2026-09-12T00:00:00.000Z',
    }).success,
    false,
  );
});
test('mute freezes, unmute rebases, unrelated settings preserve retained rules and unfollow removes only current state', () => {
  let state = configure(observation(2020, '1'));
  state = check(state, observation(2021, '3')).state;
  const notice = structuredClone(state.notices[0]);
  state = syncMaterialContext(
    state,
    [indicator, other],
    [indicator],
    sources(observation(2022, '8')),
    at,
  );
  const muted = check(state, observation(2023, '12'));
  assert.equal(muted.outcomes[0].outcome, 'muted');
  assert.equal(muted.state.baselines[0].observation.year, 2021);
  const same = applyMaterial(
    state,
    write(state, {
      action: 'configure',
      policies: state.policies,
      storageConsent: true,
    }),
    sources(observation(2023, '12')),
    at,
  );
  assert.deepEqual(same.state.notices[0], notice);
  state = syncMaterialContext(
    same.state,
    [indicator, other],
    [],
    sources(observation(2023, '12')),
    at,
  );
  assert.deepEqual(state.notices, []);
  assert.equal(state.baselines[0].observation.year, 2023);
  state = syncMaterialContext(state, [other], [], [], at);
  assert.deepEqual(state.policies, []);
  assert.equal(notice.after.value, '3');
});
test('history pages reject repeated/backward/out-of-bound sequences', () => {
  const state = configure(observation(2020, '1'));
  const receipt = check(state, observation(2021, '3'));
  const page = {
    ownerId: '00000000-0000-4000-8000-000000000001',
    upper: '2',
    events: [{ sequence: '1', receipt }],
    next: null,
  };
  assert.equal(MaterialExportSchema.safeParse(page).success, true);
  for (const change of [
    { events: [...page.events, ...page.events] },
    { upper: '0' },
    { next: '1' },
  ])
    assert.equal(
      MaterialExportSchema.safeParse({ ...page, ...change }).success,
      false,
    );
});
