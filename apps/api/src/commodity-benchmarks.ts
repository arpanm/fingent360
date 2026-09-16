import { createHash, randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import type pg from 'pg';
import { z } from 'zod';
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Param,
  Headers,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CommodityCaptureSchema,
  CommodityReviewSchema,
  CommodityReceiptSchema,
  CommodityQueueSchema,
  CommodityPublicSchema,
  parseCommodityWorkbook,
  OIL_BENCHMARK_URL,
  OIL_BENCHMARK_TERMS,
  OIL_BENCHMARK_LICENSE,
} from '@fingent360/contracts';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import {
  fetchOilBenchmarks,
  oilReceiptHash,
} from './oil-benchmark-provider.js';
import { canonicalSourceJson } from './canonical-source-json.js';
import type { AppConfig } from './config.js';
const RAW = Symbol('COMMODITY_RAW'),
  hash = (v: string | Uint8Array) =>
    createHash('sha256').update(v).digest('hex'),
  fingerprint = (v: unknown) => hash(canonicalSourceJson(v));
const RawSchema = z.strictObject({
  _id: z.uuid(),
  body: z.string().max(4000000),
  bodyHash: z.string(),
  retainedAt: z.iso.datetime(),
  retrievedAt: z.iso.datetime().nullable(),
  rightsEvidence: z.string(),
  acquisition: z.enum(['official-download', 'operator-upload']),
});
function bytes(body: string) {
  const value = Buffer.from(body, 'base64');
  if (
    !value.length ||
    value.length > 3000000 ||
    value.toString('base64') !== body
  )
    throw new BadRequestException(
      'Retain a canonical base64 XLSX under three MB.',
    );
  return value;
}
class CommodityRaw {
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await this.mongo.close();
  }
  async retain(value: z.infer<typeof RawSchema>) {
    await this.mongo
      .db()
      .collection<z.infer<typeof RawSchema>>('commodity_raw')
      .updateOne({ _id: value._id }, { $setOnInsert: value }, { upsert: true });
  }
  async read(id: string) {
    const raw = RawSchema.parse(
      await this.mongo
        .db()
        .collection<z.infer<typeof RawSchema>>('commodity_raw')
        .findOne({ _id: id }, { maxTimeMS: 2500 }),
    );
    if (hash(bytes(raw.body)) !== raw.bodyHash)
      throw new ServiceUnavailableException('Retained workbook hash mismatch.');
    return raw;
  }
}
export const commodityProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new CommodityRaw(config),
});
function receipt(raw: z.infer<typeof RawSchema>) {
  const parsed = parseCommodityWorkbook(bytes(raw.body));
  return CommodityReceiptSchema.parse({
    id: raw._id,
    sourceUrl: OIL_BENCHMARK_URL,
    termsUrl: OIL_BENCHMARK_TERMS,
    license: OIL_BENCHMARK_LICENSE,
    attribution:
      'World Bank: Commodity Prices — History and Projections (Pink Sheet); original data providers identified in the retained workbook.',
    parser: 'world-bank-pink-sheet-metals-v1',
    bodyHash: raw.bodyHash,
    retainedAt: raw.retainedAt,
    retrievedAt: raw.retrievedAt,
    acquisition: raw.acquisition,
    reportedUpdatedOn: parsed.reportedUpdatedOn,
    frequency: 'monthly',
    vintageBasis: 'retained-revision-only',
    observations: parsed.observations,
  });
}
@OperatorRead()
@Controller('ops/commodity-benchmarks')
export class CommodityOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: CommodityRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const result = await this.ops.permission(cookie, permission, c);
    return typeof result === 'string' ? result : result.identity.id;
  }
  @Get() async queue(
    @Headers('cookie') cookie?: string,
    @Query('after') after?: string,
  ) {
    await this.actor(cookie, 'read');
    if (after !== undefined && !z.uuid().safeParse(after).success)
      throw new BadRequestException('Invalid capture cursor.');
    return this.store.transaction(async (c) => {
      if (
        after &&
        !(
          await c.query('SELECT id FROM commodity_sources WHERE id=$1', [after])
        ).rows.length
      ) {
        await this.actor(cookie, 'read', c);
        throw new NotFoundException('Capture cursor no longer exists.');
      }
      const rows = await c.query(
        "SELECT s.id,s.receipt,s.error,CASE WHEN s.error IS NOT NULL THEN 'quarantined' ELSE COALESCE((SELECT payload->>'decision' FROM commodity_reviews WHERE source_id=s.id ORDER BY seq DESC LIMIT 1),'draft') END AS state FROM commodity_sources s WHERE ($1::uuid IS NULL OR (s.created_at,s.id)<(SELECT created_at,id FROM commodity_sources WHERE id=$1)) ORDER BY created_at DESC,id DESC LIMIT 21",
        [after ?? null],
      );
      await this.actor(cookie, 'read', c);
      return CommodityQueueSchema.parse({
        items: rows.rows.slice(0, 20),
        next: rows.rows.length > 20 ? rows.rows[19].id : null,
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
    const value = await this.raw.read(id);
    await this.actor(cookie, 'read');
    return {
      id: value._id,
      sourceUrl: OIL_BENCHMARK_URL,
      body: value.body,
      bodyHash: value.bodyHash,
      encoding: 'base64',
      retainedAt: value.retainedAt,
      rightsEvidence: value.rightsEvidence,
    };
  }
  @Post('capture') @OperatorAction('prepare') async capture(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = CommodityCaptureSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Record source retention/display/offline rights before capture.',
      );
    const input = parsed.data;
    await this.actor(cookie, 'prepare');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'commodity-capture:' + input.requestId,
      ]);
      const actor = await this.actor(cookie, 'prepare', c),
        prior = (
          await c.query(
            'SELECT fingerprint,error FROM commodity_sources WHERE id=$1',
            [input.requestId],
          )
        ).rows[0];
      if (prior) {
        if (prior.fingerprint !== fingerprint(input))
          throw new ConflictException(
            'Capture ID reused for different original input.',
          );
        await this.actor(cookie, 'prepare', c);
        return {
          id: input.requestId,
          state: prior.error ? 'quarantined' : 'draft',
        };
      }
      const downloaded = input.body ? null : await fetchOilBenchmarks(),
        content = input.body ?? downloaded!.body,
        original = RawSchema.parse({
          _id: input.requestId,
          body: content,
          bodyHash: hash(bytes(content)),
          retainedAt: new Date().toISOString(),
          retrievedAt: downloaded?.retrievedAt ?? null,
          rightsEvidence: input.rightsEvidence,
          acquisition: downloaded ? 'official-download' : 'operator-upload',
        });
      await this.raw.retain(original);
      let result: ReturnType<typeof CommodityReceiptSchema.parse> | null = null,
        error: string | null = null;
      try {
        result = receipt(original);
      } catch (cause) {
        error = (
          cause instanceof Error
            ? cause.message
            : 'Unsupported original workbook.'
        ).slice(0, 2000);
      }
      await c.query(
        'INSERT INTO commodity_sources(id,actor_id,fingerprint,body_hash,receipt,error) VALUES($1,$2,$3,$4,$5,$6)',
        [
          input.requestId,
          actor,
          fingerprint(input),
          original.bodyHash,
          result,
          error,
        ],
      );
      await this.actor(cookie, 'prepare', c);
      return { id: input.requestId, state: error ? 'quarantined' : 'draft' };
    });
  }
  @Post('review') @OperatorAction('approve') async review(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = CommodityReviewSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Complete source review.');
    const input = parsed.data;
    await this.actor(cookie, 'approve');
    return this.store.transaction(async (c) => {
      await c.query('SELECT id FROM commodity_gate WHERE id=true FOR UPDATE');
      const actor = await this.actor(cookie, 'approve', c),
        old = (
          await c.query(
            'SELECT payload,actor_id FROM commodity_reviews WHERE request_id=$1',
            [input.requestId],
          )
        ).rows[0];
      if (old) {
        if (
          old.actor_id !== actor ||
          fingerprint(old.payload) !== fingerprint(input)
        )
          throw new ConflictException('Review request ID reused.');
        await this.actor(cookie, 'approve', c);
        return input;
      }
      const row = (
        await c.query('SELECT * FROM commodity_sources WHERE id=$1', [input.id])
      ).rows[0];
      if (!row?.receipt)
        throw new NotFoundException('Supported source capture unavailable.');
      if (input.decision === 'publish') {
        if (
          !this.ops.namedMode ||
          actor === row.actor_id ||
          !input.rightsVerified
        )
          throw new ForbiddenException(
            'A different named reviewer must verify original and distribution rights.',
          );
        const original = await this.raw.read(input.id);
        if (
          fingerprint(receipt(original)) !==
          fingerprint(CommodityReceiptSchema.parse(row.receipt))
        )
          throw new ConflictException(
            'Stored values do not reconstruct from original.',
          );
      }
      await c.query(
        'INSERT INTO commodity_reviews(request_id,source_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, input.id, actor, input],
      );
      if (input.decision === 'publish')
        await c.query('UPDATE commodity_gate SET source_id=$1 WHERE id=true', [
          input.id,
        ]);
      else
        await c.query(
          'UPDATE commodity_gate SET source_id=NULL WHERE id=true AND source_id=$1',
          [input.id],
        );
      await this.actor(cookie, 'approve', c);
      return input;
    });
  }
}
@Controller('commodity-benchmarks')
export class CommodityPublicController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(RAW) private readonly raw: CommodityRaw,
  ) {}
  @Get() async current(@Query('edition') edition?: string) {
    if (edition !== undefined && !z.uuid().safeParse(edition).success)
      throw new BadRequestException('Invalid edition.');
    return this.store.transaction(async (c) => {
      const gate = (
        await c.query(
          'SELECT source_id FROM commodity_gate WHERE id=true FOR SHARE',
        )
      ).rows[0];
      if (!gate?.source_id)
        throw new NotFoundException('No currently admitted commodity edition.');
      const id = edition ?? gate.source_id,
        row = (
          await c.query(
            "SELECT s.receipt,r.reviewed_at FROM commodity_sources s JOIN LATERAL(SELECT payload,reviewed_at FROM commodity_reviews WHERE source_id=s.id ORDER BY seq DESC LIMIT 1)r ON true WHERE s.id=$1 AND r.payload->>'decision'='publish'",
            [id],
          )
        ).rows[0];
      if (!row)
        throw new NotFoundException('Edition unavailable or withdrawn.');
      const parsed = CommodityReceiptSchema.parse(row.receipt),
        original = await this.raw.read(id);
      if (original.bodyHash !== parsed.bodyHash)
        throw new ServiceUnavailableException('Original evidence unavailable.');
      const editions = (
        await c.query(
          "SELECT s.id FROM commodity_sources s JOIN LATERAL(SELECT payload FROM commodity_reviews WHERE source_id=s.id ORDER BY seq DESC LIMIT 1)r ON true WHERE r.payload->>'decision'='publish' ORDER BY s.created_at DESC,s.id LIMIT 100",
        )
      ).rows.map((r) => r.id);
      return CommodityPublicSchema.parse({
        receipt: parsed,
        reviewedAt: row.reviewed_at.toISOString(),
        editions,
      });
    });
  }
  @Get(':id/evidence') async evidence(@Param('id') id: string) {
    return this.store.transaction(async (c) => {
      const gate = (
        await c.query(
          'SELECT source_id FROM commodity_gate WHERE id=true FOR SHARE',
        )
      ).rows[0];
      if (!gate?.source_id || !z.uuid().safeParse(id).success)
        throw new NotFoundException('Original unavailable.');
      const row = (
        await c.query(
          'SELECT payload FROM commodity_reviews WHERE source_id=$1 ORDER BY seq DESC LIMIT 1',
          [id],
        )
      ).rows[0];
      if (row?.payload.decision !== 'publish')
        throw new NotFoundException('Original withdrawn.');
      const original = await this.raw.read(id);
      return {
        id,
        sourceUrl: OIL_BENCHMARK_URL,
        body: original.body,
        bodyHash: original.bodyHash,
        encoding: 'base64',
        retainedAt: original.retainedAt,
      };
    });
  }
}
/** Existing research worker owns scheduling; this function never publishes an edition. */
export async function captureScheduledCommodities(
  pool: pg.Pool,
  mongo: MongoClient,
  fetchSource = fetchOilBenchmarks,
) {
  const before = (
    await pool.query(
      "SELECT s.enabled,g.rights_evidence FROM research_auto_schedules s CROSS JOIN commodity_gate g WHERE s.source_id='commodity-benchmarks' AND g.id=true",
    )
  ).rows[0];
  if (!before?.enabled || !before.rights_evidence)
    throw new ConflictException(
      'Commodity automation is disabled or rights are missing.',
    );
  const downloaded = await fetchSource();
  if (
    downloaded.url !== OIL_BENCHMARK_URL ||
    oilReceiptHash(downloaded) !== downloaded.hash
  )
    throw new ConflictException('Original download provenance mismatch.');
  const content = bytes(downloaded.body),
    bodyHash = hash(content);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const rights = (
        await c.query(
          'SELECT rights_evidence FROM commodity_gate WHERE id=true FOR SHARE',
        )
      ).rows[0]?.rights_evidence,
      setting = (
        await c.query(
          "SELECT enabled FROM research_auto_schedules WHERE source_id='commodity-benchmarks' FOR SHARE",
        )
      ).rows[0];
    if (!setting?.enabled || rights !== before.rights_evidence)
      throw new ConflictException(
        'Commodity automation permission changed during acquisition.',
      );
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      'commodity-auto:' + bodyHash,
    ]);
    const prior = (
      await c.query(
        'SELECT body_hash FROM commodity_sources WHERE body_hash=$1 ORDER BY created_at LIMIT 1',
        [bodyHash],
      )
    ).rows[0];
    if (prior) {
      await c.query('COMMIT');
      return bodyHash;
    }
    const id = randomUUID(),
      raw = RawSchema.parse({
        _id: id,
        body: downloaded.body,
        bodyHash,
        retainedAt: new Date().toISOString(),
        retrievedAt: downloaded.retrievedAt,
        rightsEvidence: rights,
        acquisition: 'official-download',
      });
    await mongo
      .db()
      .collection<z.infer<typeof RawSchema>>('commodity_raw')
      .updateOne({ _id: id }, { $setOnInsert: raw }, { upsert: true });
    let parsed: ReturnType<typeof CommodityReceiptSchema.parse> | null = null,
      error: string | null = null;
    try {
      parsed = receipt(raw);
    } catch (cause) {
      error = (
        cause instanceof Error
          ? cause.message
          : 'Unsupported commodity source layout.'
      ).slice(0, 2000);
    }
    await c.query(
      'INSERT INTO commodity_sources(id,actor_id,fingerprint,body_hash,receipt,error) VALUES($1,$2,$3,$4,$5,$6)',
      [
        id,
        'scheduled-commodity-capture',
        fingerprint({ source: 'commodity-benchmarks', bodyHash, rights }),
        bodyHash,
        parsed,
        error,
      ],
    );
    await c.query('COMMIT');
    return bodyHash;
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release();
  }
}
