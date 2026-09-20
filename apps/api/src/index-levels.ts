import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
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
  IndexLevelInputSchema,
  IndexLevelReviewSchema,
  IndexLevelEditionSchema,
  IndexLevelPublicSchema,
  IndexLevelQueueSchema,
  IndexLevelQueueQuerySchema,
  IndexLevelCaptureSchema,
  IndexLevelQuerySchema,
  parseIndexLevels,
} from '@fingent360/contracts';
import type pg from 'pg';
import type { AppConfig } from './config.js';
import { canonicalSourceJson } from './canonical-source-json.js';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
const digest = (value: unknown) =>
    createHash('sha256').update(canonicalSourceJson(value)).digest('hex'),
  RAW = Symbol('INDEX_LEVELS_RAW');
class IndexLevelRaw {
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
      .collection<{ _id: string; value: unknown }>('index_levels_raw')
      .updateOne({ _id: hash }, { $setOnInsert: { value } }, { upsert: true });
    return hash;
  }
  async read(hash: string) {
    const row = await this.mongo
      .db()
      .collection<{ _id: string; value: unknown }>('index_levels_raw')
      .findOne({ _id: hash });
    if (!row || digest(row.value) !== hash)
      throw new ConflictException(
        'Original Index snapshot capture is unavailable or changed.',
      );
    return row.value;
  }
}
export const indexLevelsProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new IndexLevelRaw(config),
});
export async function indexLevelsSnapshot(
  c: pg.PoolClient,
  before?: string,
  limit = 20,
) {
  await c.query('LOCK TABLE index_levels_reviews IN SHARE MODE');
  const result = await c.query(
    "SELECT head.receipt,latest.created_at FROM(SELECT DISTINCT ON(e.receipt->>'effectiveOn') e.id,e.receipt FROM index_levels_editions e JOIN index_levels_reviews r ON r.edition_id=e.id WHERE e.receipt IS NOT NULL AND r.payload->>'decision'='publish' AND ($1::text IS NULL OR e.receipt->>'effectiveOn'<$1) ORDER BY e.receipt->>'effectiveOn' DESC,r.seq DESC) head JOIN LATERAL(SELECT payload,created_at FROM index_levels_reviews WHERE edition_id=head.id ORDER BY seq DESC LIMIT 1) latest ON true WHERE latest.payload->>'decision'='publish' ORDER BY head.receipt->>'effectiveOn' DESC LIMIT $2",
    [before ?? null, limit + 1],
  );
  const editions = result.rows.slice(0, limit).map((row) => ({
    ...row.receipt,
    reviewedAt: row.created_at.toISOString(),
  }));
  return IndexLevelPublicSchema.parse({
    editions,
    capturedAt: new Date().toISOString(),
    nextBefore: result.rows.length > limit ? editions.at(-1).effectiveOn : null,
  });
}
@Controller('index-levels')
export class IndexLevelsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() list(@Query() query: unknown) {
    const input = IndexLevelQuerySchema.safeParse(query);
    if (!input.success)
      throw new BadRequestException('Use an optional exclusive before date.');
    return this.store.transaction((c) =>
      indexLevelsSnapshot(c, input.data.before),
    );
  }
  @Get('snapshot') snapshot(@Query() query: unknown) {
    if (!z.strictObject({}).safeParse(query).success)
      throw new BadRequestException('Snapshot does not accept query filters.');
    return this.store.transaction((c) =>
      indexLevelsSnapshot(c, undefined, 1000),
    );
  }
}
@OperatorRead()
@Controller('ops/index-levels')
export class IndexLevelsOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: IndexLevelRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const identity = await this.ops.permission(cookie, permission, c);
    return typeof identity === 'string' ? identity : identity.identity.id;
  }
  @Get() async queue(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    await this.actor(cookie, 'read');
    const parsed = IndexLevelQueueQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException(
        'Use the exact capture queue continuation cursor.',
      );
    const [at, id] = parsed.data.cursor?.split('|') ?? [];
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        `SELECT e.id,e.source_hash,e.error,e.receipt,to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_cursor,CASE WHEN e.error IS NOT NULL THEN 'quarantined' ELSE COALESCE((SELECT payload->>'decision' FROM index_levels_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1),'draft') END AS state FROM index_levels_editions e WHERE ($1::timestamptz IS NULL OR (e.created_at,e.id)<($1::timestamptz,$2::uuid)) ORDER BY e.created_at DESC,e.id DESC LIMIT 21`,
        [at ?? null, id ?? null],
      );
      await this.actor(cookie, 'read', c);
      const visible = rows.rows.slice(0, 20),
        last = visible.at(-1);
      return IndexLevelQueueSchema.parse({
        items: visible.map((row) => ({
          id: row.id,
          source_hash: row.source_hash,
          error: row.error,
          receipt: row.receipt,
          state: row.state,
        })),
        nextCursor:
          rows.rows.length > 20 && last
            ? last.created_cursor + '|' + last.id
            : null,
      });
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.actor(cookie, 'read');
    if (!z.uuid().safeParse(id).success)
      throw new BadRequestException('Invalid capture ID.');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        'SELECT source_hash FROM index_levels_editions WHERE id=$1',
        [id],
      );
      if (!rows.rows[0])
        throw new NotFoundException('Index snapshot capture unavailable.');
      const value = await this.raw.read(rows.rows[0].source_hash);
      await this.actor(cookie, 'read', c);
      return value;
    });
  }
  @Post('capture') @OperatorAction('prepare') async capture(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = IndexLevelInputSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Upload the original dated source file and confirm usage permission.',
      );
    const input = parsed.data;
    if (Buffer.byteLength(input.csv, 'utf8') > 2_000_000)
      throw new BadRequestException('Original index CSV exceeds2MB.');
    await this.actor(cookie, 'prepare');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const actor = await this.actor(cookie, 'prepare', c),
        old = await c.query(
          'SELECT fingerprint,error,actor_id FROM index_levels_editions WHERE id=$1',
          [input.requestId],
        );
      if (old.rows[0]) {
        if (
          old.rows[0].fingerprint !== digest(input) ||
          old.rows[0].actor_id !== actor
        )
          throw new ConflictException('Capture request ID already used.');
        return IndexLevelCaptureSchema.parse({
          id: input.requestId,
          state: old.rows[0].error ? 'quarantined' : 'retained',
          reason: old.rows[0].error,
        });
      }
      const hash = await this.raw.retain(input);
      let receipt: ReturnType<typeof IndexLevelEditionSchema.parse> | null =
          null,
        error: string | null = null;
      try {
        receipt = parseIndexLevels(
          input,
          createHash('sha256').update(input.csv).digest('hex'),
          new Date().toISOString(),
        );
      } catch (cause) {
        error = (
          cause instanceof Error
            ? cause.message
            : 'Unsupported Index snapshot capture.'
        ).slice(0, 2000);
      }
      await c.query(
        'INSERT INTO index_levels_editions(id,actor_id,fingerprint,source_hash,input,receipt,error) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [input.requestId, actor, digest(input), hash, input, receipt, error],
      );
      await this.actor(cookie, 'prepare', c);
      return IndexLevelCaptureSchema.parse({
        id: input.requestId,
        state: error ? 'quarantined' : 'retained',
        reason: error,
      });
    });
  }
  @Post('review') @OperatorAction('approve') async review(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = IndexLevelReviewSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Complete the independent review.');
    const input = parsed.data;
    await this.actor(cookie, 'approve');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const actor = await this.actor(cookie, 'approve', c),
        previous = await c.query(
          'SELECT payload,actor_id FROM index_levels_reviews WHERE request_id=$1',
          [input.requestId],
        );
      if (previous.rows[0]) {
        if (
          previous.rows[0].actor_id !== actor ||
          digest(previous.rows[0].payload) !== digest(input)
        )
          throw new ConflictException('Review request ID already used.');
        return input;
      }
      const found = await c.query(
          'SELECT * FROM index_levels_editions WHERE id=$1',
          [input.id],
        ),
        row = found.rows[0];
      if (!row || !row.receipt)
        throw new NotFoundException(
          'No supported Index snapshot edition to review.',
        );
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'index-date:' + row.receipt.effectiveOn,
      ]);
      if (input.decision === 'publish') {
        if (
          !this.ops.namedMode ||
          row.actor_id === actor ||
          !input.rightsVerified
        )
          throw new ForbiddenException(
            'A different named reviewer must verify original source and retention/display/offline permission.',
          );
        const raw = await this.raw.read(row.source_hash),
          receipt = IndexLevelEditionSchema.parse(row.receipt);
        if (
          digest(
            parseIndexLevels(
              raw,
              createHash('sha256')
                .update(IndexLevelInputSchema.parse(raw).csv)
                .digest('hex'),
              receipt.retrievedAt,
            ),
          ) !== digest(receipt)
        )
          throw new ConflictException(
            'Index snapshot edition does not reconstruct from its original capture.',
          );
      }
      await c.query(
        'INSERT INTO index_levels_reviews(request_id,edition_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, input.id, actor, input],
      );
      await this.actor(cookie, 'approve', c);
      return input;
    });
  }
}
