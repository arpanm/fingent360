import { createHash, randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import type pg from 'pg';
import { z } from 'zod';
import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  Param,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  EIA_SPOT_URL,
  EiaSpotInputSchema,
  EiaSpotGateSchema,
  EiaSpotReceiptSchema,
  EiaSpotReviewSchema,
  EiaSpotQueueSchema,
  EiaSpotPublicSchema,
  parseEiaSpot,
} from '@fingent360/contracts';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import type { AppConfig } from './config.js';
import { canonicalSourceJson } from './canonical-source-json.js';
const RAW = Symbol('EIA_SPOT_RAW'),
  hash = (v: string) => createHash('sha256').update(v).digest('hex'),
  digest = (v: unknown) => hash(canonicalSourceJson(v));
type Raw = {
  _id: string;
  body: string;
  retrievedAt: string;
  rightsEvidence: string;
};
class EiaSpotRaw {
  readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  onApplicationShutdown() {
    return this.mongo.close();
  }
  async read(id: string) {
    const raw = await this.mongo
      .db()
      .collection<Raw>('eia_spot_raw')
      .findOne({ _id: id });
    if (!raw) throw new ConflictException('Original daily source unavailable.');
    return raw;
  }
}
export const eiaSpotProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new EiaSpotRaw(config),
});
async function gate(c: pg.PoolClient) {
  const row = (
    await c.query('SELECT * FROM eia_spot_gate WHERE id=true FOR SHARE')
  ).rows[0];
  if (!row?.enabled || row.rights_evidence.length < 30)
    throw new ForbiddenException('EIA contributor permission is not enabled.');
  return row.rights_evidence as string;
}
export async function fetchEiaSpot() {
  const response = await fetch(EIA_SPOT_URL, {
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'text/html' },
  });
  if (!response.ok || !response.body)
    throw new ServiceUnavailableException(
      'Original EIA daily source unavailable.',
    );
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const p = await reader.read();
      if (p.done) break;
      size += p.value.byteLength;
      if (size > 1000000)
        throw new BadRequestException('Daily source exceeds 1 MB.');
      chunks.push(p.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Buffer.concat(chunks),
  );
}
async function retain(
  c: pg.PoolClient,
  mongo: MongoClient,
  input: z.infer<typeof EiaSpotInputSchema>,
  actor: string,
  rights: string,
) {
  if (Buffer.byteLength(input.body, 'utf8') > 1000000)
    throw new BadRequestException('Daily source exceeds 1 MB UTF8.');
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    input.requestId,
  ]);
  const previous = (
    await c.query(
      'SELECT receipt,fingerprint,actor_id FROM eia_spot_sources WHERE id=$1',
      [input.requestId],
    )
  ).rows[0];
  if (previous) {
    if (
      previous.actor_id !== actor ||
      previous.fingerprint !== digest({ input, rights })
    )
      throw new ConflictException('Capture ID reused.');
    return EiaSpotReceiptSchema.parse(previous.receipt);
  }
  const raw: Raw = {
    _id: input.requestId,
    body: input.body,
    retrievedAt: new Date().toISOString(),
    rightsEvidence: rights,
  };
  await mongo
    .db()
    .collection<Raw>('eia_spot_raw')
    .updateOne({ _id: raw._id }, { $setOnInsert: raw }, { upsert: true });
  const saved = await mongo
    .db()
    .collection<Raw>('eia_spot_raw')
    .findOne({ _id: raw._id });
  if (!saved || saved.body !== input.body || saved.rightsEvidence !== rights)
    throw new ConflictException(
      'Retained attempt ID belongs to different original bytes.',
    );
  let receipt;
  try {
    receipt = parseEiaSpot(
      saved.body,
      input.requestId,
      hash(saved.body),
      saved.retrievedAt,
    );
  } catch (cause) {
    throw new BadRequestException(
      'Retained original EIA layout is unsupported; previous publications are unchanged.',
      { cause },
    );
  }
  await c.query(
    'INSERT INTO eia_spot_sources(id,actor_id,fingerprint,receipt) VALUES($1,$2,$3,$4)',
    [input.requestId, actor, digest({ input, rights }), receipt],
  );
  return receipt;
}
@Controller('eia-spot')
export class EiaSpotController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(RAW) private readonly raw: EiaSpotRaw,
  ) {}
  @Get() read(@Query('edition') edition?: string) {
    if (edition && !z.uuid().safeParse(edition).success)
      throw new BadRequestException('Invalid daily edition.');
    return this.store.transaction(async (c) => {
      try {
        await gate(c);
      } catch (e) {
        if (e instanceof ForbiddenException)
          throw new NotFoundException('Daily source is not enabled.', {
            cause: e,
          });
        throw e;
      }
      await c.query('LOCK TABLE eia_spot_reviews IN SHARE MODE');
      const rows = (
        await c.query(
          "SELECT s.receipt,r.created_at AS reviewed_at FROM eia_spot_sources s JOIN LATERAL(SELECT payload,created_at FROM eia_spot_reviews WHERE source_id=s.id ORDER BY seq DESC LIMIT 1)r ON true WHERE r.payload->>'decision'='publish' ORDER BY s.created_at DESC,s.id DESC LIMIT 101",
        )
      ).rows;
      if (rows.length > 100)
        throw new ConflictException(
          'Withdraw obsolete editions before publishing more.',
        );
      const row = edition
        ? rows.find((r) => r.receipt.id === edition)
        : rows[0];
      if (!row)
        throw new NotFoundException('Reviewed daily source unavailable.');
      const receipt = EiaSpotReceiptSchema.parse(row.receipt),
        raw = await this.raw.read(receipt.id);
      if (raw.rightsEvidence !== (await gate(c)))
        throw new NotFoundException(
          'This edition requires review under the current permission.',
        );
      if (
        digest(
          parseEiaSpot(raw.body, receipt.id, hash(raw.body), raw.retrievedAt),
        ) !== digest(receipt)
      )
        throw new ConflictException('Daily source no longer reconstructs.');
      return EiaSpotPublicSchema.parse({
        receipt,
        reviewedAt: row.reviewed_at.toISOString(),
        editions: rows.map((r) => r.receipt.id),
      });
    });
  }
}
@OperatorRead()
@Controller('ops/eia-spot')
export class EiaSpotOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: EiaSpotRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    action: 'read' | 'prepare' | 'approve' | 'administer',
    c?: pg.PoolClient,
  ) {
    const v = await this.ops.permission(cookie, action, c);
    return typeof v === 'string' ? v : v.identity.id;
  }
  @Get() queue(
    @Headers('cookie') cookie?: string,
    @Query('after') after?: string,
  ) {
    if (after && !z.uuid().safeParse(after).success)
      throw new BadRequestException('Invalid cursor.');
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      if (
        after &&
        !(await c.query('SELECT 1 FROM eia_spot_sources WHERE id=$1', [after]))
          .rows.length
      )
        throw new NotFoundException('Cursor unavailable.');
      const setting = (
          await c.query('SELECT * FROM eia_spot_gate WHERE id=true')
        ).rows[0],
        rows = (
          await c.query(
            "SELECT s.id,s.receipt,COALESCE((SELECT payload->>'decision' FROM eia_spot_reviews WHERE source_id=s.id ORDER BY seq DESC LIMIT 1),'draft') AS state FROM eia_spot_sources s WHERE ($1::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM eia_spot_sources WHERE id=$1)) ORDER BY created_at DESC,id DESC LIMIT 21",
            [after ?? null],
          )
        ).rows;
      await this.actor(cookie, 'read', c);
      return EiaSpotQueueSchema.parse({
        gate: {
          enabled: setting.enabled,
          rightsEvidence: setting.rights_evidence,
        },
        items: rows
          .slice(0, 20)
          .map((r) => ({ receipt: r.receipt, state: r.state })),
        next: rows.length > 20 ? rows[19].id : null,
      });
    });
  }
  @OperatorAction('administer') @Post('gate') configure(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const p = EiaSpotGateSchema.safeParse(body);
    if (!p.success)
      throw new BadRequestException('Record actual contributor permission.');
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'administer', c);
      await c.query(
        'UPDATE eia_spot_gate SET enabled=$1,rights_evidence=$2 WHERE id=true',
        [p.data.enabled, p.data.rightsEvidence],
      );
      await this.actor(cookie, 'administer', c);
      return p.data;
    });
  }
  @OperatorAction('prepare') @Post('capture') async capture(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const p = EiaSpotInputSchema.safeParse(body);
    if (!p.success)
      throw new BadRequestException('Provide a bounded original HTML capture.');
    return this.store.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c),
        rights = await gate(c),
        receipt = await retain(c, this.raw.mongo, p.data, actor, rights);
      await this.actor(cookie, 'prepare', c);
      return receipt;
    });
  }
  @OperatorAction('prepare') @Post('fetch') async fetchOriginal(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const p = EiaSpotInputSchema.omit({ body: true }).safeParse(body);
    if (!p.success)
      throw new BadRequestException('Provide a capture request ID.');
    const old = await this.store.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c);
      await gate(c);
      const row = (
        await c.query(
          'SELECT actor_id,receipt FROM eia_spot_sources WHERE id=$1',
          [p.data.requestId],
        )
      ).rows[0];
      if (row && row.actor_id !== actor)
        throw new ConflictException('Capture ID belongs to another actor.');
      await this.actor(cookie, 'prepare', c);
      return row?.receipt;
    });
    if (old) return EiaSpotReceiptSchema.parse(old);
    const before = await this.store.transaction(async (c) => {
      await this.actor(cookie, 'prepare', c);
      return gate(c);
    });
    const downloaded = await fetchEiaSpot();
    return this.store.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c),
        rights = await gate(c);
      if (rights !== before)
        throw new ConflictException('Permission changed during acquisition.');
      const receipt = await retain(
        c,
        this.raw.mongo,
        { ...p.data, body: downloaded },
        actor,
        rights,
      );
      await this.actor(cookie, 'prepare', c);
      return receipt;
    });
  }
  @Get(':id/evidence') evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    if (!z.uuid().safeParse(id).success)
      throw new BadRequestException('Invalid original.');
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const raw = await this.raw.read(id);
      await this.actor(cookie, 'read', c);
      return {
        body: raw.body,
        bodyHash: hash(raw.body),
        retrievedAt: raw.retrievedAt,
        url: EIA_SPOT_URL,
      };
    });
  }
  @OperatorAction('approve') @Post('review') review(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const p = EiaSpotReviewSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('Complete source review.');
    return this.store.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c),
        v = p.data;
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        v.requestId,
      ]);
      const old = (
        await c.query(
          'SELECT actor_id,payload FROM eia_spot_reviews WHERE request_id=$1',
          [v.requestId],
        )
      ).rows[0];
      if (old) {
        if (old.actor_id !== actor || digest(old.payload) !== digest(v))
          throw new ConflictException('Review ID reused.');
        await this.actor(cookie, 'approve', c);
        return v;
      }
      const row = (
        await c.query('SELECT * FROM eia_spot_sources WHERE id=$1 FOR UPDATE', [
          v.id,
        ])
      ).rows[0];
      if (!row) throw new NotFoundException('Capture unavailable.');
      if (v.decision === 'publish') {
        await gate(c);
        if (!this.ops.namedMode || actor === row.actor_id || !v.confirmed)
          throw new ForbiddenException(
            'Different named reviewer must confirm source facts and rights.',
          );
        const raw = await this.raw.read(v.id);
        if (raw.rightsEvidence !== (await gate(c)))
          throw new ConflictException(
            'Permission changed; capture a new edition under current rights.',
          );
        if (
          digest(
            parseEiaSpot(raw.body, v.id, hash(raw.body), raw.retrievedAt),
          ) !== digest(row.receipt)
        )
          throw new ConflictException('Source changed.');
      }
      await c.query(
        'INSERT INTO eia_spot_reviews(request_id,source_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [v.requestId, v.id, actor, v],
      );
      await this.actor(cookie, 'approve', c);
      return v;
    });
  }
}
export async function captureScheduledEiaSpot(
  pool: pg.Pool,
  mongo: MongoClient,
) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const rights = await gate(c),
      setting = (
        await c.query(
          "SELECT enabled FROM research_auto_schedules WHERE source_id='eia-daily-spot' FOR SHARE",
        )
      ).rows[0];
    if (!setting?.enabled)
      throw new ConflictException('Daily source schedule is disabled.');
    await c.query('COMMIT');
    const body = await fetchEiaSpot();
    await c.query('BEGIN');
    if (
      (await gate(c)) !== rights ||
      !(
        await c.query(
          "SELECT enabled FROM research_auto_schedules WHERE source_id='eia-daily-spot' FOR SHARE",
        )
      ).rows[0]?.enabled
    )
      throw new ConflictException('Daily source permission changed.');
    const fingerprint = hash(body);
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      'eia-spot:' + fingerprint,
    ]);
    const matches = (
      await c.query(
        "SELECT id FROM eia_spot_sources WHERE receipt->>'bodyHash'=$1",
        [fingerprint],
      )
    ).rows;
    for (const old of matches) {
      const original = await mongo
        .db()
        .collection<Raw>('eia_spot_raw')
        .findOne({ _id: old.id });
      if (original?.rightsEvidence === rights) {
        await c.query('COMMIT');
        return fingerprint;
      }
    }
    await retain(
      c,
      mongo,
      { requestId: randomUUID(), body },
      'scheduled-eia-spot',
      rights,
    );
    await c.query('COMMIT');
    return fingerprint;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
