import { recordPublicView } from './eval-lineage-recording.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import {
  beaHistory,
  beaValidation,
  beginBeaAttempt,
  beaEvent,
  beaAttempts,
  beaAttempt,
  beaRetained,
  revalidateBea,
  stageBea,
} from './bea-quarantine.js';
import { admitPublications } from './publication.js';
import {
  publicEdition,
  editionEvidence,
  PublicationManifestSchema,
} from '@fingent360/contracts';
import { beaReleaseFields, BEA_FEED } from '@fingent360/contracts';
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
  SourceReviewComparisonSchema,
  SourceReviewQuerySchema,
  sourceReviewDifferences,
  BeaPageQuerySchema,
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
import { glossaryItems, sourceHash } from './discovery-provider.js';
import {
  OfficialFetchError,
  fetchResearchSource,
  researchSources,
} from './research-providers.js';
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
    return this.transaction(async (c) =>
      (await admitPublications(c)).filter((v) => v.status === 'published'),
    );
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
    const rendered = FeedSchema.parse({
      ...page,
      evaluatedAt: new Date().toISOString(),
    });
    await this.transaction(async (c) => {
      for (const item of rendered.items) await recordPublicView(c, item);
    });
    return rendered;
  }
  async context(id: string) {
    validId(id);
    return this.transaction(async (c) => {
      const all = await admitPublications(c),
        item = all.find((v) => v.id === id);
      if (!item || item.status !== 'published')
        throw new NotFoundException('Published context unavailable.');
      return buildResearchContext(
        item,
        all.filter((v) => v.status === 'published'),
      );
    });
  }
  async manifest() {
    return this.transaction(async (c) => {
      const items = (await admitPublications(c)).filter(
        (v) => v.status === 'published',
      );
      const assets = await c.query(
        'SELECT id,item_id,item_version FROM discovery_media WHERE item_id=ANY($1::text[]) ORDER BY id FOR SHARE',
        [items.map((v) => v.id)],
      );
      const published = await c.query(
        'SELECT DISTINCT ON(asset_id) asset_id,published FROM discovery_media_reviews WHERE asset_id=ANY($1::uuid[]) ORDER BY asset_id,reviewed_at DESC,id DESC',
        [assets.rows.map((v) => v.id)],
      );
      const images = await c.query(
        `SELECT DISTINCT ON(a.asset_id) a.asset_id,a.id,(SELECT published FROM story_image_reviews WHERE attempt_id=a.id ORDER BY reviewed_at DESC,id DESC LIMIT 1) AS published FROM story_image_attempts a WHERE a.asset_id=ANY($1::uuid[]) AND a.status='succeeded' AND EXISTS(SELECT 1 FROM story_image_reviews WHERE attempt_id=a.id) ORDER BY a.asset_id,a.started_at DESC`,
        [assets.rows.map((a) => a.id)],
      );
      return PublicationManifestSchema.parse({
        admittedAt: new Date().toISOString(),
        items: items.map((item) => ({
          id: item.id,
          version: item.version,
          imageAttemptId:
            images.rows.find(
              (image) =>
                image.published &&
                assets.rows.some(
                  (a) =>
                    a.id === image.asset_id &&
                    a.item_id === item.id &&
                    a.item_version === item.version,
                ) &&
                published.rows.some(
                  (p) => p.asset_id === image.asset_id && p.published,
                ),
            )?.id ?? null,
          mediaId:
            assets.rows.find(
              (a) =>
                a.item_id === item.id &&
                a.item_version === item.version &&
                published.rows.some((p) => p.asset_id === a.id && p.published),
            )?.id ?? null,
        })),
      });
    });
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
      const item = (await admitPublications(c, [id]))[0];
      if (!item) throw new NotFoundException('Published item not found.');
      const rendered = publicEdition(item);
      await recordPublicView(c, rendered);
      return rendered;
    });
  }
  async history(id: string) {
    validId(id);
    return this.transaction(async (c) => {
      const item = (await admitPublications(c, [id]))[0];
      if (!item) throw new NotFoundException('Published item not found.');
      const rows = await c.query(
        "SELECT data FROM discovery_versions WHERE item_id=$1 AND data->>'status'<>'draft' ORDER BY version DESC",
        [id],
      );
      return rows.rows.map((r) =>
        publicEdition(
          FeedItemSchema.parse(r.data),
          item.status === 'withdrawn',
        ),
      );
    });
  }
  async evidence(id: string) {
    validId(id);
    if (id.startsWith('bea-')) return this.beaEvidence(id);
    return this.transaction(async (c) => {
      const item = (await admitPublications(c, [id]))[0];
      if (!item || item.status !== 'published' || !item.sourceHash)
        throw new NotFoundException('Published source evidence unavailable.');
      const raw = await this.originalEvidence(item);
      return editionEvidence(item, raw);
    });
  }
  private async originalEvidence(item: FeedItem) {
    if (!item.sourceHash)
      throw new NotFoundException(
        'This authored definition has no provider document.',
      );
    const raw = await this.mongo
      .db()
      .collection<Raw>(
        item.id.startsWith('annual-') ? 'macro_raw' : 'discovery_raw',
      )
      .findOne({ _id: item.sourceHash });
    if (!raw || sourceHash(raw.url, raw.body) !== item.sourceHash)
      throw new NotFoundException('Retained evidence unavailable.');
    return DiscoveryEvidenceSchema.parse({
      hash: raw._id,
      url: raw.url,
      retrievedAt: raw.retrievedAt,
      body: raw.body,
      scope: 'retained-original',
    });
  }
  async retained(
    id: string,
    evidence: boolean,
    version: unknown,
    authorize: () => Promise<unknown>,
  ) {
    validId(id);
    const selected = z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .safeParse(version);
    if (!selected.success)
      throw new BadRequestException('Choose a valid retained edition.');
    return this.transaction(async (c) => {
      await admitPublications(c, [id]);
      await authorize();
      const rows = await c.query(
        'SELECT data FROM discovery_versions WHERE item_id=$1 AND ($2::integer IS NULL OR version=$2) ORDER BY version DESC',
        [id, selected.data ?? null],
      );
      if (!rows.rows.length)
        throw new NotFoundException('Retained edition not found.');
      if (!evidence) return rows.rows.map((r) => FeedItemSchema.parse(r.data));
      const raw = await this.originalEvidence(
        FeedItemSchema.parse(rows.rows[0].data),
      );
      await authorize();
      return raw;
    });
  }
  private async beaEvidence(id: string) {
    validId(id);
    return this.transaction(async (c) => {
      const item = (await admitPublications(c, [id]))[0];
      if (!item || item.status !== 'published' || !item.sourceHash)
        throw new NotFoundException(
          'BEA release evidence is unavailable or withdrawn.',
        );
      try {
        const raw = await this.mongo
          .db()
          .collection<Raw>('discovery_raw')
          .findOne({ _id: item.sourceHash });
        if (
          !raw ||
          raw.url !== BEA_FEED ||
          sourceHash(raw.url, raw.body) !== item.sourceHash
        )
          throw new NotFoundException('Stored BEA evidence unavailable.');
        const release = beaReleaseFields(raw.body, raw.retrievedAt).find(
          (r) => r.url === item.source.url,
        );
        if (
          !release ||
          release.title !== item.title ||
          release.publishedAt !== item.publishedAt
        )
          throw new NotFoundException(
            'Stored BEA evidence does not match this edition.',
          );
        return DiscoveryEvidenceSchema.parse({
          hash: raw._id,
          url: raw.url,
          retrievedAt: raw.retrievedAt,
          body: release.excerpt,
          scope: 'release-metadata',
        });
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new ServiceUnavailableException(
          'BEA evidence storage or metadata unavailable.',
        );
      }
    });
  }
  async comparison(
    id: string,
    query: unknown,
    authorize: () => Promise<unknown>,
  ) {
    validId(id);
    const parsed = SourceReviewQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException('Provide the exact examined head version.');
    return this.transaction(async (c) => {
      const locked = await c.query<{ version: number }>(
        'SELECT version FROM discovery_items WHERE id=$1 FOR SHARE',
        [id],
      );
      await authorize();
      if (!locked.rows[0]) throw new NotFoundException('Item not found.');
      if (locked.rows[0].version !== Number(parsed.data.expectedVersion))
        throw new ConflictException('Item changed. Reload before reviewing.');
      const rows = await c.query<VersionRow>(
        "SELECT data FROM discovery_versions WHERE item_id=$1 AND (version=$2 OR (version<$2 AND data->>'status'<>'draft')) ORDER BY version DESC LIMIT 2",
        [id, locked.rows[0].version],
      );
      const head = FeedItemSchema.parse(rows.rows[0]!.data),
        previous = rows.rows[1]
          ? FeedItemSchema.parse(rows.rows[1].data)
          : null;
      await authorize();
      return SourceReviewComparisonSchema.parse({
        head,
        previous,
        checkedAt: new Date().toISOString(),
        differences: sourceReviewDifferences(head, previous),
      });
    });
  }
  async quarantine(
    kind:
      | 'list'
      | 'detail'
      | 'evidence'
      | 'validate'
      | 'stage'
      | 'history'
      | 'validation',
    id: string | undefined,
    body: unknown,
    authorize: () => Promise<unknown>,
  ) {
    return this.transaction(async (c) => {
      await c.query("SET LOCAL statement_timeout='3s'");
      await authorize();
      let result: unknown;
      if (kind === 'list') result = await beaAttempts(c, id);
      else if (kind === 'detail') result = await beaAttempt(c, id!);
      else if (kind === 'history')
        result = await beaHistory(
          c,
          id!,
          typeof body === 'string' ? body : undefined,
        );
      else if (kind === 'validation') result = await beaValidation(c, id!);
      else if (kind === 'evidence')
        result = await beaRetained(c, this.mongo, id!);
      else if (kind === 'validate')
        result = await revalidateBea(c, this.mongo, id!, body, authorize);
      else
        result = await stageBea(c, body, authorize, (client, item) =>
          this.promoteDraft(client, item),
        );
      await authorize();
      return result;
    });
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
  async review(
    id: string,
    body: unknown,
    authorize: () => Promise<unknown> = async () => undefined,
    complete?: (client: pg.PoolClient) => Promise<void>,
  ) {
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
      await authorize();
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
      await authorize();
      await complete?.(c);
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
  async refresh(
    sourceIds?: string[],
    authorize: () => Promise<unknown> = async () => undefined,
  ) {
    await authorize();
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
        const beaAttemptId =
          sourceId === 'bea'
            ? await beginBeaAttempt(client, sourceRunId)
            : null;
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
                  {
                    upsert: true,
                    ...(beaAttemptId
                      ? { timeoutMS: 3000, maxTimeMS: 2500 }
                      : {}),
                  },
                );
              if (beaAttemptId) {
                const saved = await this.mongo
                  .db()
                  .collection<Raw>('discovery_raw')
                  .findOne(
                    { _id: raw.hash },
                    { timeoutMS: 3000, maxTimeMS: 2500 },
                  );
                if (!saved || saved.url !== raw.url || saved.body !== raw.body)
                  throw Error('Retained response verification failed.');
                await beaEvent(
                  client!,
                  beaAttemptId,
                  'retained',
                  'Complete response retained and verified.',
                  raw,
                );
              }
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
          if (beaAttemptId)
            await beaEvent(
              client,
              beaAttemptId,
              'parsed',
              'Bounded BEA parser accepted the response.',
            );
          await client.query('BEGIN');
          try {
            if (beaAttemptId) {
              await client.query("SET LOCAL statement_timeout='3s'");
              await client.query(
                'SELECT id FROM bea_staging_gate WHERE id=1 FOR UPDATE',
              );
            }
            await client.query(
              'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',
              [inputs.map((item) => item.id)],
            );
            for (const item of [...inputs].sort((a, b) =>
              a.id.localeCompare(b.id),
            ))
              sourceInserted += await this.promoteDraft(
                client,
                enrichResearchItem(item),
              );
            if (beaAttemptId)
              await beaEvent(
                client,
                beaAttemptId,
                'staged',
                'Parsed drafts committed atomically with this receipt.',
              );
            await authorize();
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
        } catch (failure) {
          if (beaAttemptId)
            await beaEvent(
              client,
              beaAttemptId,
              'failed',
              failure instanceof OfficialFetchError
                ? `${failure.category}: ${failure.message}`
                : 'Parse or storage failure. Any preceding staged event remains authoritative.',
            );
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
  @Get('publication-manifest') manifest() {
    return this.store.manifest();
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
@OperatorRead()
@Controller('ops/discovery')
export class OpsDiscoveryController {
  constructor(
    @Inject(DISCOVERY_STORE) private readonly store: DiscoveryStore,
    @Inject(OPERATOR_STORE) private readonly operator: OperatorStore,
  ) {}
  @Get('bea-attempts/:id/history') async beaHistory(
    @Param('id') id: string,
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    const parsed = BeaPageQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Invalid history page.');
    return this.store.quarantine('history', id, parsed.data.after, () =>
      this.operator.require(cookie),
    );
  }
  @Get('bea-validations/:id') async beaValidation(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.quarantine('validation', id, null, () =>
      this.operator.require(cookie),
    );
  }
  @Get('bea-attempts') async beaList(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    const parsed = BeaPageQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Invalid attempt page.');
    return this.store.quarantine('list', parsed.data.after, null, () =>
      this.operator.require(cookie),
    );
  }
  @Get('bea-attempts/:id') async beaDetail(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.quarantine('detail', id, null, () =>
      this.operator.require(cookie),
    );
  }
  @Get('bea-attempts/:id/evidence') async beaEvidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.quarantine('evidence', id, null, () =>
      this.operator.require(cookie),
    );
  }
  @OperatorAction('prepare')
  @Post('bea-attempts/:id/revalidate')
  async beaValidate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie?: string,
  ) {
    this.operator.origin(origin);
    return this.store.quarantine('validate', id, body, () =>
      this.operator.require(cookie),
    );
  }
  @OperatorAction('prepare')
  @Post('bea-staging')
  async beaStage(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie?: string,
  ) {
    this.operator.origin(origin);
    return this.store.quarantine('stage', undefined, body, () =>
      this.operator.require(cookie),
    );
  }
  @Get('items') async items(@Headers('cookie') cookie?: string) {
    await this.operator.require(cookie);
    const result = await this.store.operations();
    await this.operator.require(cookie);
    return result;
  }
  @Get('items/:id/comparison') async comparison(
    @Param('id') id: string,
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    await this.operator.require(cookie);
    return this.store.comparison(id, query, () =>
      this.operator.require(cookie),
    );
  }
  @Get('items/:id/history') async history(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.operator.require(cookie);
    return this.store.retained(id, false, undefined, () =>
      this.operator.require(cookie),
    );
  }
  @Get('items/:id/evidence') async evidence(
    @Param('id') id: string,
    @Query('version') version?: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.operator.require(cookie);
    return this.store.retained(id, true, version, () =>
      this.operator.require(cookie),
    );
  }
  @Get('runs') async runs(@Headers('cookie') cookie?: string) {
    await this.operator.require(cookie);
    const result = await this.store.sourceRuns();
    await this.operator.require(cookie);
    return result;
  }
  @OperatorAction('prepare')
  @Post('refresh')
  async refresh(
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
    return this.store.refresh(input.data.sourceIds, () =>
      this.operator.permission(cookie, 'prepare'),
    );
  }
  @OperatorAction('blocked')
  @Put('items/:id')
  async review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.operator.origin(origin);
    await this.operator.require(cookie);
    await this.operator.record('discovery.review.requested', id, cookie);
    return this.store.review(id, body, () => this.operator.require(cookie));
  }
}
export function discoveryProvider(config: AppConfig) {
  return { provide: DISCOVERY_STORE, useValue: new DiscoveryStore(config) };
}
