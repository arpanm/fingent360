import { consolidationBlocksDailyWindow } from './equity-consolidation.js';
import { canonicalSourceJson } from './canonical-source-json.js';
import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdjustmentWindowInputSchema,
  AdjustmentReviewSchema,
  AdjustmentWindowSchema,
  AdjustmentPublicSchema,
  AdjustmentQueueSchema,
  buildAdjustmentWindow,
  adjustmentBindings,
  EquityCompanySchema,
} from '@fingent360/contracts';
import type pg from 'pg';
import type { AppConfig } from './config.js';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { equityCompanyForTrace } from './equity-coverage.js';
type EquityCompany = ReturnType<typeof EquityCompanySchema.parse>;
const digest = (value: unknown) =>
  createHash('sha256').update(canonicalSourceJson(value)).digest('hex');
const RAW = Symbol('ADJUSTMENT_RAW');
class AdjustmentRaw {
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await this.mongo.close();
  }
  async retain(value: unknown) {
    const hash = digest(value);
    await this.mongo
      .db()
      .collection<{ _id: string; value: unknown }>('equity_adjustment_raw')
      .updateOne({ _id: hash }, { $setOnInsert: { value } }, { upsert: true });
    return hash;
  }
  async read(hash: string) {
    const row = await this.mongo
      .db()
      .collection<{ _id: string; value: unknown }>('equity_adjustment_raw')
      .findOne({ _id: hash });
    if (!row || digest(row.value) !== hash)
      throw new ConflictException(
        'Adjustment source capture is unavailable or changed.',
      );
    return row.value;
  }
}
export const equityAdjustmentProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new AdjustmentRaw(config),
});
async function readmittedWindows(c: pg.PoolClient, company: EquityCompany) {
  await c.query('LOCK TABLE equity_adjustment_reviews IN SHARE MODE');
  const rows = await c.query(
    "SELECT w.receipt,r.created_at FROM equity_adjustment_windows w JOIN LATERAL(SELECT payload,created_at FROM equity_adjustment_reviews WHERE window_id=w.id ORDER BY seq DESC LIMIT 1)r ON true WHERE w.isin=$1 AND r.payload->>'decision'='publish' ORDER BY w.created_at DESC,w.id LIMIT 101",
    [company.isin],
  );
  if (rows.rows.length > 100)
    throw new ConflictException(
      'Adjustment window history exceeds snapshot scope.',
    );
  const bindings = digest(adjustmentBindings(company));
  return rows.rows.flatMap((row) => {
    const receipt = AdjustmentWindowSchema.parse({
      ...row.receipt,
      reviewedAt: row.created_at.toISOString(),
    });
    return digest(receipt.retainedBindings) === bindings ? [receipt] : [];
  });
}
export async function admitAdjustmentCoverage(
  c: pg.PoolClient,
  company: EquityCompany,
  start: string,
  end: string,
) {
  await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
  const current = await equityCompanyForTrace(c, company.isin);
  if (
    digest(adjustmentBindings(current)) !== digest(adjustmentBindings(company))
  )
    return null;
  if (await consolidationBlocksDailyWindow(c, company.isin, start, end))
    return null;
  const windows = await readmittedWindows(c, current);
  return (
    windows.find(
      (window) => window.windowStart <= start && window.windowEnd >= end,
    ) ?? null
  );
}
@Controller('equity-adjustments')
export class EquityAdjustmentsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get(':isin') async list(@Param('isin') isin: string) {
    if (!/^IN[A-Z0-9]{9}[0-9]$/.test(isin))
      throw new BadRequestException('Invalid company.');
    return this.store.transaction(async (c) => {
      await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
      const company = await equityCompanyForTrace(c, isin);
      return AdjustmentPublicSchema.parse({
        windows: await readmittedWindows(c, company),
        capturedAt: new Date().toISOString(),
      });
    });
  }
}
@OperatorRead()
@Controller('ops/equity-adjustments')
export class EquityAdjustmentOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: AdjustmentRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const identity = await this.ops.permission(cookie, permission, c);
    return typeof identity === 'string' ? identity : identity.identity.id;
  }
  @Get() async queue(@Headers('cookie') cookie?: string) {
    await this.actor(cookie, 'read');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        "SELECT w.receipt,COALESCE((SELECT payload->>'decision' FROM equity_adjustment_reviews WHERE window_id=w.id ORDER BY seq DESC LIMIT 1),'draft') AS state FROM equity_adjustment_windows w ORDER BY w.created_at DESC,w.id LIMIT 100",
      );
      await this.actor(cookie, 'read', c);
      return AdjustmentQueueSchema.parse(rows.rows);
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.actor(cookie, 'read');
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new BadRequestException('Invalid window.');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        'SELECT receipt FROM equity_adjustment_windows WHERE id=$1',
        [id],
      );
      if (!rows.rows[0]) throw new NotFoundException('Window unavailable.');
      const value = await this.raw.read(rows.rows[0].receipt.sourceHash);
      await this.actor(cookie, 'read', c);
      return value;
    });
  }
  @Post('prepare') @OperatorAction('prepare') async prepare(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = AdjustmentWindowInputSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Complete the source window, coverage and permission evidence.',
      );
    const input = parsed.data;
    await this.actor(cookie, 'prepare');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const actor = await this.actor(cookie, 'prepare', c);
      const previous = await c.query(
        'SELECT fingerprint FROM equity_adjustment_windows WHERE id=$1',
        [input.requestId],
      );
      if (previous.rows[0]) {
        if (previous.rows[0].fingerprint !== digest(input))
          throw new ConflictException('Window request ID already used.');
        return { id: input.requestId };
      }
      await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
      const company = await equityCompanyForTrace(c, input.isin);
      const hash = await this.raw.retain(input);
      let receipt;
      try {
        receipt = buildAdjustmentWindow(
          input,
          company,
          hash,
          new Date().toISOString(),
        );
      } catch (cause) {
        throw new BadRequestException(
          cause instanceof Error
            ? cause.message
            : 'Unsupported adjustment evidence.',
        );
      }
      await c.query(
        'INSERT INTO equity_adjustment_windows(id,isin,actor_id,fingerprint,input,receipt) VALUES($1,$2,$3,$4,$5,$6)',
        [input.requestId, input.isin, actor, digest(input), input, receipt],
      );
      await this.actor(cookie, 'prepare', c);
      return { id: input.requestId };
    });
  }
  @Post('review') @OperatorAction('approve') async review(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = AdjustmentReviewSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Complete independent coverage review.');
    const input = parsed.data;
    await this.actor(cookie, 'approve');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const rows = await c.query(
        'SELECT * FROM equity_adjustment_windows WHERE id=$1 FOR UPDATE',
        [input.id],
      );
      const actor = await this.actor(cookie, 'approve', c);
      if (!rows.rows[0]) throw new NotFoundException('Window unavailable.');
      const previous = await c.query(
        'SELECT payload FROM equity_adjustment_reviews WHERE request_id=$1',
        [input.requestId],
      );
      if (previous.rows[0]) {
        if (digest(previous.rows[0].payload) !== digest(input))
          throw new ConflictException('Review ID already used.');
        return input;
      }
      if (input.decision === 'publish') {
        if (
          !this.ops.namedMode ||
          rows.rows[0].actor_id === actor ||
          !input.completeWindowConfirmed
        )
          throw new ForbiddenException(
            'An independent named publisher must confirm source-window completeness.',
          );
        await this.raw.read(rows.rows[0].receipt.sourceHash);
        await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
        const company = await equityCompanyForTrace(c, rows.rows[0].isin);
        const rebuilt = buildAdjustmentWindow(
          AdjustmentWindowInputSchema.parse(rows.rows[0].input),
          company,
          rows.rows[0].receipt.sourceHash,
          rows.rows[0].receipt.createdAt,
        );
        if (digest(rebuilt) !== digest(rows.rows[0].receipt))
          throw new ConflictException(
            'Underlying company evidence changed. Prepare a new window.',
          );
      }
      await c.query(
        'INSERT INTO equity_adjustment_reviews(request_id,window_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, input.id, actor, input],
      );
      await this.actor(cookie, 'approve', c);
      return input;
    });
  }
}
