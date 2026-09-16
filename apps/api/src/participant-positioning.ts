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
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  PositioningInputSchema,
  PositioningReviewSchema,
  PositioningEditionSchema,
  PositioningPublicSchema,
  PositioningQueueSchema,
  PositioningCaptureSchema,
  parseParticipantPositioning,
} from '@fingent360/contracts';
import type pg from 'pg';
import type { AppConfig } from './config.js';
import { canonicalSourceJson } from './canonical-source-json.js';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
const digest = (value: unknown) =>
    createHash('sha256').update(canonicalSourceJson(value)).digest('hex'),
  RAW = Symbol('PARTICIPANT_POSITIONING_RAW');
class PositioningRaw {
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
      .collection<{ _id: string; value: unknown }>(
        'participant_positioning_raw',
      )
      .updateOne({ _id: hash }, { $setOnInsert: { value } }, { upsert: true });
    return hash;
  }
  async read(hash: string) {
    const row = await this.mongo
      .db()
      .collection<{ _id: string; value: unknown }>(
        'participant_positioning_raw',
      )
      .findOne({ _id: hash });
    if (!row || digest(row.value) !== hash)
      throw new ConflictException(
        'Original OI capture is unavailable or changed.',
      );
    return row.value;
  }
}
export const participantPositioningProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new PositioningRaw(config),
});
export async function participantPositioningSnapshot(c: pg.PoolClient) {
  await c.query('LOCK TABLE participant_positioning_reviews IN SHARE MODE');
  const result = await c.query(
    "SELECT head.receipt,latest.created_at FROM(SELECT DISTINCT ON(e.receipt->>'effectiveOn') e.id,e.receipt FROM participant_positioning_editions e JOIN participant_positioning_reviews r ON r.edition_id=e.id WHERE e.receipt IS NOT NULL AND r.payload->>'decision'='publish' ORDER BY e.receipt->>'effectiveOn' DESC,r.seq DESC) head JOIN LATERAL(SELECT payload,created_at FROM participant_positioning_reviews WHERE edition_id=head.id ORDER BY seq DESC LIMIT 1) latest ON true WHERE latest.payload->>'decision'='publish' ORDER BY head.receipt->>'effectiveOn' DESC LIMIT 100",
  );
  return PositioningPublicSchema.parse({
    editions: result.rows.map((row) => ({
      ...row.receipt,
      reviewedAt: row.created_at.toISOString(),
    })),
    capturedAt: new Date().toISOString(),
  });
}
@Controller('positioning')
export class ParticipantPositioningController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() list() {
    return this.store.transaction((c) => participantPositioningSnapshot(c));
  }
}
@OperatorRead()
@Controller('ops/positioning')
export class ParticipantPositioningOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: PositioningRaw,
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
        "SELECT e.id,e.source_hash,e.error,e.receipt,CASE WHEN e.error IS NOT NULL THEN 'quarantined' ELSE COALESCE((SELECT payload->>'decision' FROM participant_positioning_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1),'draft') END AS state FROM participant_positioning_editions e ORDER BY e.created_at DESC,e.id LIMIT 100",
      );
      await this.actor(cookie, 'read', c);
      return PositioningQueueSchema.parse(rows.rows);
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
        'SELECT source_hash FROM participant_positioning_editions WHERE id=$1',
        [id],
      );
      if (!rows.rows[0]) throw new NotFoundException('OI capture unavailable.');
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
    const parsed = PositioningInputSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Upload the original dated source file and confirm usage permission.',
      );
    const input = parsed.data;
    await this.actor(cookie, 'prepare');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const actor = await this.actor(cookie, 'prepare', c),
        old = await c.query(
          'SELECT fingerprint,error FROM participant_positioning_editions WHERE id=$1',
          [input.requestId],
        );
      if (old.rows[0]) {
        if (old.rows[0].fingerprint !== digest(input))
          throw new ConflictException('Capture request ID already used.');
        return PositioningCaptureSchema.parse({
          id: input.requestId,
          state: old.rows[0].error ? 'quarantined' : 'retained',
          reason: old.rows[0].error,
        });
      }
      const hash = await this.raw.retain(input);
      let receipt: ReturnType<typeof PositioningEditionSchema.parse> | null =
          null,
        error: string | null = null;
      try {
        receipt = parseParticipantPositioning(
          input,
          hash,
          new Date().toISOString(),
        );
      } catch (cause) {
        error = (
          cause instanceof Error ? cause.message : 'Unsupported OI capture.'
        ).slice(0, 2000);
      }
      await c.query(
        'INSERT INTO participant_positioning_editions(id,actor_id,fingerprint,source_hash,input,receipt,error) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [input.requestId, actor, digest(input), hash, input, receipt, error],
      );
      await this.actor(cookie, 'prepare', c);
      return PositioningCaptureSchema.parse({
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
    const parsed = PositioningReviewSchema.safeParse(body);
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
          'SELECT payload,actor_id FROM participant_positioning_reviews WHERE request_id=$1',
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
          'SELECT * FROM participant_positioning_editions WHERE id=$1',
          [input.id],
        ),
        row = found.rows[0];
      if (!row || !row.receipt)
        throw new NotFoundException('No supported OI edition to review.');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'oi-date:' + row.receipt.effectiveOn,
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
          receipt = PositioningEditionSchema.parse(row.receipt);
        if (
          digest(
            parseParticipantPositioning(
              raw,
              row.source_hash,
              receipt.retrievedAt,
            ),
          ) !== digest(receipt)
        )
          throw new ConflictException(
            'OI edition does not reconstruct from its original capture.',
          );
      }
      await c.query(
        'INSERT INTO participant_positioning_reviews(request_id,edition_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, input.id, actor, input],
      );
      await this.actor(cookie, 'approve', c);
      return input;
    });
  }
}
