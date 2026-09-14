import { namedSessionCondition } from './named-operator-store.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Post,
  Param,
  Query,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import pg from 'pg';
import { z } from 'zod';
import {
  RetentionPreviewInputSchema,
  RetentionExecuteInputSchema,
  RetentionRecordSchema,
  RetentionHistorySchema,
  RetentionHistoryQuerySchema,
  retentionScopes,
  retentionPolicy,
  type RetentionRecord,
  type RetentionCount,
} from '@fingent360/contracts';
import type { AppConfig } from './config.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';

export const RETENTION_STORE = Symbol('RETENTION_STORE');
// SQL identifiers/predicates are this fixed allowlist, never request fields.
const rules = [
  {
    table: 'app_sessions',
    key: 'token_hash',
    expiry: 'expires_at',
    where: 'expires_at <= $1::timestamptz',
  },
  {
    table: 'operator_sessions',
    key: 'token_hash',
    expiry: 'expires_at',
    where: 'expires_at <= $1::timestamptz',
  },
  {
    table: 'app_login_limits',
    key: 'username',
    expiry: 'reset_at',
    where: 'reset_at <= $1::timestamptz',
  },
  {
    table: 'operator_login_limits',
    key: 'client_hash',
    expiry: 'reset_at',
    where: 'reset_at <= $1::timestamptz',
  },
  {
    table: 'app_recovery_limits',
    key: 'key_hash',
    expiry: 'reset_at',
    where: 'reset_at <= $1::timestamptz',
  },
  {
    table: 'feedback_reports',
    key: 'id',
    expiry: 'expires_at',
    where: 'deleted_at IS NULL AND expires_at <= $1::timestamptz',
  },
  {
    table: 'feedback_rate_limits',
    key: 'bucket',
    expiry: 'window_start',
    where: "window_start < $1::timestamptz - interval '2 days'",
  },
  {
    table: 'app_holdings_previews',
    key: 'id',
    expiry: 'expires_at',
    where: 'confirmed_version IS NULL AND expires_at <= $1::timestamptz',
  },
] as const;
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      'Invalid cleanup request. Reload the saved preview and try again.',
    );
  return result.data;
}
const cursorSchema = z.strictObject({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

export class RetentionStore {
  private readonly pool: pg.Pool;
  constructor(config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 10000,
    });
    // pg emits an error on a checked-out client in addition to rejecting its query.
    // Keep the listener for that client's lifetime so a disconnected cleanup rolls
    // back and returns 503 instead of terminating the API. The pool evicts dead clients.
    this.pool.on('connect', (client) => {
      client.on('error', () => {});
    });
    this.pool.on('error', () => {});
  }
  async onApplicationShutdown() {
    await this.pool.end();
  }
  private async transaction<T>(work: (c: pg.PoolClient) => Promise<T>) {
    let c: pg.PoolClient | undefined;
    try {
      c = await this.pool.connect();
      await c.query('BEGIN');
      await c.query(
        'SELECT pg_advisory_xact_lock(hashtextextended(current_schema(),360022))',
      );
      const value = await work(c);
      await c.query('COMMIT');
      return value;
    } catch (error) {
      if (c) await c.query('ROLLBACK').catch(() => {});
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Cleanup storage is unavailable. Reload history or retry the same preview; no completed result has been confirmed.',
      );
    } finally {
      c?.release();
    }
  }
  private async authorize(c: pg.PoolClient, actor: string) {
    // Hold the admitted session until commit; a concurrent sign-out cannot
    // revoke it between this check and the authorized cleanup operation.
    const active = await c.query(
      `SELECT 1 FROM operator_sessions WHERE token_hash=$1 AND expires_at>clock_timestamp() AND ${namedSessionCondition} FOR SHARE`,
      [actor],
    );
    if (!active.rowCount)
      throw new UnauthorizedException('Sign in to operations again.');
  }
  private async audit(
    c: pg.PoolClient,
    actor: string,
    action: string,
    id: string,
  ) {
    await c.query(
      'INSERT INTO operator_audit(id,actor_hash,action,target) VALUES($1,$2,$3,$4)',
      [randomUUID(), actor, action, id],
    );
  }
  private async counts(
    c: pg.PoolClient,
    cutoff: string,
  ): Promise<RetentionCount[]> {
    // One statement observes every count in the same snapshot after admission.
    // Using READ COMMITTED for the transaction also lets a waiting duplicate
    // request see the first operator's committed preview/result.
    const query = rules
      .map(
        (rule, index) =>
          `SELECT ${index} AS ordinal,count(*)::integer AS count FROM (SELECT 1 FROM ${rule.table} WHERE ${rule.where} LIMIT ${retentionScopes[index]!.limit + 1}) eligible`,
      )
      .join(' UNION ALL ');
    const result = await c.query<{ ordinal: number; count: number }>(
      `${query} ORDER BY ordinal`,
      [cutoff],
    );
    return result.rows.map((row) => {
      const scope = retentionScopes[row.ordinal]!;
      return {
        scope: scope.id,
        count: Math.min(row.count, scope.limit),
        moreAvailable: row.count > scope.limit,
      };
    });
  }
  async preview(raw: unknown, actor: string) {
    const { requestId } = parse(RetentionPreviewInputSchema, raw);
    return this.transaction(async (c) => {
      await this.authorize(c, actor);
      const previous = await c.query<{ payload: unknown }>(
        'SELECT payload FROM retention_runs WHERE id=$1',
        [requestId],
      );
      if (previous.rows[0])
        return RetentionRecordSchema.parse(previous.rows[0].payload);
      const time = (
        await c.query<{ now: Date }>('SELECT clock_timestamp() AS now')
      ).rows[0]!.now.toISOString();
      const record = RetentionRecordSchema.parse({
        id: requestId,
        policyVersion: retentionPolicy,
        createdAt: time,
        cutoffAt: time,
        status: 'ready',
        attempts: 0,
        lastAttemptAt: null,
        completedAt: null,
        preview: await this.counts(c, time),
        result: null,
      });
      await c.query(
        'INSERT INTO retention_runs(id,created_at,payload) VALUES($1,$2,$3)',
        [record.id, record.createdAt, JSON.stringify(record)],
      );
      await this.audit(c, actor, 'retention-preview', record.id);
      return record;
    });
  }
  async execute(id: string, raw: unknown, actor: string) {
    parse(z.uuid(), id);
    parse(RetentionExecuteInputSchema, raw);
    return this.transaction(async (c) => {
      await this.authorize(c, actor);
      const found = await c.query<{ payload: unknown }>(
        'SELECT payload FROM retention_runs WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!found.rows[0])
        throw new NotFoundException(
          'Cleanup preview not found. Create a new preview.',
        );
      const before = RetentionRecordSchema.parse(found.rows[0].payload);
      if (before.status === 'completed') return before;
      const attempted = (
        await c.query<{ now: Date }>('SELECT clock_timestamp() AS now')
      ).rows[0]!.now.toISOString();
      await c.query('SAVEPOINT cleanup_batch');
      let record: RetentionRecord;
      try {
        const counts: RetentionCount[] = [];
        for (const [index, rule] of rules.entries()) {
          const scope = retentionScopes[index]!;
          const candidate = `WITH eligible AS (SELECT ${rule.key} FROM ${rule.table} WHERE ${rule.where} ORDER BY ${rule.expiry},${rule.key} LIMIT $2 FOR UPDATE)`;
          const sql =
            scope.action === 'scrub'
              ? `${candidate} UPDATE ${rule.table} target SET deleted_at=clock_timestamp(),updated_at=clock_timestamp(),text=NULL,context=NULL,image_meta=NULL,image_bytes=NULL,audio_meta=NULL,audio_bytes=NULL FROM eligible WHERE target.${rule.key}=eligible.${rule.key} AND ${rule.where} RETURNING 1`
              : `${candidate} DELETE FROM ${rule.table} target USING eligible WHERE target.${rule.key}=eligible.${rule.key} AND ${rule.where} RETURNING 1`;
          const changed = await c.query(sql, [before.cutoffAt, scope.limit]);
          const remaining = await c.query<{ more: boolean }>(
            `SELECT EXISTS(SELECT 1 FROM ${rule.table} WHERE ${rule.where}) AS more`,
            [before.cutoffAt],
          );
          counts.push({
            scope: scope.id,
            count: changed.rowCount ?? 0,
            moreAvailable: remaining.rows[0]!.more,
          });
        }
        const finished = (
          await c.query<{ now: Date }>('SELECT clock_timestamp() AS now')
        ).rows[0]!.now.toISOString();
        record = RetentionRecordSchema.parse({
          ...before,
          status: 'completed',
          attempts: before.attempts + 1,
          lastAttemptAt: attempted,
          completedAt: finished,
          result: counts,
        });
        await c.query('UPDATE retention_runs SET payload=$2 WHERE id=$1', [
          id,
          JSON.stringify(record),
        ]);
        await this.audit(c, actor, 'retention-completed', id);
      } catch {
        // Every category and a failed result/audit attempt roll back together.
        // Store only this generic failure state, never driver text or row data.
        await c.query('ROLLBACK TO SAVEPOINT cleanup_batch');
        record = RetentionRecordSchema.parse({
          ...before,
          status: 'failed',
          attempts: before.attempts + 1,
          lastAttemptAt: attempted,
          completedAt: null,
          result: null,
        });
        await c.query('UPDATE retention_runs SET payload=$2 WHERE id=$1', [
          id,
          JSON.stringify(record),
        ]);
        await this.audit(c, actor, 'retention-failed', id);
      }
      await c.query('RELEASE SAVEPOINT cleanup_batch');
      return record;
    });
  }
  async get(id: string) {
    parse(z.uuid(), id);
    return this.transaction(async (c) => {
      const found = await c.query<{ payload: unknown }>(
        'SELECT payload FROM retention_runs WHERE id=$1',
        [id],
      );
      if (!found.rows[0])
        throw new NotFoundException('Cleanup record not found.');
      return RetentionRecordSchema.parse(found.rows[0].payload);
    });
  }
  async history(raw: unknown) {
    const query = parse(RetentionHistoryQuerySchema, raw);
    let cursor: z.infer<typeof cursorSchema> | undefined;
    if (query.cursor) {
      try {
        cursor = parse(
          cursorSchema,
          JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')),
        );
      } catch {
        throw new BadRequestException(
          'Invalid cleanup history cursor. Reload the latest records.',
        );
      }
    }
    return this.transaction(async (c) => {
      const found = await c.query<{ payload: unknown }>(
        'SELECT payload FROM retention_runs WHERE ($1::timestamptz IS NULL OR (created_at,id)<($1,$2::uuid)) ORDER BY created_at DESC,id DESC LIMIT 21',
        [cursor?.createdAt ?? null, cursor?.id ?? null],
      );
      const records = found.rows
        .slice(0, 20)
        .map((row) => RetentionRecordSchema.parse(row.payload));
      const last = records.at(-1);
      return RetentionHistorySchema.parse({
        records,
        nextCursor:
          found.rows.length > 20 && last
            ? Buffer.from(
                JSON.stringify({ createdAt: last.createdAt, id: last.id }),
              ).toString('base64url')
            : null,
      });
    });
  }
}
@OperatorRead()
@Controller('ops/retention')
export class RetentionController {
  constructor(
    @Inject(RETENTION_STORE) private readonly store: RetentionStore,
    @Inject(OPERATOR_STORE) private readonly operator: OperatorStore,
  ) {}
  @Get('runs') async history(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    await this.operator.require(cookie);
    return this.store.history(query);
  }
  @Get('runs/:id') async get(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.operator.require(cookie);
    return this.store.get(id);
  }
  @OperatorAction('administer')
  @Post('previews')
  async preview(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.operator.origin(origin);
    return this.store.preview(body, await this.operator.require(cookie));
  }
  @OperatorAction('administer')
  @Post('runs/:id/execute')
  async execute(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.operator.origin(origin);
    return this.store.execute(id, body, await this.operator.require(cookie));
  }
}
export const retentionProvider = (config: AppConfig) => ({
  provide: RETENTION_STORE,
  useFactory: () => new RetentionStore(config),
});
