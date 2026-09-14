import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LibraryReminderWorker } from '../dist/library-worker.js';

// Synthetic query fixtures isolate projection/admission decisions; actual locks
// and concurrent cancellation are covered by worker/source E2E cases.
function fixture({
  status = 'published',
  paused = false,
  eligible = true,
  stillDue = true,
} = {}) {
  const calls = [];
  const reminder = { id: 'reminder', user_id: 'owner', item_id: 'term' };
  const item = {
    id: 'term',
    version: 2,
    kind: 'term',
    title: 'Corrected title',
    summary: 'Synthetic corrected source.',
    body: 'Synthetic owned test content.',
    topics: [],
    publishedAt: '2026-09-01T00:00:00.000Z',
    effectiveLabel: 'Synthetic',
    source: {
      name: 'Synthetic source',
      url: 'https://example.test/term',
      retrievedAt: '2026-09-01T00:00:00.000Z',
      rights: 'Synthetic test fixture',
    },
    sourceHash: null,
    importance: 1,
    relatedIds: [],
    status,
    correctionNote: 'Synthetic correction',
    reviewedAt: '2026-09-01T00:00:00.000Z',
  };
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('FROM worker_controls')) return { rows: [{ paused }] };
      if (sql.startsWith('SELECT') && sql.includes('FROM library_reminders'))
        return {
          rows: sql.includes('FOR UPDATE')
            ? stillDue && params[0].includes(reminder.id)
              ? [reminder]
              : []
            : [reminder],
        };
      if (sql.includes('FROM app_users'))
        return { rows: eligible ? [{ id: reminder.user_id }] : [] };
      if (sql.includes('FROM discovery_items') && sql.includes('FOR SHARE'))
        return { rows: params[0].includes(item.id) ? [{ id: item.id }] : [] };
      if (sql.includes('FROM discovery_versions'))
        return { rows: params[0].includes(item.id) ? [{ data: item }] : [] };
      return { rows: [] };
    },
  };
  return {
    calls,
    worker: new LibraryReminderWorker({ transaction: (work) => work(client) }),
  };
}

test('reminder delivery snapshots current published title after worker account and source admission', async () => {
  const { calls, worker } = fixture();
  await worker.deliver();
  const insert = calls.find((call) =>
    call.sql.startsWith('INSERT INTO library_notifications'),
  );
  assert.equal(insert.params[4], 'Corrected title');
  assert.ok(calls[0].sql.includes('FROM worker_controls'));
  const account = calls.findIndex((call) =>
    call.sql.includes('FROM app_users'),
  );
  const source = calls.findIndex(
    (call) =>
      call.sql.includes('FROM discovery_items') &&
      call.sql.includes('FOR SHARE'),
  );
  const claim = calls.findIndex(
    (call) =>
      call.sql.includes('FROM library_reminders') &&
      call.sql.includes('FOR UPDATE'),
  );
  assert.ok(account > 0 && source > account && claim > source);
  assert.deepEqual(calls[claim].params[0], ['reminder']);
  assert.ok(calls.some((call) => call.sql.includes("status='delivered'")));
  assert.ok(calls.some((call) => call.sql.includes('worker_observations')));
});

test('withdrawn source cancels a pending reminder without creating notification', async () => {
  const { calls, worker } = fixture({ status: 'withdrawn' });
  await worker.deliver();
  assert.ok(
    !calls.some((call) =>
      call.sql.startsWith('INSERT INTO library_notifications'),
    ),
  );
  assert.ok(calls.some((call) => call.sql.includes("status='cancelled'")));
});

test('paused reminder worker does not read candidates or touch private reminder state', async () => {
  const { calls, worker } = fixture({ paused: true });
  await worker.deliver();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].sql.includes('FROM worker_controls'));
});

for (const options of [{ eligible: false }, { stillDue: false }]) {
  test(`reminder no longer admitted at claim does not deliver or cancel: ${JSON.stringify(options)}`, async () => {
    const { calls, worker } = fixture(options);
    await worker.deliver();
    assert.ok(
      !calls.some((call) =>
        call.sql.startsWith('INSERT INTO library_notifications'),
      ),
    );
    assert.ok(
      !calls.some((call) => call.sql.startsWith('UPDATE library_reminders')),
    );
    assert.ok(!calls.some((call) => call.sql.includes('worker_observations')));
  });
}
