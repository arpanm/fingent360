import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  expect,
  type APIRequestContext,
  type APIResponse,
} from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  CurrentAccountSchema,
  RecoveryCreatedSchema,
} from '../../../packages/contracts/src/index';

export const authHeaders = {
  Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
};
export const authPassword = 'Synthetic-auth-wait-password-2026';
export const recoveredPassword = 'Synthetic-auth-wait-recovered-2026';
export const authGoal = {
  name: 'Synthetic authorization goal',
  type: 'education',
  targetMinor: '100000',
  savedMinor: '10001',
  monthlyMinor: '25002',
  horizonMonths: 3,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
};
export const authImport = {
  csv: 'isin,quantity,total_cost_paise\nINE002A01018,3.000001,10001',
  expectedVersion: 0,
  storageConsent: true,
};

type Rows = { rows: Record<string, unknown>[] };
type Client = {
  query(sql: string, values?: unknown[]): Promise<Rows>;
  release(): void;
};
type Pool = {
  query: Client['query'];
  connect(): Promise<Client>;
  end(): Promise<void>;
  on(event: 'error', fn: () => void): void;
};
export type OwnedAuthDatabase = Awaited<ReturnType<typeof openAuthDatabase>>;
type AuthResponse = Pick<APIResponse, 'status' | 'json' | 'body'>;
type BlockKind = 'account' | 'report' | 'preview' | 'goal' | 'advisory';

// Resolve pnpm's API dependency only when a test runs; discovery opens no database.
export async function openAuthDatabase(sandbox: FeedbackSandbox) {
  if (!/^e2e_feedback_[a-f0-9]+$/.test(sandbox.schema))
    throw Error('Authorization tests require an owned isolated schema.');
  const pg = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  )('pg') as {
    Pool: new (options: {
      connectionString: string;
      max: number;
      connectionTimeoutMillis: number;
      statement_timeout: number;
    }) => Pool;
  };
  const pool = new pg.Pool({
    connectionString: sandbox.databaseUrl,
    max: 4,
    connectionTimeoutMillis: 3000,
    statement_timeout: 4000,
  });
  pool.on('error', () => {
    /* Do not expose connection strings in artifacts. */
  });
  const query = async (sql: string, values?: unknown[]) => {
    try {
      return await pool.query(sql, values);
    } catch {
      throw Error('Owned authorization fixture database operation failed.');
    }
  };
  try {
    const current = await query('SELECT current_schema() AS schema');
    if (current.rows[0]?.schema !== sandbox.schema)
      throw Error('Authorization fixture schema mismatch.');
  } catch (error) {
    await pool.end();
    throw error;
  }
  return {
    query,
    close: () => pool.end(),
    async block(kind: BlockKind, id: string) {
      let client: Client;
      try {
        client = await pool.connect();
      } catch {
        throw Error('Could not acquire owned authorization blocker.');
      }
      try {
        await client.query('BEGIN');
        const row = await client.query(
          {
            account: 'SELECT id FROM app_users WHERE id=$1 FOR UPDATE',
            report: 'SELECT id FROM record_report_jobs WHERE id=$1 FOR UPDATE',
            preview:
              'SELECT id FROM app_holdings_previews WHERE id=$1 FOR UPDATE',
            goal: 'SELECT id FROM app_goals WHERE id=$1 FOR UPDATE',
            advisory: 'SELECT pg_advisory_xact_lock(hashtext($1))',
          }[kind],
          [id],
        );
        if (row.rows.length !== 1) throw Error('Missing owned blocker row.');
        const result = await client.query('SELECT pg_backend_pid() AS pid');
        const pid = Number(result.rows[0]?.pid);
        let released = false;
        return {
          pid,
          async release() {
            if (released) return;
            released = true;
            try {
              await client.query('ROLLBACK');
            } catch {
              throw Error('Could not release an owned authorization blocker.');
            } finally {
              client.release();
            }
          },
        };
      } catch {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
        throw Error('Could not establish owned authorization row blocker.');
      }
    },
    async waitFor(blockers: number[], reset: boolean) {
      let pid = 0;
      await expect
        .poll(
          async () => {
            const result = await query(
              `SELECT a.pid FROM pg_stat_activity a WHERE a.datname=current_database()
           AND a.wait_event_type='Lock' AND pg_blocking_pids(a.pid) && $1::integer[]
           AND a.query LIKE $2 ORDER BY a.query_start LIMIT 1`,
              [
                blockers,
                reset
                  ? 'SELECT * FROM app_users WHERE username_lookup=$2 OR username=$1 FOR UPDATE%'
                  : 'SELECT%',
              ],
            );
            // In non-reset waits exclude the observed reset PID at the caller by
            // passing it as a blocker, rather than its own upstream blocker alone.
            pid = Number(
              result.rows.find((row) => !blockers.includes(Number(row.pid)))
                ?.pid ?? 0,
            );
            return pid;
          },
          {
            timeout: 2500,
            intervals: [20, 40, 80],
            message: reset
              ? 'Actual recovery reset must be waiting on the owned account row.'
              : 'Actual private request must be waiting behind recovery or the owned report row.',
          },
        )
        .toBeGreaterThan(0);
      return pid;
    },
    async privateDigest(userId: string) {
      const result = await query(
        `SELECT jsonb_build_object(
        'holdings', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.user_id),'[]') FROM app_holdings t WHERE user_id=$1),
        'holdingsRevisions', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.version),'[]') FROM app_holdings_revisions t WHERE user_id=$1),
        'previews', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM app_holdings_previews t WHERE user_id=$1),
        'goals', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM app_goals t WHERE user_id=$1),
        'goalRevisions', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.goal_id,t.version),'[]') FROM app_goal_revisions t JOIN app_goals g ON g.id=t.goal_id WHERE g.user_id=$1),
        'allocations', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.user_id),'[]') FROM app_goal_allocations t WHERE user_id=$1),
        'allocationRevisions', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.version),'[]') FROM app_goal_allocation_revisions t WHERE user_id=$1),
        'jobs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM record_report_jobs t WHERE user_id=$1),
        'reports', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.job_id),'[]') FROM record_reports t JOIN record_report_jobs j ON j.id=t.job_id WHERE j.user_id=$1),
        'deletions', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]') FROM record_report_deletions t WHERE user_id=$1),
        'reportLimits', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.user_id),'[]') FROM record_report_request_limits t WHERE user_id=$1)
      ) AS state`,
        [userId],
      );
      return createHash('sha256')
        .update(JSON.stringify(result.rows[0]?.state))
        .digest('hex');
    },
  };
}

