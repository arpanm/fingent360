import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LibraryReminderWorker } from '../dist/library-worker.js';
test('reminder delivery snapshots current published title instead of outdated scheduling title', async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('FROM worker_controls'))
        return { rows: [{ paused: false }] };
      if (sql.includes('FROM library_reminders'))
        return {
          rows: [
            {
              id: 'reminder',
              user_id: 'owner',
              item_id: 'term',
              title: 'Old title',
            },
          ],
        };
      if (sql.includes('FROM discovery_versions'))
        return { rows: [{ status: 'published', title: 'Corrected title' }] };
      return { rows: [] };
    },
  };
  await new LibraryReminderWorker({
    transaction: (work) => work(client),
  }).deliver();
  const insert = calls.find((call) =>
    call.sql.startsWith('INSERT INTO library_notifications'),
  );
  assert.equal(insert.params[4], 'Corrected title');
  assert.ok(
    calls.find(
      (call) =>
        call.sql.includes('FROM discovery_items') &&
        call.sql.includes('FOR SHARE'),
    ),
  );
  assert.ok(calls.some((call) => call.sql.includes("status='delivered'")));
});
test('withdrawn source cancels a pending reminder without creating notification', async () => {
  const calls = [];
  const client = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('FROM worker_controls'))
        return { rows: [{ paused: false }] };
      if (sql.includes('FROM library_reminders'))
        return {
          rows: [
            {
              id: 'reminder',
              user_id: 'owner',
              item_id: 'term',
              title: 'Old title',
            },
          ],
        };
      if (sql.includes('FROM discovery_versions'))
        return { rows: [{ status: 'withdrawn', title: 'Withdrawn title' }] };
      return { rows: [] };
    },
  };
  await new LibraryReminderWorker({
    transaction: (work) => work(client),
  }).deliver();
  assert.ok(
    !calls.some((call) =>
      call.sql.startsWith('INSERT INTO library_notifications'),
    ),
  );
  assert.ok(calls.some((call) => call.sql.includes("status='cancelled'")));
});
