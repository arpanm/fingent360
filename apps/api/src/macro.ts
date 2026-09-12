import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import {
  MacroDashboardSchema,
  MacroEvidenceSchema,
  MacroHistorySchema,
  MacroIndicatorSchema,
  MacroObservationSchema,
  MacroRefreshSchema,
  MacroRunSchema,
  type MacroIndicator,
} from '@fingent360/contracts';
import {
  macroSources,
  fetchWorldBank,
  parseWorldBank,
  ProviderError,
  normalizeDecimal,
} from './world-bank.js';
import { storageErrorMessage } from './storage-error.js';
import type { AppConfig } from './config.js';

const STORE = Symbol('MACRO_STORE');
interface RawDocument {
  _id: string;
  url: string;
  body: string;
  retrievedAt: string;
  state: 'accepted' | 'quarantined';
}
interface ObservationRow {
  id: string;
  indicator: MacroIndicator;
  year: number;
  value: string | null;
  provider_updated_at: string;
  retrieved_at: Date;
  source_hash: string;
  source_url: string;
  revision: number;
  supersedes_id: string | null;
}
interface RunRow {
  id: string;
  indicator: MacroIndicator;
  started_at: Date;
  finished_at: Date | null;
  status: string;
  message: string;
  inserted: number;
}
function observation(row: ObservationRow) {
  return MacroObservationSchema.parse({
    id: row.id,
    indicator: row.indicator,
    year: row.year,
    value: row.value === null ? null : normalizeDecimal(row.value),
    unit: 'annual_percent',
    country: 'IND',
    providerUpdatedAt: row.provider_updated_at,
    retrievedAt: row.retrieved_at.toISOString(),
    sourceHash: row.source_hash,
    sourceUrl: row.source_url,
    revision: row.revision,
    supersedesId: row.supersedes_id,
  });
}
function run(row: RunRow) {
  return MacroRunSchema.parse({
    id: row.id,
    indicator: row.indicator,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    status: row.status,
    message: row.message,
    inserted: row.inserted,
  });
}
function indicator(value: unknown): MacroIndicator {
  const parsed = MacroIndicatorSchema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException('Unsupported macro indicator.');
  return parsed.data;
}
export class MacroStore {
  private readonly pool: pg.Pool;
  private readonly mongo: MongoClient;
  constructor(private readonly config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {
      /* Safe request errors only. */
    });
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
      socketTimeoutMS: 5000,
      maxPoolSize: 3,
    });
  }
  async onApplicationShutdown() {
    await Promise.allSettled([this.pool.end(), this.mongo.close()]);
  }
  authorize(auth?: string) {
    const configured = this.config.RESEARCH_ADMIN_TOKEN;
    if (!configured)
      throw new ServiceUnavailableException(
        'Source refresh is disabled until the local operator key is configured with pnpm research:setup.',
      );
    const supplied = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
    if (
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(configured))
    )
      throw new UnauthorizedException('Valid operator key required.');
  }
  async dashboard() {
    try {
      const sources = [];
      for (const source of macroSources) {
        const latest = await this.pool.query<ObservationRow>(
          `SELECT DISTINCT ON (year) id,indicator,year,value::text,provider_updated_at::text,retrieved_at,source_hash,source_url,revision,supersedes_id FROM macro_observations WHERE indicator=$1 ORDER BY year DESC,revision DESC`,
          [source.indicator],
        );
        const runs = await this.pool.query<RunRow>(
          'SELECT * FROM macro_runs WHERE indicator=$1 ORDER BY started_at DESC,id DESC LIMIT 1',
          [source.indicator],
        );
        const success = await this.pool.query<{ finished_at: Date }>(
          "SELECT finished_at FROM macro_runs WHERE indicator=$1 AND status='succeeded' ORDER BY finished_at DESC LIMIT 1",
          [source.indicator],
        );
        const lastSuccessAt =
          success.rows[0]?.finished_at.toISOString() ?? null;
        sources.push({
          ...source,
          lastSuccessAt,
          latestRun: runs.rows[0] ? run(runs.rows[0]) : null,
          freshness: !lastSuccessAt
            ? 'never_synced'
            : Date.now() - Date.parse(lastSuccessAt) > 7 * 86400000
              ? 'refresh_due'
              : 'recently_checked',
          observations: latest.rows.map(observation),
        });
      }
      return MacroDashboardSchema.parse({
        sources,
        evaluatedAt: new Date().toISOString(),
        operatorConfigured: Boolean(this.config.RESEARCH_ADMIN_TOKEN),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Macro storage unavailable. Check databases and run pnpm db:migrate.',
      );
    }
  }
  async history(rawIndicator: string, rawYear: string) {
    const key = indicator(rawIndicator);
    if (!/^20\d{2}$|^2100$/.test(rawYear))
      throw new BadRequestException('Unsupported observation year.');
    try {
      const result = await this.pool.query<ObservationRow>(
        'SELECT id,indicator,year,value::text,provider_updated_at::text,retrieved_at,source_hash,source_url,revision,supersedes_id FROM macro_observations WHERE indicator=$1 AND year=$2 ORDER BY revision DESC',
        [key, Number(rawYear)],
      );
      return MacroHistorySchema.parse(result.rows.map(observation));
    } catch {
      throw new ServiceUnavailableException(
        'Observation history is unavailable. Check database access.',
      );
    }
  }
  async evidence(hash: string) {
    if (!/^[a-f0-9]{64}$/.test(hash))
      throw new BadRequestException('Invalid source hash.');
    try {
      const accepted = await this.pool.query(
        'SELECT 1 FROM macro_observations WHERE source_hash=$1 LIMIT 1',
        [hash],
      );
      if (!accepted.rowCount)
        throw new NotFoundException('Accepted source evidence not found.');
      const raw = await this.mongo
        .db()
        .collection<RawDocument>('macro_raw')
        .findOne({ _id: hash, state: 'accepted' });
      if (!raw)
        throw new ServiceUnavailableException(
          'Source evidence storage is unavailable; numerical history has been retained.',
        );
      return MacroEvidenceSchema.parse({
        hash,
        url: raw.url,
        body: raw.body,
        retrievedAt: raw.retrievedAt,
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException
      )
        throw error;
      throw new ServiceUnavailableException(
        'Source evidence storage is unavailable. Check MongoDB.',
      );
    }
  }
  async refresh(body: unknown, auth?: string) {
    this.authorize(auth);
    const parsed = MacroRefreshSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Supply only a supported indicator.');
    const key = parsed.data.indicator;
    const lockId = key === 'NY.GDP.MKTP.KD.ZG' ? 360101 : 360102;
    let client: pg.PoolClient | undefined;
    let locked = false;
    let transaction = false;
    let id: string | undefined;
    try {
      client = await this.pool.connect();
      const lock = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [lockId],
      );
      locked = lock.rows[0]?.locked === true;
      if (!locked)
        throw new ConflictException(
          'This source is already refreshing. Reload its status shortly.',
        );
      // A process exit can leave only a run marker, never the session lock.
      await client.query(
        "UPDATE macro_runs SET status='failed',finished_at=now(),message='Previous refresh was interrupted; retry is safe.' WHERE indicator=$1 AND status='running'",
        [key],
      );
      const recent = await client.query<RunRow>(
        "SELECT * FROM macro_runs WHERE indicator=$1 AND status='succeeded' AND finished_at > now() - interval '60 seconds' ORDER BY finished_at DESC LIMIT 1",
        [key],
      );
      if (recent.rows[0]) return run(recent.rows[0]);
      id = randomUUID();
      await client.query(
        "INSERT INTO macro_runs(id,indicator,status) VALUES ($1,$2,'running')",
        [id, key],
      );
      const raw = await fetchWorldBank(key);
      const hash = createHash('sha256')
        .update(raw.url + '\n' + raw.body)
        .digest('hex');
      let normalized: ReturnType<typeof parseWorldBank>;
      try {
        normalized = parseWorldBank(raw.body, key);
      } catch (error) {
        await this.mongo
          .db()
          .collection<RawDocument>('macro_raw')
          .updateOne(
            { _id: hash },
            { $setOnInsert: { ...raw, state: 'quarantined' } },
            { upsert: true },
          );
        throw error;
      }
      // Persist supporting evidence before making any fact visible in PostgreSQL.
      await this.mongo
        .db()
        .collection<RawDocument>('macro_raw')
        .updateOne(
          { _id: hash },
          { $setOnInsert: raw, $set: { state: 'accepted' } },
          { upsert: true },
        );
      await client.query('BEGIN');
      transaction = true;
      let inserted = 0;
      for (const item of normalized.observations) {
        const previous = await client.query<{
          id: string;
          revision: number;
          value: string | null;
        }>(
          'SELECT id,revision,value::text FROM macro_observations WHERE indicator=$1 AND year=$2 ORDER BY revision DESC LIMIT 1',
          [key, item.year],
        );
        const old = previous.rows[0];
        if (
          old &&
          (old.value === null ? null : normalizeDecimal(old.value)) ===
            item.value
        )
          continue;
        await client.query(
          `INSERT INTO macro_observations(id,indicator,year,value,provider_updated_at,retrieved_at,source_hash,source_url,revision,supersedes_id,run_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            randomUUID(),
            key,
            item.year,
            item.value,
            normalized.providerUpdatedAt,
            raw.retrievedAt,
            hash,
            raw.url,
            (old?.revision ?? 0) + 1,
            old?.id ?? null,
            id,
          ],
        );
        inserted++;
      }
      const result = await client.query<RunRow>(
        "UPDATE macro_runs SET status='succeeded',finished_at=now(),message=$2,inserted=$3,source_hash=$4 WHERE id=$1 RETURNING *",
        [
          id,
          `${normalized.observations.length} annual records checked; ${inserted} new observation revisions.`,
          inserted,
          hash,
        ],
      );
      await client.query('COMMIT');
      transaction = false;
      const row = result.rows[0];
      if (!row) throw new Error('Run record missing');
      return run(row);
    } catch (error) {
      if (transaction && client) await client.query('ROLLBACK').catch(() => {});
      if (error instanceof ConflictException) throw error;
      const message =
        error instanceof ProviderError
          ? error.message
          : 'Source refresh could not be stored. Check PostgreSQL, MongoDB and the migration. Previously accepted observations are unchanged.';
      if (id && client)
        await client
          .query(
            "UPDATE macro_runs SET status='failed',finished_at=now(),message=$2 WHERE id=$1",
            [id, message],
          )
          .catch(() => {});
      throw new ServiceUnavailableException(
        client ? message : storageErrorMessage(error),
      );
    } finally {
      if (locked && client)
        await client
          .query('SELECT pg_advisory_unlock($1)', [lockId])
          .catch(() => {});
      client?.release();
    }
  }
}
@Controller('macro')
export class MacroController {
  constructor(@Inject(STORE) private readonly store: MacroStore) {}
  @Get() dashboard() {
    return this.store.dashboard();
  }
  @Get(':indicator/history/:year') history(
    @Param('indicator') key: string,
    @Param('year') year: string,
  ) {
    return this.store.history(key, year);
  }
  @Get('evidence/:hash') evidence(@Param('hash') hash: string) {
    return this.store.evidence(hash);
  }
  @Post('refresh') @HttpCode(200) refresh(
    @Body() body: unknown,
    @Headers('authorization') auth?: string,
  ) {
    return this.store.refresh(body, auth);
  }
}
export function macroProvider(config: AppConfig) {
  return { provide: STORE, useValue: new MacroStore(config) };
}
