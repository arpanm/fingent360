import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import {
  DiscoveryIdSchema,
  DiscoveryReviewSchema,
  DiscoveryRunSchema,
  FeedItemSchema,
  FeedSchema,
  DiscoveryOperationsSchema,
  DiscoveryEvidenceSchema,
  type FeedItem,
} from '@fingent360/contracts';
import type { AppConfig } from './config.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { glossaryItems } from './discovery-provider.js';
import { fetchResearchSource, researchSources } from './research-providers.js';
import {
  enrichResearchItem,
  researchGlossaryItems,
  buildResearchContext,
  ResearchCatalogSchema,
  ResearchRunsSchema,
  ResearchRefreshInputSchema,
  ResearchFiltersSchema,
  researchSelection,
  sourceIdFor,
  type ResearchFilters,
} from '@fingent360/contracts';
import { macroSources, normalizeDecimal } from './world-bank.js';
export const DISCOVERY_STORE = Symbol('DISCOVERY_STORE');
interface VersionRow {
  data: unknown;
}
interface RunRow {
  id: string;
  started_at: Date;
  finished_at: Date | null;
  status: string;
  message: string;
  inserted: number;
}
const run = (r: RunRow) =>
  DiscoveryRunSchema.parse({
    id: r.id,
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
    status: r.status,
    message: r.message,
    inserted: r.inserted,
  });
