import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import {
  FeedItemSchema,
  PublishingPageSchema,
  type FeedItem,
} from '../../../packages/contracts/src/index';
import type { FeedbackSandbox } from './feedback-fixture';
import { ownedRetentionDatabase, type OwnedPool } from './retention';
import { operatorKey } from './operator';
export {
  ownedRetentionDatabase as queueDatabase,
  loginRetentionOperator as loginQueueOperator,
  retentionHeaders as queueHeaders,
} from './retention';
export const queueBase = '/api/v1/ops/discovery/queue';
export async function queuePage(request: APIRequestContext, query = '') {
  const response = await request.get(`${queueBase}${query ? `?${query}` : ''}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  return PublishingPageSchema.parse(await response.json());
}
export async function seedQueue(
  sandbox: FeedbackSandbox,
  count = 45,
  source?: 'fed',
) {
  const pool = await ownedRetentionDatabase(sandbox);
  const entries = [];
  const prefixes = [
    'fed',
    'ecb-press',
    'ecb-statistics',
    'pib',
    'bea',
    'wb',
    'term',
    'misc',
  ];
  try {
    for (let index = 0; index < count; index++) {
      const prefix = source ?? prefixes[index % prefixes.length]!;
      const item = FeedItemSchema.parse({
        id: `${prefix}-queue-${String(index).padStart(3, '0')}`,
        version: 1,
        kind: prefix === 'term' ? 'term' : 'news',
        title: `Synthetic queue item ${String(index).padStart(3, '0')}${index === 3 ? ' literal %_' : ''}`,
        summary: 'Synthetic controlled queue fixture; no live provider claim.',
        body: 'Synthetic original body for actual isolated PostgreSQL review.',
        topics: [],
        publishedAt: '2026-01-01T00:00:00.000Z',
        effectiveLabel: 'Synthetic fixture date',
        source: {
          name: 'Synthetic queue source',
          url: 'https://example.invalid/queue',
          retrievedAt: '2026-01-02T00:00:00.000Z',
          rights: 'Synthetic fixture, not a rights approval',
        },
        sourceHash: null,
        importance: 1,
        relatedIds: [],
        status: ['draft', 'published', 'withdrawn'][index % 3],
        correctionNote: null,
        reviewedAt: null,
      });
      const changedAt = `2026-01-02T03:04:05.${String(100000 + Math.floor(index / 3)).padStart(6, '0')}Z`;
      await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
        item.id,
      ]);
      await pool.query(
        'INSERT INTO discovery_versions(item_id,version,data,created_at) VALUES($1,1,$2,$3)',
        [item.id, item, changedAt],
      );
      entries.push({ item, changedAt });
    }
    return entries.sort(
      (a, b) =>
        b.changedAt.localeCompare(a.changedAt) ||
        (a.item.id < b.item.id ? 1 : -1),
    );
  } finally {
    await pool.end();
  }
}
export async function queueDigests(pool: OwnedPool) {
  const result: Record<string, string[]> = {};
  for (const table of [
    'discovery_items',
    'discovery_versions',
    'discovery_runs',
    'discovery_source_runs',
    'app_goals',
    'app_goal_revisions',
    'app_holdings',
  ])
    result[table] = (
      await pool.query<{ digest: string }>(
        `SELECT md5(row_to_json(t)::text) AS digest FROM ${table} t ORDER BY 1`,
      )
    ).rows.map((r) => r.digest);
  return result;
}
export async function signInQueue(page: Page) {
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Publishing queue' }).getByRole('status'),
  ).toContainText('shown on page');
}
export async function reviewQueue(
  request: APIRequestContext,
  item: FeedItem,
  status: 'published' | 'withdrawn',
) {
  const response = await request.put(`/api/v1/ops/discovery/items/${item.id}`, {
    headers: { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' },
    data: {
      expectedVersion: item.version,
      status,
      correctionNote: 'Synthetic queue lifecycle acceptance.',
    },
  });
  expect(response.status()).toBe(200);
  return FeedItemSchema.parse(await response.json());
}
export async function queueBlock(
  sandbox: FeedbackSandbox,
  table: 'discovery_versions' | 'discovery_runs',
) {
  const verified = await ownedRetentionDatabase(sandbox);
  await verified.end();
  const { Pool } = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  )('pg') as {
    Pool: new (options: object) => OwnedPool;
  };
  const pool = new Pool({ connectionString: sandbox.databaseUrl, max: 1 });
  await pool.query('BEGIN');
  await pool.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
  const pid = (
    await pool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
  ).rows[0]!.pid;
  let released = false;
  return {
    pid,
    async release() {
      if (released) return;
      released = true;
      try {
        await pool.query('ROLLBACK');
      } finally {
        await pool.end();
      }
    },
  };
}
export async function waitQueueBlock(
  pool: OwnedPool,
  pid: number,
  table: string,
) {
  await expect
    .poll(
      async () => {
        await pool.query('SELECT pg_stat_clear_snapshot()');
        return (
          await pool.query<{ n: number }>(
            'SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid)) AND query LIKE $2',
            [pid, `%${table}%`],
          )
        ).rows[0]!.n;
      },
      { timeout: 3500 },
    )
    .toBe(1);
}
