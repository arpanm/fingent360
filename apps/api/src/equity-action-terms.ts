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
  ActionTermsInputSchema,
  ActionTermsReviewSchema,
  ActionTermsReceiptSchema,
  ActionTermsPublicSchema,
  ActionTermsQueueSchema,
  buildActionTerms,
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
type Input = ReturnType<typeof ActionTermsInputSchema.parse>;
class ActionTermsRaw {
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
      .collection<{ _id: string; input: Input }>('equity_action_terms_raw')
      .updateOne({ _id: hash }, { $setOnInsert: { input } }, { upsert: true });
    return hash;
  }
  async read(hash: string) {
    const row = await this.mongo
      .db()
      .collection<{ _id: string; input: Input }>('equity_action_terms_raw')
      .findOne({ _id: hash });
    if (!row || digest(row.input) !== hash)
      throw new ConflictException(
        'Original action terms evidence is unavailable or changed.',
      );
    return ActionTermsInputSchema.parse(row.input);
  }
}
export const actionTermsProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new ActionTermsRaw(config),
});
async function reconstruct(
  c: pg.PoolClient,
  input: Input,
  hash: string,
  createdAt: string,
) {
  const oldCompany = await equityCompanyForTrace(c, input.terms.oldIsin),
    newCompany = await equityCompanyForTrace(c, input.terms.newIsin);
  const bytes = Buffer.from(input.original.bytesBase64, 'base64');
  if (
    bytes.length > 8000000 ||
    bytes.toString('base64') !== input.original.bytesBase64 ||
    (input.original.mediaType === 'application/pdf' &&
      !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))
  )
    throw new BadRequestException('Attach bounded original source bytes.');
  const documentHash = createHash('sha256').update(bytes).digest('hex');
  try {
    return buildActionTerms(
      input,
      oldCompany,
      newCompany,
      hash,
      documentHash,
      createdAt,
    );
  } catch (cause) {
    throw new BadRequestException(
      cause instanceof Error
        ? cause.message
        : 'Invalid corporate-action terms.',
      { cause },
    );
  }
}
@Controller('equity-action-terms')
export class EquityActionTermsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(RAW) private readonly raw: ActionTermsRaw,
  ) {}
  @Get(':isin') async list(@Param('isin') isin: string) {
    if (!/^IN[A-Z0-9]{9}[0-9]$/.test(isin))
      throw new BadRequestException('Invalid company.');
    return this.store.transaction(async (c) => {
      await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
      await c.query('LOCK TABLE equity_action_terms_reviews IN SHARE MODE');
      const rows = await c.query(
        "SELECT b.*,r.created_at AS reviewed_at FROM equity_action_terms b JOIN LATERAL(SELECT payload,created_at FROM equity_action_terms_reviews WHERE action_id=b.id ORDER BY seq DESC LIMIT 1)r ON true WHERE (b.old_isin=$1 OR b.new_isin=$1) AND r.payload->>'decision'='publish' ORDER BY b.created_at DESC,b.id DESC LIMIT 101",
        [isin],
      );
      if (rows.rows.length > 100)
        throw new ConflictException(
          'Action terms history exceeds snapshot scope.',
        );
      const actions = [];
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
          actions.push({
            ...rebuilt,
            reviewedAt: row.reviewed_at.toISOString(),
          });
      }
      return ActionTermsPublicSchema.parse({
        actions,
        capturedAt: new Date().toISOString(),
      });
    });
  }
}
@OperatorRead()
@Controller('ops/equity-action-terms')
export class EquityActionTermsOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: ActionTermsRaw,
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
    if (after && !ActionTermsReviewSchema.shape.id.safeParse(after).success)
      throw new BadRequestException('Invalid continuation cursor.');
    return this.store.transaction(async (c) => {
      if (after) {
        const cursor = await c.query(
          'SELECT 1 FROM equity_action_terms WHERE id=$1',
          [after],
        );
        if (!cursor.rows.length)
          throw new NotFoundException('Continuation cursor unavailable.');
      }
      const rows = await c.query(
        "SELECT b.id,receipt,COALESCE((SELECT payload->>'decision' FROM equity_action_terms_reviews WHERE action_id=b.id ORDER BY seq DESC LIMIT 1),'draft') AS state FROM equity_action_terms b WHERE ($1::uuid IS NULL OR (b.created_at,b.id)<(SELECT created_at,id FROM equity_action_terms WHERE id=$1)) ORDER BY b.created_at DESC,b.id DESC LIMIT 21",
        [after ?? null],
      );
      await this.actor(cookie, 'read', c);
      return ActionTermsQueueSchema.parse({
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
    if (!ActionTermsReviewSchema.shape.id.safeParse(id).success)
      throw new BadRequestException('Invalid action.');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        'SELECT receipt FROM equity_action_terms WHERE id=$1',
        [id],
      );
      if (!rows.rows[0])
        throw new NotFoundException('Action terms unavailable.');
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
    const parsed = ActionTermsInputSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Complete the original terms, exact dates and permissions.',
      );
    const input = parsed.data;
    await this.actor(cookie, 'prepare');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const actor = await this.actor(cookie, 'prepare', c);
      const old = await c.query(
        'SELECT fingerprint,actor_id FROM equity_action_terms WHERE id=$1',
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
        'INSERT INTO equity_action_terms(id,old_isin,new_isin,actor_id,fingerprint,input,receipt) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          input.requestId,
          input.terms.oldIsin,
          input.terms.newIsin,
          actor,
          hash,
          { ...input, original: receipt.original },
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
    const parsed = ActionTermsReviewSchema.safeParse(body);
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
          'SELECT actor_id,payload FROM equity_action_terms_reviews WHERE request_id=$1',
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
        'SELECT * FROM equity_action_terms WHERE id=$1 FOR UPDATE',
        [input.id],
      );
      const row = rows.rows[0];
      if (!row) throw new NotFoundException('Action terms unavailable.');
      if (input.decision === 'publish') {
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          'actionTerms-publish',
        ]);
        const active = await c.query(
          "SELECT b.id FROM equity_action_terms b JOIN LATERAL(SELECT payload FROM equity_action_terms_reviews WHERE action_id=b.id ORDER BY seq DESC LIMIT 1)r ON true WHERE b.id<>$1 AND (b.old_isin=$2 OR b.new_isin=$2 OR b.old_isin=$3 OR b.new_isin=$3) AND b.receipt->'terms'->>'exOn'=$4 AND r.payload->>'decision'='publish' LIMIT 1",
          [input.id, row.old_isin, row.new_isin, row.receipt.terms.exOn],
        );
        if (active.rows.length)
          throw new ConflictException(
            'Withdraw the currently published overlapping action terms before publishing another.',
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
              'Source no longer reconstructs. Prepare a new action terms.',
              { cause },
            );
          throw cause;
        }
        if (
          digest(rebuilt) !==
          digest(ActionTermsReceiptSchema.parse(row.receipt))
        )
          throw new ConflictException(
            'Underlying company evidence changed. Prepare a new action terms.',
          );
      }
      await c.query(
        'INSERT INTO equity_action_terms_reviews(request_id,action_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, input.id, actor, input],
      );
      await this.actor(cookie, 'approve', c);
      return input;
    });
  }
}
