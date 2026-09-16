import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Inject,
  Param,
  Query,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import type pg from 'pg';
import {
  GdpExpectationInputSchema,
  GdpExpectationEditionSchema,
  GdpExpectationReviewSchema,
  GdpExpectationQueueSchema,
  GdpExpectationPublicSchema,
  parseSpfGdp,
  publicBeaGdpSeries,
  compareGdpExpectation,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { admitPublications } from './publication.js';
import { canonicalSourceJson } from './canonical-source-json.js';
import { sourceHash } from './discovery-provider.js';
import type { AppConfig } from './config.js';
const RAW = Symbol('GDP_EXPECTATION_RAW');
const digest = (value: unknown) =>
  createHash('sha256').update(canonicalSourceJson(value)).digest('hex');
class GdpExpectationRaw {
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await this.mongo.close();
  }
  async retain(url: string, body: string, retrievedAt: string) {
    const hash = sourceHash(url, body);
    await this.mongo
      .db()
      .collection<{
        _id: string;
        url: string;
        body: string;
        retrievedAt: string;
      }>('gdp_expectation_raw')
      .updateOne(
        { _id: hash },
        { $setOnInsert: { url, body, retrievedAt } },
        { upsert: true },
      );
    return hash;
  }
  async read(hash: string) {
    return this.mongo
      .db()
      .collection<{
        _id: string;
        url: string;
        body: string;
        retrievedAt: string;
      }>('gdp_expectation_raw')
      .findOne({ _id: hash });
  }
}
export const gdpExpectationProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new GdpExpectationRaw(config),
});
function input<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      'Complete the original report and rights fields.',
    );
  return result.data;
}
@Controller('gdp-expectations')
export class GdpExpectationsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() read() {
    return this.store.transaction(async (c) => {
      await c.query('LOCK TABLE gdp_expectation_reviews IN SHARE MODE');
      const rows = await c.query(
        "SELECT e.payload,(SELECT created_at FROM gdp_expectation_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1) AS reviewed_at FROM gdp_expectation_editions e WHERE (SELECT decision FROM gdp_expectation_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY e.created_at DESC,e.id LIMIT 101",
      );
      if (rows.rows.length > 100)
        throw new ConflictException(
          'GDP snapshot limit reached. Withdraw obsolete editions before publishing more.',
        );
      const items = await admitPublications(c),
        actuals = publicBeaGdpSeries(items, new Date().toISOString());
      const response = GdpExpectationPublicSchema.parse({
        capturedAt: actuals.capturedAt,
        actuals,
        expectations: rows.rows.map((row) => {
          const edition = GdpExpectationEditionSchema.parse(row.payload);
          return {
            id: edition.id,
            expectation: edition.expectation,
            reviewedAt: new Date(row.reviewed_at).toISOString(),
          };
        }),
      });
      const comparisons = response.expectations.flatMap((e) =>
        response.actuals.items
          .filter((a) => a.original.period === e.expectation.period)
          .map((a) => ({
            expectationId: e.id,
            actualItemId: a.itemId,
            actualVersion: a.version,
            result: compareGdpExpectation(
              e.expectation,
              a.original,
              e.reviewedAt,
            ),
          })),
      );
      const view = {
        expectations: response.expectations,
        actuals: response.actuals.items,
        comparisons,
      };
      await c.query(
        'INSERT INTO gdp_expectation_views(hash,payload) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [digest(view), view],
      );
      return response;
    });
  }
}
@Controller('ops/gdp-expectations')
export class GdpExpectationOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: GdpExpectationRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    action: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const actor = await this.ops.permission(cookie, action, c);
    return typeof actor === 'string' ? actor : actor.identity.id;
  }
  @OperatorRead() @Get() queue(
    @Headers('cookie') cookie?: string,
    @Query('after') after?: string,
  ) {
    const parts = after?.split('|');
    if (
      parts &&
      (parts.length !== 2 ||
        !z.iso.datetime().safeParse(parts[0]).success ||
        !z.uuid().safeParse(parts[1]).success)
    )
      throw new BadRequestException('Invalid expectation queue cursor.');
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const rows = await c.query(
        `SELECT id,payload,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_at,COALESCE((SELECT CASE decision WHEN 'publish' THEN 'published' ELSE 'withdrawn' END FROM gdp_expectation_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1),'draft') AS state FROM gdp_expectation_editions e WHERE ($1::timestamptz IS NULL OR (created_at,id)<($1::timestamptz,$2::uuid)) ORDER BY created_at DESC,id DESC LIMIT 26`,
        [parts?.[0] ?? null, parts?.[1] ?? null],
      );
      const page = rows.rows.slice(0, 25),
        result = GdpExpectationQueueSchema.parse({
          editions: page.map((row) => ({
            edition: row.payload,
            state: row.state,
          })),
          nextCursor:
            rows.rows.length > 25 ? page[24].page_at + '|' + page[24].id : null,
        });
      await this.actor(cookie, 'read', c);
      return result;
    });
  }
  @OperatorRead() @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    input(z.uuid(), id);
    await this.actor(cookie, 'read');
    const edition = await this.store.transaction(async (c) => {
      const row = await c.query(
        'SELECT payload FROM gdp_expectation_editions WHERE id=$1',
        [id],
      );
      await this.actor(cookie, 'read', c);
      return row.rows[0]?.payload;
    });
    if (!edition) throw new NotFoundException('Expectation unavailable.');
    const raw = await this.raw.read(edition.expectation.hash);
    await this.actor(cookie, 'read');
    if (!raw || sourceHash(raw.url, raw.body) !== edition.expectation.hash)
      throw new ConflictException('Original expectation source changed.');
    return { body: raw.body, hash: raw._id, url: raw.url };
  }
  @OperatorAction('prepare') @Post('import') async capture(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.retain(input(GdpExpectationInputSchema, body), cookie);
  }
  @OperatorAction('prepare') @Post('fetch') async fetchReport(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    await this.actor(cookie, 'prepare');
    const data = input(GdpExpectationInputSchema.omit({ body: true }), body);
    const old = await this.store.transaction(async (c) => {
      const rows = await c.query(
        'SELECT payload FROM gdp_expectation_editions WHERE id=$1',
        [data.requestId],
      );
      await this.actor(cookie, 'prepare', c);
      return rows.rows[0]?.payload;
    });
    if (old) {
      const edition = GdpExpectationEditionSchema.parse(old);
      if (
        edition.expectation.url !== data.url ||
        edition.rightsBasis !== data.rightsBasis
      )
        throw new ConflictException('Fetch ID reused with changed metadata.');
      return edition;
    }
    const response = await fetch(data.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
      headers: { Accept: 'text/html' },
    });
    if (!response.ok || !response.body)
      throw new ServiceUnavailableException('Original SPF report unavailable.');
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 2000000)
          throw new BadRequestException('SPF report exceeds 2 MB.');
        chunks.push(part.value);
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
    );
  }
  private async retain(
    data: z.infer<typeof GdpExpectationInputSchema>,
    cookie?: string,
  ) {
    const actor = await this.actor(cookie, 'prepare'),
      retrievedAt = new Date().toISOString(),
      hash = await this.raw.retain(data.url, data.body, retrievedAt);
    let expectation;
    try {
      expectation = parseSpfGdp({
        url: data.url,
        body: data.body,
        hash,
        retrievedAt,
      });
    } catch {
      throw new BadRequestException(
        'Retained report does not match the verified SPF quarterly GDP layout.',
      );
    }
    const edition = GdpExpectationEditionSchema.parse({
        id: data.requestId,
        expectation,
        rightsBasis: data.rightsBasis,
        capturedBy: actor,
      }),
      fingerprint = digest(data);
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        data.requestId,
      ]);
      const old = await c.query(
        'SELECT fingerprint,payload FROM gdp_expectation_editions WHERE id=$1',
        [data.requestId],
      );
      await this.actor(cookie, 'prepare', c);
      if (old.rows[0]) {
        if (old.rows[0].fingerprint !== fingerprint)
          throw new ConflictException('Capture ID reused with changed source.');
        return GdpExpectationEditionSchema.parse(old.rows[0].payload);
      }
      await c.query(
        'INSERT INTO gdp_expectation_editions(id,fingerprint,payload) VALUES($1,$2,$3)',
        [edition.id, fingerprint, edition],
      );
      await this.actor(cookie, 'prepare', c);
      return edition;
    });
  }
  @OperatorAction('approve') @Post('review') review(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    const data = input(GdpExpectationReviewSchema, body);
    return this.store.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        data.requestId,
      ]);
      const old = await c.query(
        'SELECT edition_id,decision,reason FROM gdp_expectation_reviews WHERE request_id=$1',
        [data.requestId],
      );
      if (old.rows[0]) {
        await this.actor(cookie, 'approve', c);
        if (
          old.rows[0].edition_id !== data.editionId ||
          old.rows[0].decision !== data.decision ||
          old.rows[0].reason !== data.reason
        )
          throw new ConflictException('Review ID reused.');
        return data;
      }
      const rows = await c.query(
        'SELECT payload FROM gdp_expectation_editions WHERE id=$1 FOR UPDATE',
        [data.editionId],
      );
      if (!rows.rows[0])
        throw new NotFoundException('Expectation unavailable.');
      const edition = GdpExpectationEditionSchema.parse(rows.rows[0].payload);
      if (data.decision === 'publish') {
        if (!this.ops.namedMode || edition.capturedBy === actor)
          throw new ForbiddenException(
            'Another named operator must review the original expectation.',
          );
        const raw = await this.raw.read(edition.expectation.hash);
        if (
          !raw ||
          sourceHash(raw.url, raw.body) !== edition.expectation.hash ||
          digest(
            parseSpfGdp({
              ...raw,
              hash: raw._id,
              retrievedAt: edition.expectation.retrievedAt,
            }),
          ) !== digest(edition.expectation)
        )
          throw new ConflictException(
            'Expectation no longer reconstructs from its retained original.',
          );
      }
      await c.query(
        'INSERT INTO gdp_expectation_reviews(request_id,edition_id,actor_id,decision,reason) VALUES($1,$2,$3,$4,$5)',
        [data.requestId, data.editionId, actor, data.decision, data.reason],
      );
      await this.actor(cookie, 'approve', c);
      return data;
    });
  }
}
