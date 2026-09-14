import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { AuditPageSchema } from '../../../packages/contracts/src/index';
import type { FeedbackSandbox } from './feedback-fixture';
import { operatorKey } from './operator';
import { ownedRetentionDatabase, type OwnedPool } from './retention';
export {
  ownedRetentionDatabase as auditDatabase,
  loginRetentionOperator as loginAuditOperator,
  retentionHeaders as auditHeaders,
} from './retention';
export const auditBase = '/api/v1/ops/audit';
export async function auditPage(request: APIRequestContext, query = '') {
  const response = await request.get(`${auditBase}${query ? `?${query}` : ''}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  return AuditPageSchema.parse(await response.json());
}
export async function seedAudit(sandbox: FeedbackSandbox, count = 115) {
  const pool = await ownedRetentionDatabase(sandbox);
  try {
    const rows = [];
    for (let index = 0; index < count; index++) {
      const id = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      const recordedAt = `2026-01-02T03:04:05.${String(100000 + Math.floor(index / 3)).padStart(6, '0')}Z`;
      // Explicit synthetic ledger rows stress real PG sorting and safe projection.
      await pool.query(
        'INSERT INTO operator_audit(id,actor_hash,action,target,recorded_at) VALUES($1,$2,$3,$4,$5)',
        [
          id,
          'synthetic-private-session-hash',
          index % 2 ? 'source.create.requested' : 'discovery.review.requested',
          'https://secret.invalid/?private=synthetic-financial-body',
          recordedAt,
        ],
      );
      rows.push({ id, recordedAt });
    }
    return rows.reverse();
  } finally {
    await pool.end();
  }
}
export async function signInAudit(page: Page) {
  await page.goto('/#today');
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()));
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Audit activity', exact: true })
    .click();
}
export async function auditBlock(
  sandbox: FeedbackSandbox,
  kind: 'audit' | 'revoke' | 'expire',
) {
  const verified = await ownedRetentionDatabase(sandbox);
  await verified.end();
  const { Pool } = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  )('pg') as { Pool: new (options: object) => OwnedPool };
  const pool = new Pool({ connectionString: sandbox.databaseUrl, max: 1 });
  try {
    await pool.query('BEGIN');
    if (kind === 'audit')
      await pool.query('LOCK TABLE operator_audit IN ACCESS EXCLUSIVE MODE');
    else if (kind === 'revoke')
      await pool.query('DELETE FROM operator_sessions');
    else
      await pool.query(
        "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 millisecond'",
      );
    const pid = (
      await pool.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    ).rows[0]!.pid;
    let released = false;
    return {
      pid,
      async release(commit = false) {
        if (released) return;
        released = true;
        try {
          await pool.query(commit ? 'COMMIT' : 'ROLLBACK');
        } finally {
          await pool.end();
        }
      },
    };
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    await pool.end();
    throw error;
  }
}
export async function waitAuditBlock(
  pool: OwnedPool,
  pid: number,
  query: 'operator_audit' | 'operator_sessions',
) {
  await expect
    .poll(
      async () => {
        await pool.query('SELECT pg_stat_clear_snapshot()');
        return (
          await pool.query<{ n: number }>(
            'SELECT count(*)::integer AS n FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid)) AND query LIKE $2',
            [pid, `%${query}%`],
          )
        ).rows[0]?.n;
      },
      { timeout: 3500 },
    )
    .toBe(1);
}
export const syntheticSource = () => ({
  name: `Synthetic audit metadata ${randomUUID()}`,
  category: 'Test only',
  sourceUrl: 'https://example.invalid/audit',
  termsUrl: 'https://example.invalid/terms',
  rightsStatus: 'unreviewed',
  constraints: 'Synthetic isolated metadata; no source access.',
  reviewEvidence: '',
  reviewedAt: null,
  published: false,
});