interface Raw {
  _id: string;
  url: string;
  body: string;
  retrievedAt: string;
}
function validId(id: string) {
  if (!DiscoveryIdSchema.safeParse(id).success)
    throw new BadRequestException('Invalid item ID.');
}
export function discoveryFingerprint(item: FeedItem) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        kind: item.kind,
        title: item.title,
        summary: item.summary,
        body: item.body,
        publishedAt: item.publishedAt,
        effectiveLabel: item.effectiveLabel,
        sourceUrl: item.source.url,
        sourceName: item.source.name,
        sourceRights: item.source.rights,
        topics: item.topics,
        relatedIds: item.relatedIds,
        importance: item.importance,
      }),
    )
    .digest('hex');
}
const DiscoveryCursorSchema = z.strictObject({
  version: z.literal('research-v1'),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  offset: z.number().int().positive().max(1000000),
});
export function discoveryFeedPage(
  items: FeedItem[],
  filters: ResearchFilters,
  cursor?: string,
) {
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        filters: ResearchFiltersSchema.parse(filters),
        order: items.map((item) => [item.id, item.version]),
      }),
    )
    .digest('hex');
  let offset = 0;
  if (cursor !== undefined) {
    let decoded: z.infer<typeof DiscoveryCursorSchema>;
    try {
      if (cursor.length > 256 || !/^[A-Za-z0-9_-]+$/.test(cursor))
        throw Error();
      const bytes = Buffer.from(cursor, 'base64url');
      if (bytes.toString('base64url') !== cursor) throw Error();
      decoded = DiscoveryCursorSchema.parse(JSON.parse(bytes.toString('utf8')));
    } catch {
      throw new BadRequestException(
        'Invalid feed cursor. Start from the first page.',
      );
    }
    if (decoded.fingerprint !== fingerprint)
      throw new ConflictException(
        'Research selection changed. Start from the first page.',
      );
    offset = decoded.offset;
    if (offset % 30 !== 0 || offset >= items.length)
      throw new BadRequestException(
        'Invalid feed cursor. Start from the first page.',
      );
  }
  return {
    items: items.slice(offset, offset + 30),
    nextCursor:
      offset + 30 < items.length
        ? Buffer.from(
            JSON.stringify({
              version: 'research-v1',
              fingerprint,
              offset: offset + 30,
            }),
          ).toString('base64url')
        : null,
  };
}
export class DiscoveryStore {
  private readonly pool: pg.Pool;
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {});
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      maxPoolSize: 3,
    });
  }
  async onApplicationShutdown() {
    await Promise.allSettled([this.pool.end(), this.mongo.close()]);
  }
  private async transaction<T>(work: (c: pg.PoolClient) => Promise<T>) {
    let c: pg.PoolClient | undefined;
    try {
      c = await this.pool.connect();
      await c.query('BEGIN');
      const value = await work(c);
      await c.query('COMMIT');
      return value;
    } catch (error) {
      await c?.query('ROLLBACK').catch(() => {});
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Reading is unavailable right now. Please try again shortly.',
      );
    } finally {
      c?.release();
    }
  }
  async publishedItems() {
    return this.transaction(async (c) => {
      const result = await c.query<VersionRow>(
        "SELECT v.data FROM discovery_items i JOIN LATERAL (SELECT data FROM discovery_versions WHERE item_id=i.id AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1) v ON true WHERE v.data->>'status'='published'",
      );
      return result.rows.map((r) => FeedItemSchema.parse(r.data));
    });
  }
  async feed(
    cursor?: string,
    kind?: string,
    q?: string,
    extra: ResearchFilters = {},
  ) {
    const parsed = ResearchFiltersSchema.safeParse({ ...extra, kind, q });
    if (!parsed.success)
      throw new BadRequestException('Invalid research filters.');
    const filters = parsed.data;
    const all = researchSelection(await this.publishedItems(), filters),
      page = discoveryFeedPage(all, filters, cursor);
    return FeedSchema.parse({ ...page, evaluatedAt: new Date().toISOString() });
  }
  async context(id: string) {
    const item = await this.item(id);
    if (item.status !== 'published')
      throw new NotFoundException('Published context unavailable.');
    return buildResearchContext(item, await this.publishedItems());
  }
  async sourceRuns() {
    return this.transaction(async (c) => {
      const result = await c.query(
        'SELECT * FROM discovery_source_runs ORDER BY started_at DESC,id DESC LIMIT 100',
      );
      return ResearchRunsSchema.parse({
        runs: result.rows.map((r) => ({
          id: r.id,
          runId: r.run_id,
          sourceId: r.source_id,
          startedAt: r.started_at.toISOString(),
          finishedAt: r.finished_at?.toISOString() ?? null,
          status: r.status,
          message: r.message,
          checked: r.checked,
          inserted: r.inserted,
        })),
      });
    });
  }
  async catalog() {
    const items = await this.publishedItems();
    return this.transaction(async (c) => {
      const records = await c.query(
        'SELECT DISTINCT ON(source_id) * FROM discovery_source_runs ORDER BY source_id,started_at DESC',
      );
      const success = await c.query(
        "SELECT source_id,max(finished_at) AS at FROM discovery_source_runs WHERE status='succeeded' GROUP BY source_id",
      );
      return ResearchCatalogSchema.parse({
        sources: researchSources.map((source) => {
          const own = items.filter((item) => sourceIdFor(item) === source.id),
            latest = records.rows.find((r) => r.source_id === source.id),
            last = success.rows.find((r) => r.source_id === source.id);
          return {
            ...source,
            publishedCount: own.length,
            latestPublishedAt:
              own
                .map((i) => i.publishedAt)
                .sort()
                .at(-1) ?? null,
            lastCheckedAt: latest?.started_at.toISOString() ?? null,
            lastSuccessAt: last?.at?.toISOString() ?? null,
            lastRunStatus: latest?.status ?? null,
            lastMessage: latest?.message ?? source.accessNote,
          };
        }),
        topics: [...new Set(items.flatMap((i) => i.topics))].sort(),
        evaluatedAt: new Date().toISOString(),
      });
    });
  }
  async item(id: string) {
    validId(id);
    return this.transaction(async (c) => {
      const r = await c.query<VersionRow>(
        "SELECT v.data FROM discovery_items i JOIN LATERAL (SELECT data FROM discovery_versions WHERE item_id=i.id AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1) v ON true WHERE i.id=$1",
        [id],
      );
      if (!r.rows[0]) throw new NotFoundException('Published item not found.');
      const item = FeedItemSchema.parse(r.rows[0].data);
      if (item.status === 'draft')
        throw new NotFoundException('Published item not found.');
      return item;
    });
  }
  async history(id: string) {
    await this.item(id);
    return this.transaction(async (c) => {
      const r = await c.query<VersionRow>(
        "SELECT data FROM discovery_versions WHERE item_id=$1 AND data->>'status' IN ('published','withdrawn') ORDER BY version DESC",
        [id],
      );
      return r.rows.map((v) => FeedItemSchema.parse(v.data));
    });
  }
  async evidence(id: string) {
    const item = await this.item(id);
    if (!item.sourceHash)
      throw new NotFoundException(
        'This authored definition has no provider document.',
      );
    try {
      const raw = await this.mongo
        .db()
        .collection<Raw>(
          item.id.startsWith('annual-') ? 'macro_raw' : 'discovery_raw',
        )
        .findOne({ _id: item.sourceHash });
      if (!raw) throw new NotFoundException('Source document unavailable.');
      return DiscoveryEvidenceSchema.parse({
        hash: raw._id,
        url: raw.url,
        retrievedAt: raw.retrievedAt,
        body: raw.body,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Evidence storage unavailable.');
    }
  }
  async operations() {
    return this.transaction(async (c) => {
      const items = await c.query<VersionRow>(
        'SELECT v.data FROM discovery_items i JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version ORDER BY v.created_at DESC,i.id',
      );
      const latest = await c.query<RunRow>(
        'SELECT * FROM discovery_runs ORDER BY started_at DESC LIMIT 1',
      );
      return DiscoveryOperationsSchema.parse({
        items: items.rows.map((r) => FeedItemSchema.parse(r.data)),
        latestRun: latest.rows[0] ? run(latest.rows[0]) : null,
      });
    });
  }
  async review(id: string, body: unknown) {
    validId(id);
    const parsed = DiscoveryReviewSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Choose publish/withdraw, current version and a review note.',
      );
    return this.transaction(async (c) => {
      const lock = await c.query<{ version: number }>(
        'SELECT version FROM discovery_items WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!lock.rows[0]) throw new NotFoundException('Item not found.');
      if (lock.rows[0].version !== parsed.data.expectedVersion)
        throw new ConflictException('Item changed. Reload before reviewing.');
      const r = await c.query<VersionRow>(
        'SELECT data FROM discovery_versions WHERE item_id=$1 AND version=$2',
        [id, lock.rows[0].version],
      );
      const item = FeedItemSchema.parse({
        ...FeedItemSchema.parse(r.rows[0]!.data),
        version: lock.rows[0].version + 1,
        status: parsed.data.status,
        correctionNote: parsed.data.correctionNote,
        reviewedAt: new Date().toISOString(),
      });
      await c.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
        [id, item.version, JSON.stringify(item)],
      );
      await c.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
        id,
        item.version,
      ]);
      return item;
    });
  }
  private async promoteDraft(c: pg.PoolClient, input: FeedItem) {
    const current = await c.query<VersionRow>(
      'SELECT v.data FROM discovery_items i JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version WHERE i.id=$1 FOR UPDATE OF i',
      [input.id],
    );
    const old = current.rows[0]
      ? FeedItemSchema.parse(current.rows[0].data)
      : null;
    if (old && discoveryFingerprint(old) === discoveryFingerprint(input))
      return 0;
    const item = FeedItemSchema.parse({
      ...input,
      version: (old?.version ?? 0) + 1,
    });
    if (!old)
      await c.query('INSERT INTO discovery_items(id,version) VALUES($1,$2)', [
        item.id,
        item.version,
      ]);
    await c.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
      [item.id, item.version, JSON.stringify(item)],
    );
    if (old)
      await c.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
        item.id,
        item.version,
      ]);
    return 1;
  }
  async refresh(sourceIds?: string[]) {
    const selected =
      sourceIds ??
      researchSources.filter((s) => s.access === 'enabled').map((s) => s.id);
    if (
      selected.some(
        (id) =>
          !researchSources.some((s) => s.id === id && s.access === 'enabled'),
      ) ||
      new Set(selected).size !== selected.length
    )
      throw new BadRequestException('Choose unique enabled source IDs.');
    let client: pg.PoolClient | undefined;
    let locked = false;
    let id: string | undefined;
    try {
      client = await this.pool.connect();
      const lock = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(360301) AS locked',
      );
      locked = lock.rows[0]?.locked === true;
      if (!locked)
        throw new ConflictException('Discovery refresh is already running.');
      await client.query(
        "UPDATE discovery_runs SET status='failed',finished_at=now(),message='Previous refresh interrupted; retry is safe.' WHERE status='running'",
      );
      await client.query(
        "UPDATE discovery_source_runs SET status='failed',finished_at=now(),message='Previous refresh interrupted; retry is safe.' WHERE status='running'",
      );
      id = randomUUID();
      await client.query(
        "INSERT INTO discovery_runs(id,status,message) VALUES($1,'running','Fetching official feed and synchronizing accepted macro history.')",
        [id],
      );
      let inserted = 0,
        checked = 0,
        failures = 0;
      for (const sourceId of selected) {
        const sourceRunId = randomUUID();
        await client.query(
          "INSERT INTO discovery_source_runs(id,run_id,source_id,status) VALUES($1,$2,$3,'running')",
          [sourceRunId, id, sourceId],
        );
        let sourceInserted = 0;
        const inputs: FeedItem[] = [];
        try {
          if (sourceId === 'glossary')
            inputs.push(
              ...glossaryItems(new Date().toISOString()),
              ...researchGlossaryItems(new Date().toISOString()),
            );
          else {
            const raws = await fetchResearchSource(sourceId, async (raw) => {
              await this.mongo
                .db()
                .collection<Raw>('discovery_raw')
                .updateOne(
                  { _id: raw.hash },
                  {
                    $setOnInsert: {
                      url: raw.url,
                      body: raw.body,
                      retrievedAt: raw.retrievedAt,
                    },
                  },
                  { upsert: true },
                );
            });
            for (const raw of raws) inputs.push(...raw.items);
          }
          if (sourceId === 'world-bank') {
            for (const source of macroSources) {
              const rows = await client.query<{
                id: string;
                year: number;
                value: string | null;
                retrieved_at: Date;
                source_hash: string;
                source_url: string;
                revision: number;
              }>(
                'SELECT DISTINCT ON(year) id,year,value::text,retrieved_at,source_hash,source_url,revision FROM macro_observations WHERE indicator=$1 ORDER BY year DESC,revision DESC',
                [source.indicator],
              );
              for (const o of rows.rows) {
                const value =
                  o.value === null
                    ? 'unavailable'
                    : normalizeDecimal(o.value) + '%';
                inputs.push({
                  id: `annual-${source.indicator === 'NY.GDP.MKTP.KD.ZG' ? 'gdp' : 'cpi'}-${o.year}`,
                  version: 1,
                  kind: 'annual',
                  title: `${source.title}: ${o.year}`,
                  summary: `Reported ${o.year} annual value: ${value}.`,
                  body: `${source.explanation} Exact reported annual value: ${value}. Provider observation revision ${o.revision}.`,
                  topics: ['India', 'Annual data'],
                  publishedAt: `${o.year}-12-31T00:00:00.000Z`,
                  effectiveLabel: `Observation year ${o.year} · period-end ordering, not release date`,
                  source: {
                    name: 'World Bank',
                    url: source.sourceUrl,
                    retrievedAt: o.retrieved_at.toISOString(),
                    rights: `${source.attribution} CC BY 4.0; ${source.termsUrl}`,
                  },
                  sourceHash: o.source_hash,
                  importance: 1,
                  relatedIds: [
                    source.indicator === 'NY.GDP.MKTP.KD.ZG'
                      ? 'term-gdp'
                      : 'term-inflation',
                  ],
                  status: 'draft',
                  correctionNote: null,
                  reviewedAt: null,
                });
              }
            }
          }
          await client.query('BEGIN');
          try {
            for (const item of inputs)
              sourceInserted += await this.promoteDraft(
                client,
                enrichResearchItem(item),
              );
            await client.query('COMMIT');
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          }
          inserted += sourceInserted;
          checked += inputs.length;
          await client.query(
            "UPDATE discovery_source_runs SET status='succeeded',finished_at=now(),message=$2,checked=$3,inserted=$4 WHERE id=$1",
            [
              sourceRunId,
              `${inputs.length} source items checked; ${sourceInserted} drafts await review.`,
              inputs.length,
              sourceInserted,
            ],
          );
        } catch {
          failures++;
          await client.query(
            "UPDATE discovery_source_runs SET status='failed',finished_at=now(),message='Source unavailable, invalid, or storage failed. Existing editions retained; other sources continue.' WHERE id=$1",
            [sourceRunId],
          );
        }
      }
      const result = await client.query<RunRow>(
        'UPDATE discovery_runs SET status=$4,finished_at=now(),message=$2,inserted=$3 WHERE id=$1 RETURNING *',
        [
          id,
          `${checked} source items checked; ${inserted} draft versions await review; ${failures} sources failed independently.`,
          inserted,
          failures === selected.length ? 'failed' : 'succeeded',
        ],
      );
      return run(result.rows[0]!);
    } catch (error) {
      if (id && client)
        await client
          .query(
            "UPDATE discovery_runs SET status='failed',finished_at=now(),message='Refresh failed; existing saved versions were retained. Check provider connectivity and storage.' WHERE id=$1",
            [id],
          )
          .catch(() => {});
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Discovery refresh failed. Existing versions retained; inspect operations status and retry.',
      );
    } finally {
      if (locked)
        await client
          ?.query('SELECT pg_advisory_unlock(360301)')
          .catch(() => {});
      client?.release();
    }
  }
}
@Controller('discovery')
export class DiscoveryController {
  constructor(
    @Inject(DISCOVERY_STORE) private readonly store: DiscoveryStore,
  ) {}
  @Get('feed') feed(
    @Query('cursor') cursor?: string,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
    @Query('source') source?: string,
    @Query('topic') topic?: string,
    @Query('region') region?: 'india' | 'global',
    @Query('view') view?: 'today' | 'explore',
  ) {
    return this.store.feed(cursor, kind, q, { source, topic, region, view });
  }
  @Get('items/:id/context') context(@Param('id') id: string) {
    return this.store.context(id);
  }
  @Get('catalog') catalog() {
    return this.store.catalog();
  }
  @Get('items/:id') item(@Param('id') id: string) {
    return this.store.item(id);
  }
  @Get('items/:id/history') history(@Param('id') id: string) {
    return this.store.history(id);
  }
  @Get('items/:id/evidence') evidence(@Param('id') id: string) {
    return this.store.evidence(id);
  }
}
@Controller('ops/discovery')
export class OpsDiscoveryController {
  constructor(
    @Inject(DISCOVERY_STORE) private readonly store: DiscoveryStore,
    @Inject(OPERATOR_STORE) private readonly operator: OperatorStore,
  ) {}
  @Get('items') async items(@Headers('cookie') cookie?: string) {
    await this.operator.require(cookie);
    return this.store.operations();
  }
  @Get('runs') async runs(@Headers('cookie') cookie?: string) {
    await this.operator.require(cookie);
    return this.store.sourceRuns();
  }
  @Post('refresh') async refresh(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.operator.origin(origin);
    await this.operator.require(cookie);
    const input = ResearchRefreshInputSchema.safeParse(body ?? {});
    if (!input.success)
      throw new BadRequestException(
        'Refresh accepts no provider URLs or fields.',
      );
    await this.operator.record(
      'discovery.refresh.requested',
      'fixed-provider',
      cookie,
    );
    return this.store.refresh(input.data.sourceIds);
  }
  @Put('items/:id') async review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.operator.origin(origin);
    await this.operator.require(cookie);
    await this.operator.record('discovery.review.requested', id, cookie);
    return this.store.review(id, body);
  }
}
export function discoveryProvider(config: AppConfig) {
  return { provide: DISCOVERY_STORE, useValue: new DiscoveryStore(config) };
}
