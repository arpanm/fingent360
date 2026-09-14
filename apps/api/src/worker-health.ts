import { namedSessionCondition } from './named-operator-store.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Injectable,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  WorkerIdSchema,
  WorkerControlInputSchema,
  WorkerControlReceiptSchema,
  WorkerControlHistorySchema,
  WorkerControlHistoryQuerySchema,
  WorkerHealthOverviewSchema,
  workerFreshness,
  workerIds,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      'Invalid worker control request. Reload worker health and try again.',
    );
  return result.data;
}
function receipt(row: Record<string, unknown>) {
  return WorkerControlReceiptSchema.parse({
    requestId: row.request_id,
    worker: row.worker,
    version: row.version,
    paused: row.paused,
    recordedAt: (row.recorded_at as Date).toISOString(),
  });
}
const count = (total: number) => ({
  count: Math.min(total, 10000),
  moreAvailable: total > 10000,
});
@Injectable()
export class WorkerHealthStore {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  private async authorize(c: pg.PoolClient, actor: string) {
    await c.query(
      'SELECT token_hash FROM operator_sessions WHERE token_hash=$1 FOR SHARE',
      [actor],
    );
    const result = await c.query(
      `SELECT 1 FROM operator_sessions WHERE token_hash=$1 AND expires_at>clock_timestamp() AND ${namedSessionCondition}`,
      [actor],
    );
    if (!result.rowCount)
      throw new UnauthorizedException('Sign in to operations again.');
  }
  async overview(actor: string) {
    return this.account.transaction(async (c) => {
      await this.authorize(c, actor);
      const result = await c.query(
        'SELECT w.*,o.heartbeat_at,o.last_success_at,o.last_failure_at,o.failure_category FROM worker_controls w JOIN worker_observations o USING(worker) ORDER BY w.worker',
      );
      const observedAt = (
        await c.query('SELECT clock_timestamp() AS at')
      ).rows[0].at.toISOString() as string;
      const schedulesEnabled =
        (
          await c.query(
            "SELECT to_regclass(format('%I.report_schedules',current_schema())) IS NOT NULL AS enabled",
          )
        ).rows[0].enabled === true;
      const workers = [];
      for (const worker of workerIds) {
        const row = result.rows.find((r) => r.worker === worker);
        if (!row) throw Error('Worker state unavailable.');
        const report = worker === 'reports';
        // Predicates are a fixed allowlist. Each count inspects at most10,001 rows;
        // oldest age uses a separate indexed query and is not derived from the cap.
        const table = report ? 'record_report_jobs' : 'library_reminders';
        const queued = report ? "status='queued'" : "status='pending'";
        const due = report
          ? "attempts<3 AND ((status='queued' AND next_attempt_at<=$1) OR (status='running' AND lease_until<=$1))"
          : "status='pending' AND due_at<=$1";
        const total = async (where: string, timed = false) => {
          const value = await c.query(
            `SELECT count(*)::integer AS n FROM (SELECT 1 FROM ${table} WHERE ${where} LIMIT 10001) bounded`,
            timed ? [observedAt] : [],
          );
          return count(value.rows[0].n);
        };
        const queuedCount = await total(queued);
        const dueCount = await total(due, true);
        const activeLeases = report
          ? await total("status='running' AND lease_until>$1", true)
          : null;
        const expiredLeases = report
          ? await total("status='running' AND lease_until<=$1", true)
          : null;
        const age = await c.query(
          `SELECT greatest(0,floor(extract(epoch FROM $1::timestamptz-${report ? 'requested_at' : 'due_at'})))::double precision AS seconds FROM ${table} WHERE ${report ? "status IN ('queued','running')" : "status='pending'"} ORDER BY ${report ? 'requested_at' : 'due_at'} LIMIT 1`,
          [observedAt],
        );
        const dueSchedules =
          report && schedulesEnabled
            ? count(
                (
                  await c.query(
                    "SELECT count(*)::integer AS n FROM (SELECT 1 FROM report_schedules WHERE status='active' AND next_due_at<=$1 LIMIT 10001) bounded",
                    [observedAt],
                  )
                ).rows[0].n,
              )
            : null;
        const heartbeatAt = row.heartbeat_at?.toISOString() ?? null;
        workers.push({
          worker,
          version: row.version,
          paused: row.paused,
          changedAt: row.changed_at.toISOString(),
          heartbeatAt,
          freshness: workerFreshness(heartbeatAt, observedAt),
          lastSuccessAt: row.last_success_at?.toISOString() ?? null,
          lastFailureAt: row.last_failure_at?.toISOString() ?? null,
          failureCategory: row.failure_category,
          queued: queuedCount,
          due: dueCount,
          dueSchedules,
          activeLeases,
          expiredLeases,
          oldestOutstandingAgeSeconds: age.rows[0]?.seconds ?? null,
        });
      }
      return WorkerHealthOverviewSchema.parse({ observedAt, workers });
    });
  }
  async control(workerValue: unknown, body: unknown, actor: string) {
    const worker = parse(WorkerIdSchema, workerValue);
    const input = parse(WorkerControlInputSchema, body);
    return this.account.transaction(async (c) => {
      // One short shared control ledger serializes reused IDs across both workers.
      await c.query(
        'SELECT pg_advisory_xact_lock(hashtextextended(current_schema(),360030))',
      );
      const current = (
        await c.query(
          'SELECT * FROM worker_controls WHERE worker=$1 FOR UPDATE',
          [worker],
        )
      ).rows[0];
      await this.authorize(c, actor);
      if (!current) throw Error('Worker control unavailable.');
      const prior = (
        await c.query(
          'SELECT * FROM worker_control_receipts WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.worker !== worker ||
          prior.expected_version !== input.expectedVersion ||
          prior.paused !== input.paused
        )
          throw new ConflictException(
            'This request ID already records a different control.',
          );
        return receipt(prior);
      }
      if (current.version !== input.expectedVersion)
        throw new ConflictException(
          'Worker control changed. Reload before reviewing another action.',
        );
      if (current.paused === input.paused)
        throw new ConflictException(
          'Worker is already in that mode. Reload its current control.',
        );
      const changed = (
        await c.query(
          'UPDATE worker_controls SET paused=$2,version=version+1,changed_at=clock_timestamp() WHERE worker=$1 RETURNING *',
          [worker, input.paused],
        )
      ).rows[0];
      const saved = (
        await c.query(
          'INSERT INTO worker_control_receipts(request_id,worker,version,paused,actor_hash,expected_version,recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [
            input.requestId,
            worker,
            changed.version,
            input.paused,
            actor,
            input.expectedVersion,
            changed.changed_at,
          ],
        )
      ).rows[0];
      await c.query(
        'DELETE FROM worker_control_receipts WHERE worker=$1 AND version NOT IN (SELECT version FROM worker_control_receipts WHERE worker=$1 ORDER BY version DESC LIMIT 1000)',
        [worker],
      );
      return receipt(saved);
    });
  }
  async history(workerValue: unknown, queryValue: unknown, actor: string) {
    const worker = parse(WorkerIdSchema, workerValue);
    const before =
      parse(WorkerControlHistoryQuerySchema, queryValue).before ?? 2147483647;
    return this.account.transaction(async (c) => {
      await this.authorize(c, actor);
      const result = await c.query(
        'SELECT * FROM worker_control_receipts WHERE worker=$1 AND version<$2 ORDER BY version DESC LIMIT 101',
        [worker, before],
      );
      return WorkerControlHistorySchema.parse({
        receipts: result.rows.slice(0, 100).map(receipt),
        moreAvailable: result.rows.length > 100,
        retainedPerWorker: 1000,
      });
    });
  }
}
@OperatorRead()
@Controller('ops/workers')
export class WorkerHealthController {
  constructor(
    @Inject(WorkerHealthStore) private readonly store: WorkerHealthStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() async overview(@Headers('cookie') cookie?: string) {
    return this.store.overview(await this.ops.require(cookie));
  }
  @Get(':worker/history') async history(
    @Param('worker') worker: string,
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.history(worker, query, await this.ops.require(cookie));
  }
  @OperatorAction('administer')
  @Post(':worker/control')
  async control(
    @Param('worker') worker: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.store.control(worker, body, await this.ops.require(cookie));
  }
}
