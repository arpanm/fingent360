import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ScheduleConfigSchema,
  scheduleInstant,
  nextScheduleDue,
  latestScheduleDue,
} from '../dist/index.js';
const config = {
  label: 'Synthetic schedule',
  frequency: 'daily',
  time: '02:30',
  timezone: 'America/New_York',
  weekday: 1,
  policy: 'saved-record-review-v1',
};
test('schedule DST gap advances to first valid minute and fold chooses first occurrence', () => {
  assert.equal(
    scheduleInstant(config, '2026-03-08'),
    '2026-03-08T07:00:00.000Z',
  );
  assert.equal(
    scheduleInstant({ ...config, time: '01:30' }, '2026-11-01'),
    '2026-11-01T05:30:00.000Z',
  );
});
test('future creation, weekly calendar and bounded latest-due catch-up use actual wall dates', () => {
  const c = { ...config, timezone: 'Asia/Kolkata', time: '09:00' };
  assert.equal(
    nextScheduleDue(c, '2026-09-14T03:30:00.000Z'),
    '2026-09-15T03:30:00.000Z',
  );
  assert.deepEqual(
    latestScheduleDue(
      c,
      '2026-09-01T03:30:00.000Z',
      '2026-09-14T10:00:00.000Z',
    ),
    {
      dueAt: '2026-09-14T03:30:00.000Z',
      nextDueAt: '2026-09-15T03:30:00.000Z',
      skipped: 13,
    },
  );
  assert.equal(
    nextScheduleDue(
      { ...c, frequency: 'weekly', weekday: 1 },
      '2026-09-14T03:30:00.000Z',
    ),
    '2026-09-21T03:30:00.000Z',
  );
  assert.equal(
    ScheduleConfigSchema.safeParse({ ...c, timezone: 'Invalid/Zone' }).success,
    false,
  );
});