export async function registerRecoverable(request: APIRequestContext) {
  const username = `auth_${randomUUID().slice(0, 16)}`;
  const registration = await request.post('/api/v1/account/register', {
    headers: authHeaders,
    data: { username, password: authPassword, consent: true },
  });
  expect(registration.status()).toBe(201);
  const user = CurrentAccountSchema.parse(await registration.json()).user;
  if (!user) throw Error('Owned authorization account was not created.');
  const response = await request.post('/api/v1/account/recovery/code', {
    headers: authHeaders,
    data: { currentPassword: authPassword, confirm: true },
  });
  expect(response.status()).toBe(201);
  const recovery = RecoveryCreatedSchema.parse(await response.json());
  return { id: user.id, username, code: recovery.code };
}

export async function resetAheadOfOperation(options: {
  db: OwnedAuthDatabase;
  owner: Awaited<ReturnType<typeof registerRecoverable>>;
  resetRequest: APIRequestContext;
  operation: () => Promise<AuthResponse>;
  reportId?: string;
}) {
  const { db, owner, resetRequest, operation } = options;
  const accountBlocker = await db.block('account', owner.id);
  let reportBlocker:
    Awaited<ReturnType<OwnedAuthDatabase['block']>> | undefined;
  const pending: Promise<AuthResponse>[] = [];
  // Attach rejection handlers at creation, but keep original promises for asserts.
  const track = (promise: Promise<AuthResponse>) => {
    pending.push(promise);
    void promise.catch(() => {});
    return promise;
  };
  let cleanupFailed: boolean;
  try {
    if (options.reportId)
      reportBlocker = await db.block('report', options.reportId);
    const reset = track(
      resetRequest.post('/api/v1/account/recovery/reset', {
        headers: authHeaders,
        data: {
          username: owner.username,
          code: owner.code,
          newPassword: recoveredPassword,
        },
        timeout: 10000,
      }),
    );
    const resetPid = await db.waitFor([accountBlocker.pid], true);
    const stale = track(operation());
    await db.waitFor(
      [resetPid, ...(reportBlocker ? [reportBlocker.pid] : [])],
      false,
    );
    await accountBlocker.release();
    expect((await reset).status()).toBe(200);
    // A job waiter cannot authorize itself after reset simply because its job
    // becomes available. With the fix it fails at the account recheck first.
    await reportBlocker?.release();
    const response = await stale;
    expect(response.status()).toBe(401);
    const payload = await response.json();
    expect(payload.statusCode).toBe(401);
    expect(payload.message).toBe('Sign in to access your account.');
  } finally {
    const released = await Promise.allSettled([
      accountBlocker.release(),
      ...(reportBlocker ? [reportBlocker.release()] : []),
    ]);
    await Promise.allSettled(
      pending.map(async (promise) => {
        const response = await promise;
        await response.body();
      }),
    );
    cleanupFailed = released.some((result) => result.status === 'rejected');
  }
  if (cleanupFailed) throw Error('Owned authorization blocker cleanup failed.');
}

export async function expireDuringWait(options: {
  db: OwnedAuthDatabase;
  userId: string;
  kind: BlockKind;
  id: string;
  operation: () => Promise<AuthResponse>;
}) {
  const blocker = await options.db.block(options.kind, options.id);
  let pending: Promise<AuthResponse> | undefined;
  let cleanupFailed: boolean;
  try {
    pending = options.operation();
    void pending.catch(() => {});
    const pid = await options.db.waitFor([blocker.pid], false);
    const expiry = await options.db.query(
      `UPDATE app_sessions SET expires_at=(SELECT xact_start+interval '1 microsecond' FROM pg_stat_activity WHERE pid=$2)
      WHERE user_id=$1 RETURNING expires_at>(SELECT xact_start FROM pg_stat_activity WHERE pid=$2)
      AND expires_at<clock_timestamp() AS expired_after_start`,
      [options.userId, pid],
    );
    expect(expiry.rows.length).toBe(1);
    expect(expiry.rows[0]?.expired_after_start).toBe(true);
    await blocker.release();
    expect((await pending).status()).toBe(401);
  } finally {
    const released = await Promise.allSettled([blocker.release()]);
    if (pending)
      await Promise.allSettled([pending.then((response) => response.body())]);
    cleanupFailed = released.some((result) => result.status === 'rejected');
  }
  if (cleanupFailed) throw Error('Owned expiry blocker cleanup failed.');
}

export async function signInRecovered(
  request: APIRequestContext,
  username: string,
) {
  expect(
    (
      await request.post('/api/v1/account/login', {
        headers: authHeaders,
        data: { username, password: recoveredPassword },
      })
    ).status(),
  ).toBe(200);
}
