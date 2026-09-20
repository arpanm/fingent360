import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResearchAutoStore } from '../dist/research-auto.js';

// Unit doubles cover rejection identity and cleanup. The E2E acceptance uses
// actual schema-isolated PostgreSQL/Mongo acquisition and advisory locking.
test('research tick preserves publication failure and releases its acquired lock', async () => {
  const failure = new Error('Synthetic publication rejected');
  const statements = [];
  let released = false;
  let publications = 0;
  const store = Object.create(ResearchAutoStore.prototype);
  Object.assign(store, {
    workerEnabled: true,
    initialize: async () => {},
    discovery: {
      refresh: async () => ({ id: 'synthetic-discovery', status: 'succeeded' }),
    },
    policies: {
      publish: async () => {
        publications++;
        throw failure;
      },
    },
    pool: {
      connect: async () => ({
        query: async (sql) => {
          statements.push(sql);
          if (sql.includes('pg_try_advisory_lock'))
            return { rows: [{ locked: true }] };
          if (sql.startsWith('SELECT source_id'))
            return { rows: [{ source_id: 'synthetic-unit-source' }] };
          return { rows: [] };
        },
        release: () => {
          released = true;
        },
      }),
    },
  });
  await assert.rejects(store.tick(), (error) => error === failure);
  assert.equal(publications, 1);
  assert.ok(
    statements.some((sql) =>
      sql.startsWith(
        "UPDATE research_auto_runs SET status='failed',finished_at=now(),message='Source or storage unavailable",
      ),
    ),
  );
  assert.ok(
    statements.some((sql) =>
      sql.startsWith("UPDATE research_auto_schedules SET last_status='failed'"),
    ),
  );
  assert.ok(
    !statements.some((sql) =>
      sql.startsWith("UPDATE research_auto_runs SET status='succeeded'"),
    ),
  );
  assert.equal(statements.at(-1), 'SELECT pg_advisory_unlock(360954)');
  assert.equal(released, true);
});

test('research tick does not classify unavailable PostgreSQL as lock contention', async () => {
  const failure = new Error('Synthetic PostgreSQL connection unavailable');
  const store = Object.create(ResearchAutoStore.prototype);
  let connects = 0;
  Object.assign(store, {
    workerEnabled: true,
    initialize: async () => {},
    pool: {
      connect: async () => {
        connects++;
        throw failure;
      },
    },
  });
  await assert.rejects(store.tick(), (error) => error === failure);
  assert.equal(connects, 1);
});
