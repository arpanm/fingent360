import { admittedCorporateRating } from './corporate-rating-admission.js';
import {
  decryptBondReceipts,
  encryptBondReceipt,
} from './private-bond-receipts.js';
import type { PrivateDataKeys } from './private-data-crypto.js';
import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Headers,
  Inject,
  Param,
  Query,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  AMFI_NAV_URL,
  AMFI_HISTORY_CATALOG,
  FundNavSchema,
  FundNavCaptureSchema,
  FundNavEditionSchema,
  FundNavQueueSchema,
  FundNavReviewSchema,
  FundsListSchema,
  FundsSnapshotSchema,
  FundDetailSchema,
  parseAmfiNav,
  amfiNavFormat,
  BondComparisonInputSchema,
  BondComparisonsSchema,
  SavedBondComparisonSchema,
  calculateBondComparison,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import type { AppConfig } from './config.js';
import type pg from 'pg';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
function input<T>(schema: z.ZodType<T>, value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException('Invalid funds or bond input.');
  return parsed.data;
}
const admitted =
  "(SELECT decision FROM fund_nav_reviews r WHERE r.edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish'";
const currentSql = `SELECT DISTINCT ON(o.scheme_code) o.scheme_code,o.payload AS observation,e.payload-'permissionReference' AS edition FROM fund_nav_observations o JOIN fund_nav_editions e ON e.id=o.edition_id WHERE ${admitted} ORDER BY o.scheme_code,o.observed_on DESC,e.created_at DESC,e.id`;
export const FUNDS_RAW = Symbol('FUNDS_RAW');
export class FundsRawStore {
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await this.mongo.close();
  }
  async retain(hash: string, body: string, retrievedAt: string) {
    try {
      await this.mongo
        .db()
        .collection<{ _id: string; body: string; retrievedAt: string }>(
          'fund_nav_raw',
        )
        .updateOne(
          { _id: hash },
          { $setOnInsert: { body, retrievedAt } },
          { upsert: true },
        );
    } catch {
      throw new ServiceUnavailableException(
        'NAV source retention unavailable.',
      );
    }
  }
  async read(hash: string) {
    return this.mongo
      .db()
      .collection<{ _id: string; body: string }>('fund_nav_raw')
      .findOne({ _id: hash });
  }
}
export function fundsBondsProvider(config: AppConfig) {
  return { provide: FUNDS_RAW, useValue: new FundsRawStore(config) };
}
@Controller('funds')
export class FundsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() list(@Query('q') q?: string, @Query('after') after?: string) {
    if (q !== undefined) input(z.string().max(100), q);
    if (after !== undefined) input(z.string().regex(/^[0-9]{5,8}$/), after);
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        `SELECT * FROM (${currentSql}) current WHERE ($1::text IS NULL OR scheme_code>$1) AND ($2::text IS NULL OR position(lower($2) in lower((observation->>'name')||' '||(observation->>'amc')||' '||coalesce(observation->>'plan','')||' '||coalesce(observation->>'option','')||' '||scheme_code))>0) ORDER BY scheme_code LIMIT 51`,
        [after ?? null, q?.trim() || null],
      );
      return FundsListSchema.parse({
        funds: rows.rows
          .slice(0, 50)
          .map((r) => ({ observation: r.observation, edition: r.edition })),
        nextAfter: rows.rows.length > 50 ? rows.rows[49].scheme_code : null,
      });
    });
  }
  @Get('snapshot') snapshot() {
    return this.store.transaction(async (c) => {
      await c.query('LOCK TABLE fund_nav_reviews IN SHARE MODE');
      const rows = await c.query(
        `SELECT *,count(*) OVER()::integer AS total FROM (${currentSql}) current ORDER BY scheme_code LIMIT 5000`,
      );
      const total = rows.rows[0]?.total ?? 0;
      const history = await c.query(
        `SELECT o.payload AS observation,e.payload-'permissionReference' AS edition FROM fund_nav_observations o JOIN fund_nav_editions e ON e.id=o.edition_id WHERE o.scheme_code=ANY($1::text[]) AND ${admitted} ORDER BY o.observed_on DESC,e.created_at DESC,e.id,o.scheme_code LIMIT 5001`,
        [rows.rows.map((row) => row.scheme_code)],
      );
      return FundsSnapshotSchema.parse({
        capturedAt: new Date().toISOString(),
        funds: rows.rows.map((r) => ({
          observation: r.observation,
          edition: r.edition,
        })),
        history: history.rows.slice(0, 5000),
        historyTruncated: history.rows.length > 5000,
        totalSchemeCount: total,
        truncated: total > rows.rows.length,
      });
    });
  }
  @Get(':code') detail(@Param('code') code: string) {
    input(z.string().regex(/^[0-9]{5,8}$/), code);
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        `SELECT o.payload AS observation,e.payload-'permissionReference' AS edition FROM fund_nav_observations o JOIN fund_nav_editions e ON e.id=o.edition_id WHERE o.scheme_code=$1 AND ${admitted} ORDER BY o.observed_on DESC,e.created_at DESC,e.id LIMIT 501`,
        [code],
      );
      if (!rows.rowCount)
        throw new NotFoundException('No reviewed NAV evidence is available.');
      return FundDetailSchema.parse({
        schemeCode: code,
        history: rows.rows.slice(0, 500),
        lookThrough: 'not-connected',
        truncated: rows.rows.length > 500,
      });
    });
  }
}
@OperatorRead()
@Controller('ops/funds')
export class OpsFundsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(FUNDS_RAW) private readonly raw: FundsRawStore,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const value = await this.ops.permission(cookie, permission, c);
    return typeof value === 'string' ? value : value.identity.id;
  }
  @Get() queue(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const rows = await c.query(
        "SELECT e.payload AS edition,COALESCE((SELECT CASE decision WHEN 'publish' THEN 'published' ELSE 'withdrawn' END FROM fund_nav_reviews r WHERE r.edition_id=e.id ORDER BY seq DESC LIMIT 1),'draft') AS state FROM fund_nav_editions e ORDER BY e.created_at DESC,e.id LIMIT 30",
      );
      await this.actor(cookie, 'read', c);
      return FundNavQueueSchema.parse({ editions: rows.rows });
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    input(z.uuid(), id);
    await this.actor(cookie, 'read');
    const edition = await this.store.transaction(async (c) => {
      const row = await c.query(
        'SELECT payload FROM fund_nav_editions WHERE id=$1',
        [id],
      );
      return row.rows[0]?.payload;
    });
    if (!edition) throw new NotFoundException('NAV edition unavailable.');
    const raw = await this.raw.read(edition.hash);
    await this.actor(cookie, 'read');
    if (!raw || sha(raw.body) !== edition.hash)
      throw new ServiceUnavailableException(
        'Retained NAV source is unavailable or changed.',
      );
    return { editionId: id, hash: edition.hash, body: raw.body };
  }
  @OperatorAction('prepare') @Post('import') async capture(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.retain(input(FundNavCaptureSchema, body), cookie);
  }
  @OperatorAction('prepare') @Post('fetch') async fetchSource(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    await this.actor(cookie, 'prepare');
    const data = input(FundNavCaptureSchema.omit({ body: true }), body);
    const old = await this.store.transaction(async (c) => {
      const r = await c.query(
        'SELECT payload FROM fund_nav_editions WHERE id=$1',
        [data.requestId],
      );
      await this.actor(cookie, 'prepare', c);
      return r.rows[0]?.payload;
    });
    if (old) {
      const edition = FundNavEditionSchema.parse(old);
      if (
        edition.permissionReference !== data.permissionReference ||
        edition.sourceUrl !== (data.sourceUrl ?? AMFI_NAV_URL)
      )
        throw new ConflictException(
          'Request ID reused with different permission.',
        );
      return edition;
    }
    const sourceUrl = data.sourceUrl ?? AMFI_NAV_URL;
    const response = await fetch(sourceUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: { Accept: 'text/plain' },
    });
    if (
      !response.ok ||
      !response.body ||
      /html/i.test(response.headers.get('content-type') ?? '')
    )
      throw new ServiceUnavailableException(
        'AMFI NAV text is unavailable. No fallback or challenge bypass was attempted.',
      );
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4000000)
          throw new BadRequestException('AMFI source exceeds 4 MB.');
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    return this.retain(
      {
        ...data,
        body: new TextDecoder('utf-8', { fatal: true }).decode(
          Buffer.concat(chunks),
        ),
      },
      cookie,
      sourceUrl,
    );
  }
  private async retain(
    data: z.infer<typeof FundNavCaptureSchema>,
    cookie?: string,
    fetchedFrom?: string,
  ) {
    const actor = await this.actor(cookie, 'prepare'),
      hash = sha(data.body),
      fingerprint = sha(JSON.stringify(data)),
      retrievedAt = new Date().toISOString();
    await this.raw.retain(hash, data.body, retrievedAt);
    let rows;
    try {
      rows = parseAmfiNav(data.body, data.sourceUrl);
    } catch {
      throw new BadRequestException(
        'Retained AMFI source does not match the documented parser.',
      );
    }
    if (rows.some((r) => r.observedOn > retrievedAt.slice(0, 10)))
      throw new BadRequestException('Future NAV dates are not accepted.');
    const edition = FundNavEditionSchema.parse({
      id: data.requestId,
      sourceUrl:
        fetchedFrom ?? data.sourceUrl ?? amfiNavFormat(data.body).sourceUrl,
      hash,
      retrievedAt,
      permissionReference: data.permissionReference,
      count: rows.length,
      parser: amfiNavFormat(data.body).parser,
      ...(data.sourceUrl
        ? {
            historyCatalog: {
              version: AMFI_HISTORY_CATALOG.version,
              observedOn: AMFI_HISTORY_CATALOG.observedOn,
              sourceUrl: AMFI_HISTORY_CATALOG.sourceUrl,
              sourceHash: AMFI_HISTORY_CATALOG.sourceHash,
            },
          }
        : {}),
    });
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        data.requestId,
      ]);
      const old = await c.query(
        'SELECT fingerprint,payload FROM fund_nav_editions WHERE id=$1',
        [data.requestId],
      );
      if (old.rows[0]) {
        await this.actor(cookie, 'prepare', c);
        if (old.rows[0].fingerprint !== fingerprint)
          throw new ConflictException('Capture ID already used.');
        return FundNavEditionSchema.parse(old.rows[0].payload);
      }
      await c.query(
        'INSERT INTO fund_nav_editions(id,fingerprint,actor_id,payload) VALUES($1,$2,$3,$4)',
        [data.requestId, fingerprint, actor, edition],
      );
      await c.query(
        "INSERT INTO fund_nav_observations(edition_id,scheme_code,observed_on,payload) SELECT $1,value->>'schemeCode',(value->>'observedOn')::date,value FROM jsonb_array_elements($2::jsonb)",
        [data.requestId, JSON.stringify(rows)],
      );
      await this.actor(cookie, 'prepare', c);
      return edition;
    });
  }
  @OperatorAction('approve') @Post('review') async review(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    const data = input(FundNavReviewSchema, body);
    await this.actor(cookie, 'approve');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        data.requestId,
      ]);
      const rows = await c.query(
        'SELECT actor_id,payload FROM fund_nav_editions WHERE id=$1 FOR UPDATE',
        [data.editionId],
      );
      if (!rows.rows[0])
        throw new NotFoundException('NAV edition unavailable.');
      const actor = await this.actor(cookie, 'approve', c);
      const previous = await c.query(
        'SELECT edition_id,decision,reason FROM fund_nav_reviews WHERE request_id=$1',
        [data.requestId],
      );
      if (previous.rows[0]) {
        const row = previous.rows[0];
        if (
          row.edition_id !== data.editionId ||
          row.decision !== data.decision ||
          row.reason !== data.reason
        )
          throw new ConflictException('Review ID already used.');
        return data;
      }
      if (
        data.decision === 'publish' &&
        this.ops.namedMode &&
        rows.rows[0].actor_id === actor
      )
        throw new ForbiddenException(
          'Another named operator must review this NAV edition.',
        );
      if (data.decision === 'publish') {
        const parsedEdition = FundNavEditionSchema.parse(rows.rows[0].payload);
        if (parsedEdition.parser === 'amfi-history-v1' && !this.ops.namedMode)
          throw new ForbiddenException(
            'Historical NAV publication requires independent named review.',
          );
        const raw = await this.raw.read(rows.rows[0].payload.hash);
        if (!raw || sha(raw.body) !== rows.rows[0].payload.hash)
          throw new ConflictException(
            'Original NAV source is missing or changed.',
          );
        if (parsedEdition.parser === 'amfi-history-v1') {
          const original = parseAmfiNav(raw.body, parsedEdition.sourceUrl);
          const stored = await c.query(
            "SELECT payload FROM fund_nav_observations WHERE edition_id=$1 ORDER BY (payload->>'sourceRow')::integer",
            [data.editionId],
          );
          if (
            original.length !== parsedEdition.count ||
            JSON.stringify(original) !==
              JSON.stringify(
                stored.rows.map((row) => FundNavSchema.parse(row.payload)),
              )
          )
            throw new ConflictException(
              'Historical NAV observations no longer match retained source.',
            );
        }
      }
      await c.query(
        'INSERT INTO fund_nav_reviews(request_id,edition_id,actor_id,decision,reason) VALUES($1,$2,$3,$4,$5)',
        [data.requestId, data.editionId, actor, data.decision, data.reason],
      );
      await this.actor(cookie, 'approve', c);
      return data;
    });
  }
}
export async function exportBondComparisons(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
) {
  const rows = await c.query(
    'SELECT * FROM app_bond_comparisons WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC,id LIMIT 100',
    [userId],
  );
  await decryptBondReceipts(c, userId, rows.rows, keys);
  return BondComparisonsSchema.parse({
    comparisons: rows.rows.map((r) => r.payload),
  });
}
@Controller('account/bond-comparisons')
export class BondComparisonsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  private async owner(c: pg.PoolClient, cookie?: string) {
    const user = await this.store.require(c, cookie);
    await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [user.id]);
    return this.store.require(c, cookie);
  }
  @Get() list(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie),
        result = await exportBondComparisons(
          c,
          user.id,
          this.store.privateDataKeys,
        );
      await this.store.require(c, cookie);
      return result;
    });
  }
  @Put(':id') save(
    @Param('id') rawId: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const id = input(z.uuid(), rawId),
      data = input(BondComparisonInputSchema, body),
      fingerprint = sha(JSON.stringify(data));
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie),
        old = await c.query(
          'SELECT * FROM app_bond_comparisons WHERE user_id=$1 AND id=$2',
          [user.id, id],
        );
      await this.store.require(c, cookie);
      if (old.rows[0]) {
        if (old.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Comparison ID already used with different inputs.',
          );
        if (old.rows[0].deleted_at)
          throw new GoneException(
            'Comparison was removed. Save a new comparison.',
          );
        await decryptBondReceipts(
          c,
          user.id,
          old.rows,
          this.store.privateDataKeys,
        );
        const receipt = SavedBondComparisonSchema.parse(old.rows[0].payload);
        await this.store.require(c, cookie);
        return receipt;
      }
      const rating = data.creditEvidence
        ? await admittedCorporateRating(c, data.creditEvidence.editionId)
        : undefined;
      let result;
      try {
        result = calculateBondComparison(data, rating);
      } catch {
        if (data.creditEvidence)
          throw new ConflictException(
            'Comparison credit evidence is unavailable, withdrawn, outside its historical assessment window, or inputs exceed supported bounds.',
          );
        throw new BadRequestException(
          'Comparison amounts or dates exceed supported bounds.',
        );
      }
      const saved = SavedBondComparisonSchema.parse({
        id,
        createdAt: new Date().toISOString(),
        input: data,
        result,
      });
      const count = await c.query(
        'SELECT count(*)::integer AS count FROM app_bond_comparisons WHERE user_id=$1 AND deleted_at IS NULL',
        [user.id],
      );
      if (count.rows[0].count >= 100)
        throw new ConflictException(
          'Remove a saved comparison before adding more.',
        );
      await c.query(
        'INSERT INTO app_bond_comparisons(user_id,id,fingerprint,encrypted_payload) VALUES($1,$2,$3,$4)',
        [
          user.id,
          id,
          fingerprint,
          encryptBondReceipt(user.id, id, saved, this.store.privateDataKeys),
        ],
      );
      await this.store.require(c, cookie);
      return saved;
    });
  }
  @Delete(':id') remove(
    @Param('id') rawId: string,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const id = input(z.uuid(), rawId);
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const row = await c.query(
        'UPDATE app_bond_comparisons SET payload=NULL,encrypted_payload=NULL,deleted_at=COALESCE(deleted_at,clock_timestamp()) WHERE user_id=$1 AND id=$2 RETURNING id',
        [user.id, id],
      );
      if (!row.rowCount) throw new NotFoundException('Comparison unavailable.');
      await this.store.require(c, cookie);
      return { deleted: true };
    });
  }
}
