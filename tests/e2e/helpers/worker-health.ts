import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import type { FeedbackSandbox } from './feedback-fixture';
import {
  WorkerHealthOverviewSchema,
  WorkerControlReceiptSchema,
  type WorkerId,
} from '../../../packages/contracts/src/index';
export {
  ownedRetentionDatabase as workerDatabase,
  loginRetentionOperator as loginWorkerOperator,
  retentionHeaders as workerHeaders,
} from './retention';
import { retentionHeaders } from './retention';
export const workerBase = '/api/v1/ops/workers';
export async function workerOverview(request: APIRequestContext) {
  const response = await request.get(workerBase);
  expect(response.status()).toBe(200);
  return WorkerHealthOverviewSchema.parse(await response.json());
}
export async function workerControl(
  request: APIRequestContext,
  worker: WorkerId,
  paused: boolean,
  expectedVersion: number,
  requestId: string = randomUUID(),
) {
  const response = await request.post(`${workerBase}/${worker}/control`, {
    headers: retentionHeaders,
    data: { requestId, expectedVersion, paused, confirm: true },
  });
  expect(response.status()).toBe(201);
  return WorkerControlReceiptSchema.parse(await response.json());
}
export async function startWorker(sandbox: FeedbackSandbox) {
  const child = fork(
    new URL('./worker-health-process.mjs', import.meta.url),
    [],
    { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [] },
  );
  const exit = new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.once('error', () => resolve());
  });
  const run = (action: string, extra: object = {}) =>
    new Promise<boolean>((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        cleanup();
        reject(Error('Owned worker operation timed out.'));
      }, 15000);
      const onMessage = (message: unknown) => {
        if (
          !message ||
          typeof message !== 'object' ||
          !('id' in message) ||
          message.id !== id
        )
          return;
        cleanup();
        if ('error' in message) reject(Error('Owned worker operation failed.'));
        else resolve('result' in message && !!message.result);
      };
      const onExit = () => {
        cleanup();
        reject(Error('Owned worker exited during operation.'));
      };
      function cleanup() {
        clearTimeout(timer);
        child.off('message', onMessage);
        child.off('exit', onExit);
        child.off('error', onExit);
      }
      child.on('message', onMessage);
      child.once('exit', onExit);
      child.once('error', onExit);
      child.send({ id, action, ...extra });
    });
  try {
    await run('start', {
      databaseUrl: sandbox.databaseUrl,
      schema: sandbox.schema,
    });
  } catch (error) {
    child.kill('SIGKILL');
    await exit;
    throw error;
  }
  return {
    run,
    async close() {
      try {
        if (child.connected) await run('close');
      } finally {
        if (child.connected) child.disconnect();
        const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
        await exit;
        clearTimeout(timer);
      }
    },
  };
}

export async function workerBlock(sandbox: FeedbackSandbox, reportId?: string) {
  const { createRequire } = await import('node:module');
  const { Pool } = createRequire(
    new URL('../../../apps/api/package.json', import.meta.url),
  )('pg') as {
    Pool: new (options: object) => {
      query(
        sql: string,
        values?: unknown[],
      ): Promise<{ rows: Record<string, unknown>[] }>;
      end(): Promise<void>;
    };
  };
  const url = new URL(sandbox.databaseUrl);
  if (
    !/^e2e_feedback_[a-f0-9]{32}$/.test(sandbox.schema) ||
    url.searchParams.get('options') !== `-c search_path=${sandbox.schema}`
  )
    throw Error('Unowned worker blocker.');
  const pool = new Pool({ connectionString: sandbox.databaseUrl, max: 1 });
  try {
    if (
      (await pool.query('SELECT current_schema() AS schema')).rows[0]
        ?.schema !== sandbox.schema
    )
      throw Error('Unowned worker blocker schema.');
    await pool.query('BEGIN');
    if (reportId)
      await pool.query(
        'SELECT id FROM record_report_jobs WHERE id=$1 FOR UPDATE',
        [reportId],
      );
    else
      await pool.query(
        "SELECT worker FROM worker_controls WHERE worker='reports' FOR SHARE",
      );
    const pid = Number(
      (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0]?.pid,
    );
    let released = false;
    return {
      pid,
      async expireLease(waiterPid: number) {
        if (!reportId || released)
          throw Error('No owned report blocker is active.');
        const result = await pool.query(
          "UPDATE record_report_jobs SET lease_until=(SELECT xact_start+interval '1 microsecond' FROM pg_stat_activity WHERE pid=$2) WHERE id=$1 RETURNING lease_until>=(SELECT xact_start FROM pg_stat_activity WHERE pid=$2) AND lease_until<clock_timestamp() AS expired_during_wait",
          [reportId, waiterPid],
        );
        if (result.rows[0]?.expired_during_wait !== true)
          throw Error(
            'Owned lease expiry did not occur during the observed wait.',
          );
      },
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
  } catch {
    await pool.query('ROLLBACK').catch(() => {});
    await pool.end();
    throw Error('Could not establish owned worker blocker.');
  }
}
