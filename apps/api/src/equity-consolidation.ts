import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  Query,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ConsolidationInputSchema,
  ConsolidationReviewSchema,
  ConsolidationReceiptSchema,
  ConsolidationPublicSchema,
  ConsolidationQueueSchema,
  buildConsolidation,
} from '@fingent360/contracts';
import type pg from 'pg';
import type { AppConfig } from './config.js';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { equityCompanyForTrace } from './equity-coverage.js';
import { canonicalSourceJson } from './canonical-source-json.js';
const digest = (value: unknown) =>
  createHash('sha256').update(canonicalSourceJson(value)).digest('hex');
const RAW = Symbol('CONSOLIDATION_RAW');
type Input = ReturnType<typeof ConsolidationInputSchema.parse>;
class ConsolidationRaw {
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await this.mongo.close();
  }
  async retain(input: Input) {
    const hash = digest(input);
    await this.mongo
      .db()
      .collection<{ _id: string; input: Input }>('equity_consolidation_raw')
      .updateOne({ _id: hash }, { $setOnInsert: { input } }, { upsert: true });
    return hash;
  }
  async read(hash: string) {
    const row = await this.mongo
      .db()
      .collection<{ _id: string; input: Input }>('equity_consolidation_raw')
      .findOne({ _id: hash });
    if (!row || digest(row.input) !== hash)
      throw new ConflictException(
        'Original consolidation evidence is unavailable or changed.',
      );
    return ConsolidationInputSchema.parse(row.input);
  }
}
export const consolidationProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new ConsolidationRaw(config),
});
async function reconstruct(
  c: pg.PoolClient,
  input: Input,
  hash: string,
  createdAt: string,
) {
  const oldCompany = await equityCompanyForTrace(c, input.oldIsin),
    newCompany = await equityCompanyForTrace(c, input.newIsin);
  const documents = input.documents.map(({ pdfBase64, ...document }) => {
    const bytes = Buffer.from(pdfBase64, 'base64');
    if (
      bytes.length > 2000000 ||
      bytes.toString('base64') !== pdfBase64 ||
      !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
    )
      throw new BadRequestException(
        'Attach bounded original PDF bytes for every notice.',
      );
    return {
      ...document,
      hash: createHash('sha256').update(bytes).digest('hex'),
    };
  });
  try {
    return buildConsolidation(
      input,
      oldCompany,
      newCompany,
      hash,
      documents,
      createdAt,
    );
  } catch (cause) {
    throw new BadRequestException(
      cause instanceof Error ? cause.message : 'Invalid consolidation terms.',
      { cause },
    );
  }
}
/** A declared suspension must never become an ordinary daily-return link. */
export async function consolidationBlocksDailyWindow(
  c: pg.PoolClient,
  isin: string,
  start: string,
  end: string,
) {
  await c.query('LOCK TABLE equity_consolidation_reviews IN SHARE MODE');
  const rows = await c.query(
    "SELECT 1 FROM equity_consolidations b JOIN LATERAL(SELECT payload FROM equity_consolidation_reviews WHERE bridge_id=b.id ORDER BY seq DESC LIMIT 1)r ON true WHERE (b.old_isin=$1 OR b.new_isin=$1) AND r.payload->>'decision'='publish' AND b.receipt->>'lastOldTradeOn' < $3 AND b.receipt->>'resumedOn' > $2 LIMIT 1",
    [isin, start, end],
  );
  return rows.rowCount !== 0;
}
@Controller('equity-consolidations')
export class EquityConsolidationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(RAW) private readonly raw: ConsolidationRaw,
  ) {}
  @Get(':isin') async list(@Param('isin') isin: string) {
    if (!/^IN[A-Z0-9]{9}[0-9]$/.test(isin))
      throw new BadRequestException('Invalid company.');
    return this.store.transaction(async (c) => {
      await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
      await c.query('LOCK TABLE equity_consolidation_reviews IN SHARE MODE');
      const rows = await c.query(
        "SELECT b.*,r.created_at AS reviewed_at FROM equity_consolidations b JOIN LATERAL(SELECT payload,created_at FROM equity_consolidation_reviews WHERE bridge_id=b.id ORDER BY seq DESC LIMIT 1)r ON true WHERE (b.old_isin=$1 OR b.new_isin=$1) AND r.payload->>'decision'='publish' ORDER BY b.created_at DESC,b.id DESC LIMIT 101",
        [isin],
      );
      if (rows.rows.length > 100)
        throw new ConflictException(
          'Consolidation history exceeds snapshot scope.',
        );
      const bridges = [];
      for (const row of rows.rows) {
        const input = await this.raw.read(row.receipt.sourceHash);
        let rebuilt;
        try {
          rebuilt = await reconstruct(
            c,
            input,
            row.receipt.sourceHash,
            row.receipt.createdAt,
          );
        } catch (cause) {
          if (
            cause instanceof BadRequestException ||
            cause instanceof NotFoundException
          )
            continue;
          throw cause;
        }
        if (digest(rebuilt) === digest(row.receipt))
          bridges.push({
            ...rebuilt,
            reviewedAt: row.reviewed_at.toISOString(),
          });
      }
      return ConsolidationPublicSchema.parse({
        bridges,
        capturedAt: new Date().toISOString(),
      });
    });
  }
}
@OperatorRead()
@Controller('ops/equity-consolidations')
export class EquityConsolidationOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: ConsolidationRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const value = await this.ops.permission(cookie, permission, c);
    return typeof value === 'string' ? value : value.identity.id;
  }
  @Get() async queue(
    @Headers('cookie') cookie?: string,
    @Query('after') after?: string,
  ) {
    await this.actor(cookie, 'read');
    if (after && !ConsolidationReviewSchema.shape.id.safeParse(after).success)
      throw new BadRequestException('Invalid continuation cursor.');
    return this.store.transaction(async (c) => {
      if (after) {
        const cursor = await c.query(
          'SELECT 1 FROM equity_consolidations WHERE id=$1',
          [after],
        );
        if (!cursor.rows.length)
          throw new NotFoundException('Continuation cursor unavailable.');
      }
      const rows = await c.query(
        "SELECT b.id,receipt,COALESCE((SELECT payload->>'decision' FROM equity_consolidation_reviews WHERE bridge_id=b.id ORDER BY seq DESC LIMIT 1),'draft') AS state FROM equity_consolidations b WHERE ($1::uuid IS NULL OR (b.created_at,b.id)<(SELECT created_at,id FROM equity_consolidations WHERE id=$1)) ORDER BY b.created_at DESC,b.id DESC LIMIT 21",
        [after ?? null],
      );
      await this.actor(cookie, 'read', c);
      return ConsolidationQueueSchema.parse({
        items: rows.rows
          .slice(0, 20)
          .map((row) => ({ receipt: row.receipt, state: row.state })),
        next: rows.rows.length > 20 ? rows.rows[19].id : null,
      });
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.actor(cookie, 'read');
    if (!ConsolidationReviewSchema.shape.id.safeParse(id).success)
      throw new BadRequestException('Invalid bridge.');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        'SELECT receipt FROM equity_consolidations WHERE id=$1',
        [id],
      );
      if (!rows.rows[0]) throw new NotFoundException('Bridge unavailable.');
      const input = await this.raw.read(rows.rows[0].receipt.sourceHash);
      await this.actor(cookie, 'read', c);
      return input;
    });
  }
  @Post('prepare') @OperatorAction('prepare') async prepare(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = ConsolidationInputSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Complete the three original notices, exact terms and permissions.',
      );
    const input = parsed.data;
    await this.actor(cookie, 'prepare');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const actor = await this.actor(cookie, 'prepare', c);
      const old = await c.query(
        'SELECT fingerprint,actor_id FROM equity_consolidations WHERE id=$1',
        [input.requestId],
      );
      if (old.rows[0]) {
        if (
          old.rows[0].actor_id !== actor ||
          old.rows[0].fingerprint !== digest(input)
        )
          throw new ConflictException('Request ID already used.');
        await this.actor(cookie, 'prepare', c);
        return { id: input.requestId };
      }
      await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
      const hash = digest(input);
      const receipt = await reconstruct(
        c,
        input,
        hash,
        new Date().toISOString(),
      );
      await this.raw.retain(input);
      await c.query(
        'INSERT INTO equity_consolidations(id,old_isin,new_isin,actor_id,fingerprint,input,receipt) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          input.requestId,
          input.oldIsin,
          input.newIsin,
          actor,
          hash,
          { ...input, documents: receipt.documents },
          receipt,
        ],
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
    const parsed = ConsolidationReviewSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Complete independent review.');
    const input = parsed.data;
    await this.actor(cookie, 'approve');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
      const actor = await this.actor(cookie, 'approve', c),
        previous = await c.query(
          'SELECT actor_id,payload FROM equity_consolidation_reviews WHERE request_id=$1',
          [input.requestId],
        );
      if (previous.rows[0]) {
        if (
          previous.rows[0].actor_id !== actor ||
          digest(previous.rows[0].payload) !== digest(input)
        )
          throw new ConflictException('Review ID already used.');
        await this.actor(cookie, 'approve', c);
        return input;
      }
      const rows = await c.query(
        'SELECT * FROM equity_consolidations WHERE id=$1 FOR UPDATE',
        [input.id],
      );
      const row = rows.rows[0];
      if (!row) throw new NotFoundException('Bridge unavailable.');
      if (input.decision === 'publish') {
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          'consolidation-publish',
        ]);
        const active = await c.query(
          "SELECT b.id FROM equity_consolidations b JOIN LATERAL(SELECT payload FROM equity_consolidation_reviews WHERE bridge_id=b.id ORDER BY seq DESC LIMIT 1)r ON true WHERE b.id<>$1 AND (b.old_isin=$2 OR b.new_isin=$2 OR b.old_isin=$3 OR b.new_isin=$3) AND r.payload->>'decision'='publish' LIMIT 1",
          [input.id, row.old_isin, row.new_isin],
        );
        if (active.rows.length)
          throw new ConflictException(
            'Withdraw the currently published overlapping security bridge before publishing another.',
          );
        if (
          !this.ops.namedMode ||
          actor === row.actor_id ||
          !input.originalsAndTermsConfirmed
        )
          throw new ForbiddenException(
            'A different named reviewer must verify original terms and permission.',
          );
        const original = await this.raw.read(row.receipt.sourceHash);
        let rebuilt;
        try {
          rebuilt = await reconstruct(
            c,
            original,
            row.receipt.sourceHash,
            row.receipt.createdAt,
          );
        } catch (cause) {
          if (
            cause instanceof BadRequestException ||
            cause instanceof NotFoundException
          )
            throw new ConflictException(
              'Source no longer reconstructs. Prepare a new bridge.',
              { cause },
            );
          throw cause;
        }
        if (
          digest(rebuilt) !==
          digest(ConsolidationReceiptSchema.parse(row.receipt))
        )
          throw new ConflictException(
            'Underlying company evidence changed. Prepare a new bridge.',
          );
      }
      await c.query(
        'INSERT INTO equity_consolidation_reviews(request_id,bridge_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, input.id, actor, input],
      );
      await this.actor(cookie, 'approve', c);
      return input;
    });
  }
}
