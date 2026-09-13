import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import { operatorKey } from './operator';
import {
  CurrentAccountSchema,
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  RetentionRecordSchema,
} from '../../../packages/contracts/src/index';

export const retentionHeaders = {
  Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
};
export const retentionCsv =
  'isin,quantity,total_cost_paise\nINE002A01018,1.000001,9007199254740993';
export interface OwnedPool {
  query<T = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  end(): Promise<void>;
}
export async function ownedRetentionDatabase(
  sandbox: FeedbackSandbox,
): Promise<OwnedPool> {
  const url = new URL(sandbox.databaseUrl);
  if (
    !/^e2e_feedback_[a-f0-9]{32}$/.test(sandbox.schema) ||
    url.searchParams.get('options') !== `-c search_path=${sandbox.schema}` ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    throw Error('Retention fixtures require the exact owned loopback schema.');
  // Loaded only by selected tests; there is no import/discovery side effect.
  const { Pool } = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  )('pg') as {
    Pool: new (options: { connectionString: string; max: number }) => OwnedPool;
  };
  const pool = new Pool({ connectionString: sandbox.databaseUrl, max: 2 });
  try {
    const result = await pool.query<{ isolated: boolean }>(
      'SELECT current_schema()=$1 AS isolated',
      [sandbox.schema],
    );
    if (!result.rows[0]?.isolated)
      throw Error('Retention schema ownership check failed.');
    return pool;
  } catch {
    await pool.end();
    throw Error('Could not open the owned retention fixture schema.');
  }
}
export async function loginRetentionOperator(request: APIRequestContext) {
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: retentionHeaders,
        data: {
          key: process.env.RESEARCH_ADMIN_TOKEN ?? (await operatorKey()),
        },
      })
    ).status(),
  ).toBe(200);
}
export async function retentionPreview(
  request: APIRequestContext,
  requestId: string = randomUUID(),
) {
  const response = await request.post('/api/v1/ops/retention/previews', {
    headers: retentionHeaders,
    data: { requestId },
  });
  expect(response.status()).toBe(201);
  return RetentionRecordSchema.parse(await response.json());
}
export async function retentionExecute(request: APIRequestContext, id: string) {
  const response = await request.post(
    `/api/v1/ops/retention/runs/${id}/execute`,
    { headers: retentionHeaders, data: { confirm: true } },
  );
  expect(response.status()).toBe(201);
  return RetentionRecordSchema.parse(await response.json());
}
export async function seedRetentionRows(
  request: APIRequestContext,
  pool: OwnedPool,
) {
  // Account, holdings and feedback are accepted by the actual isolated API.
  // Aged sessions/counters, expiry times and dummy bytes are synthetic SQL fixtures.
  const username = `retention_${randomUUID().slice(0, 12)}`;
  const password = 'Synthetic-retention-password-2026';
  const registered = await request.post('/api/v1/account/register', {
    headers: retentionHeaders,
    data: { username, password, consent: true },
  });
  expect(registered.status()).toBe(201);
  const userId = CurrentAccountSchema.parse(await registered.json()).user!.id;
  await request.put('/api/v1/account/watchlist', {
    headers: retentionHeaders,
    data: { indicators: ['NY.GDP.MKTP.KD.ZG'] },
  });
  const holdingPreview = async (version: number) =>
    HoldingsPreviewSchema.parse(
      await (
        await request.post('/api/v1/account/holdings/preview', {
          headers: retentionHeaders,
          data: {
            csv: retentionCsv,
            expectedVersion: version,
            storageConsent: true,
          },
        })
      ).json(),
    );
  const confirmed = await holdingPreview(0);
  const confirmation = { previewId: confirmed.previewId, expectedVersion: 0 };
  const snapshot = HoldingsSnapshotSchema.parse(
    await (
      await request.post('/api/v1/account/holdings/confirm', {
        headers: retentionHeaders,
        data: confirmation,
      })
    ).json(),
  );
  const expiredPreview = await holdingPreview(1);
  const freshPreview = await holdingPreview(1);
  const feedbackBody = (text: string) => ({
    id: randomUUID(),
    receiptToken: createHash('sha256').update(randomUUID()).digest('hex'),
    text,
    image: null,
    audio: null,
    consent: true,
    context: {
      screen: 'retention-fixture',
      runtime: 'web',
      appVersion: 'synthetic-retention-test',
      viewport: { width: 390, height: 844 },
      capturedAt: new Date().toISOString(),
    },
  });
  const expiredFeedback = feedbackBody('Synthetic expired private feedback');
  const freshFeedback = feedbackBody('Synthetic fresh private feedback');
  for (const body of [expiredFeedback, freshFeedback])
    expect(
      (
        await request.post('/api/v1/feedback', {
          headers: retentionHeaders,
          data: body,
        })
      ).status(),
    ).toBe(201);
  const expired = createHash('sha256').update(randomUUID()).digest('hex');
  const fresh = createHash('sha256').update(randomUUID()).digest('hex');
  for (const [key, interval] of [
    [expired, '-1 day'],
    [fresh, '1 day'],
  ] as const) {
    await pool.query(
      `INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+$3::interval)`,
      [key, userId, interval],
    );
    await pool.query(
      'INSERT INTO operator_sessions(token_hash,expires_at) VALUES($1,now()+$2::interval)',
      [key, interval],
    );
    await pool.query(
      'INSERT INTO app_login_limits(username,attempts,reset_at) VALUES($1,1,now()+$2::interval)',
      [key, interval],
    );
    await pool.query(
      'INSERT INTO operator_login_limits(client_hash,attempts,reset_at) VALUES($1,1,now()+$2::interval)',
      [key, interval],
    );
    await pool.query(
      'INSERT INTO app_recovery_limits(key_hash,attempts,reset_at) VALUES($1,1,now()+$2::interval)',
      [key, interval],
    );
    await pool.query(
      'INSERT INTO feedback_rate_limits(bucket,count,window_start) VALUES($1,1,now()+$2::interval)',
      [key, key === expired ? '-3 days' : '-1 day'],
    );
  }
  await pool.query(
    "UPDATE app_holdings_previews SET expires_at=now()-interval '1 day' WHERE id=ANY($1::uuid[])",
    [[confirmed.previewId, expiredPreview.previewId]],
  );
  await pool.query(
    "UPDATE feedback_reports SET expires_at=now()-interval '1 day',image_meta=$2,image_bytes=$3,audio_meta=$2,audio_bytes=$3 WHERE id=$1",
    [
      expiredFeedback.id,
      JSON.stringify({ syntheticFixture: true }),
      Buffer.from('Synthetic private attachment fixture'),
    ],
  );
  return {
    username,
    userId,
    expired,
    fresh,
    confirmed,
    confirmation,
    snapshot,
    expiredPreview,
    freshPreview,
    expiredFeedback,
    freshFeedback,
  };
}

export async function retainedRowDigests(pool: OwnedPool) {
  // Digests prove retention boundaries without putting private fields in output.
  const tables = [
    'app_users',
    'app_watchlists',
    'app_holdings',
    'app_holdings_revisions',
    'app_goal_revisions',
    'app_account_recovery',
    'feedback_audit',
    'record_report_jobs',
    'record_reports',
    'security_identities',
    'security_identity_revisions',
    'security_refresh_runs',
    'security_provider_pacing',
    'research_sources',
    'research_source_revisions',
    'discovery_items',
    'discovery_versions',
    'discovery_runs',
    'macro_runs',
    'macro_observations',
  ];
  const values: Record<string, string[]> = {};
  for (const table of tables) {
    const result = await pool.query<{ digest: string }>(
      `SELECT md5(row_to_json(t)::text) AS digest FROM ${table} t ORDER BY 1`,
    );
    values[table] = result.rows.map((row) => row.digest);
  }
  return values;
}
