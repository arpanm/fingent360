import { createHash } from 'node:crypto';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Headers,
  Inject,
  Param,
  Query,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import {
  ECB_RATE_SOURCE,
  ECB_RATE_URL,
  ECB_RATE_PARSER,
  EcbRateEditionSchema,
  EcbRateRefreshSchema,
  EcbRateReviewSchema,
  EcbRateReviewReceiptSchema,
  EcbRateRunSchema,
  EcbRateOperationsSchema,
  EcbRatePublicSchema,
  EcbRateHistorySchema,
  EcbRateEvidenceSchema,
  EcbRateRetainedSchema,
  EcbRateRunsSchema,
  EcbRateReviewsSchema,
  parseEcbRates,
  ecbEvaluationDay,
  canonicalEcbRate,
  type EcbRateEdition,
  type EcbRateRun,
} from '@fingent360/contracts';
import {
  fetchEcbRates,
  ecbReceiptHash,
  type EcbRateRaw,
} from './ecb-rate-provider.js';
import type { AppConfig } from './config.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';

export const ECB_RATE_STORE = Symbol('ECB_RATE_STORE');
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
// A source-wide withdrawal retires every earlier publication. A later review
// admits only its explicitly published edition; older retained data stay private.
const publicReview =
  "r.status='published' AND r.head_version>(SELECT COALESCE(max(w.head_version),0) FROM ecb_rate_reviews w WHERE w.status='withdrawn')";
type Authorize = () => Promise<unknown>;
type Head = {
  version: number;
  status: 'draft' | 'published' | 'withdrawn';
  edition: number | null;
  published_edition: number | null;
  checked_at: Date | null;
  reviewed_at: Date | null;
};
type RunRow = {
  request_id: string;
  started_at: Date;
  finished_at: Date | null;
  status: EcbRateRun['status'];
  category: EcbRateRun['category'];
  edition: number | null;
  source_hash: string | null;
  observation_count: number;
};
type Raw = EcbRateRaw & { _id: string };
function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException('Invalid ECB policy-rate request.');
  return parsed.data;
}
const number = (value: string) =>
  input(z.string().regex(/^[1-9][0-9]{0,8}$/), value);
const run = (row: RunRow) =>
  EcbRateRunSchema.parse({
    requestId: row.request_id,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    status: row.status,
    category: row.category,
    edition: row.edition,
    sourceHash: row.source_hash,
    observationCount: row.observation_count,
  });
const head = (row: Head) => ({
  version: row.version,
  status: row.status,
  latestEdition: row.edition,
  publishedEdition: row.published_edition,
  checkedAt: row.checked_at?.toISOString() ?? null,
  reviewedAt: row.reviewed_at?.toISOString() ?? null,
});

export class EcbRateStore {
  private readonly pool: pg.Pool;
  private readonly mongo: MongoClient;
  constructor(
    config: AppConfig,
    private readonly fetchSource: () => Promise<EcbRateRaw> = fetchEcbRates,
  ) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {});
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 5000,
      maxPoolSize: 2,
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
      if (c) await c.query('ROLLBACK').catch(() => {});
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Policy-rate storage is unavailable. Retry; previously reviewed values are unchanged.',
      );
    } finally {
      c?.release();
    }
  }
  private async locked(c: pg.PoolClient, write = false) {
    const rows = await c.query<Head>(
      `SELECT version,status,edition,published_edition,checked_at,reviewed_at FROM ecb_rate_head WHERE id=$1 FOR ${write ? 'UPDATE' : 'SHARE'}`,
      [ECB_RATE_SOURCE],
    );
    if (!rows.rows[0])
      throw new ServiceUnavailableException(
        'Policy-rate source is not initialized.',
      );
    return rows.rows[0];
  }
  private async edition(c: pg.PoolClient, edition: number) {
    const rows = await c.query<{ payload: unknown }>(
      'SELECT payload FROM ecb_rate_editions WHERE edition=$1',
      [edition],
    );
    if (!rows.rows[0]) throw new NotFoundException('Rate edition unavailable.');
    const value = EcbRateEditionSchema.parse(rows.rows[0].payload);
    // Canonical numeric storage independently reconciles the public JSON edition.
    const facts = await c.query<{
      series: string;
      effectiveOn: string;
      value: string;
    }>(
      'SELECT series,effective_on::text AS "effectiveOn",value::text AS value FROM ecb_rate_observations WHERE edition=$1 ORDER BY series,effective_on',
      [edition],
    );
    const normalized = facts.rows.map((row) => ({
      ...row,
      value: canonicalEcbRate(row.value),
    }));
    if (JSON.stringify(normalized) !== JSON.stringify(value.observations))
      throw Error('Numerical edition reconciliation failed.');
    return value;
  }
  async publicView() {
    return this.transaction(async (c) => {
      const current = await this.locked(c),
        now = new Date();
      return EcbRatePublicSchema.parse({
        status: current.status === 'draft' ? 'never-published' : current.status,
        edition:
          current.status === 'published'
            ? await this.edition(c, current.published_edition!)
            : null,
        checkedAt: current.checked_at?.toISOString() ?? null,
        reviewedAt: current.reviewed_at?.toISOString() ?? null,
        evaluatedAt: now.toISOString(),
        evaluatedOn: ecbEvaluationDay(now),
        timeZone: 'Europe/Berlin',
      });
    });
  }
  async history(query: unknown, authorize?: Authorize) {
    const args = input(
      z.strictObject({
        before: z
          .string()
          .regex(/^[1-9][0-9]{0,8}$/)
          .optional(),
      }),
      query,
    );
    if (authorize) await authorize();
    return this.transaction(async (c) => {
      const current = await this.locked(c);
      if (!authorize && current.status !== 'published')
        throw new NotFoundException('Reviewed rate history unavailable.');
      const rows = await c.query<{ edition: number }>(
        `SELECT edition FROM ecb_rate_editions e WHERE ($1::integer IS NULL OR edition<$1) ${authorize ? '' : `AND EXISTS(SELECT 1 FROM ecb_rate_reviews r WHERE r.edition=e.edition AND ${publicReview})`} ORDER BY edition DESC LIMIT 51`,
        [args.before ? Number(args.before) : null],
      );
      const editions: EcbRateEdition[] = [];
      for (const row of rows.rows.slice(0, 50))
        editions.push(await this.edition(c, row.edition));
      if (authorize) await authorize();
      return EcbRateHistorySchema.parse({
        editions,
        nextBefore: rows.rows.length > 50 ? rows.rows[49]!.edition : null,
      });
    });
  }
  async readEdition(raw: string, authorize?: Authorize) {
    const edition = Number(number(raw));
    if (authorize) await authorize();
    return this.transaction(async (c) => {
      const current = await this.locked(c);
      if (!authorize) {
        const reviewed = await c.query(
          `SELECT 1 FROM ecb_rate_reviews r WHERE r.edition=$1 AND ${publicReview} LIMIT 1`,
          [edition],
        );
        if (current.status !== 'published' || !reviewed.rowCount)
          throw new NotFoundException('Reviewed rate edition unavailable.');
      }
      const value = await this.edition(c, edition);
      if (authorize) await authorize();
      return value;
    });
  }
  async operations(authorize: Authorize) {
    await authorize();
    return this.transaction(async (c) => {
      const current = await this.locked(c);
      const latest = current.edition
        ? await this.edition(c, current.edition)
        : null;
      const rows = await c.query<RunRow>(
        'SELECT * FROM ecb_rate_runs ORDER BY started_at DESC,request_id DESC LIMIT 1',
      );
      await authorize();
      return EcbRateOperationsSchema.parse({
        head: head(current),
        latest,
        latestRun: rows.rows[0] ? run(rows.rows[0]) : null,
      });
    });
  }
  async runs(authorize: Authorize) {
    await authorize();
    return this.transaction(async (c) => {
      const rows = await c.query<RunRow>(
        'SELECT * FROM ecb_rate_runs ORDER BY started_at DESC,request_id DESC LIMIT 51',
      );
      await authorize();
      return EcbRateRunsSchema.parse({
        runs: rows.rows.slice(0, 50).map(run),
        moreAvailable: rows.rows.length > 50,
      });
    });
  }
  async retained(rawId: string, authorize: Authorize) {
    const id = input(z.uuid(), rawId).toLowerCase();
    await authorize();
    return this.transaction(async (c) => {
      const rows = await c.query<RunRow>(
        'SELECT * FROM ecb_rate_runs WHERE request_id=$1',
        [id],
      );
      const hash = rows.rows[0]?.source_hash;
      if (!hash) {
        await authorize();
        throw new NotFoundException(
          'No complete retained response is linked to this run.',
        );
      }
      const raw = await this.mongo
        .db()
        .collection<Raw>('ecb_rate_raw')
        .findOne({ _id: hash }, { timeoutMS: 3000, maxTimeMS: 2500 });
      await authorize();
      if (!raw || raw.url !== ECB_RATE_URL || ecbReceiptHash(raw) !== hash)
        throw new ServiceUnavailableException(
          'Retained rate evidence is unavailable.',
        );
      return EcbRateRetainedSchema.parse({
        scope: 'operator-retained-original',
        requestId: id,
        sourceUrl: raw.url,
        retrievedAt: raw.retrievedAt,
        sourceHash: hash,
        body: raw.body,
      });
    });
  }
  async reviews(query: unknown, authorize: Authorize) {
    const args = input(
      z.strictObject({
        before: z
          .string()
          .regex(/^[1-9][0-9]{0,8}$/)
          .optional(),
      }),
      query,
    );
    await authorize();
    return this.transaction(async (c) => {
      const rows = await c.query<{ payload: unknown }>(
        'SELECT payload FROM ecb_rate_reviews WHERE ($1::integer IS NULL OR head_version<$1) ORDER BY head_version DESC LIMIT 51',
        [args.before ? Number(args.before) : null],
      );
      const reviews = rows.rows
        .slice(0, 50)
        .map((row) => EcbRateReviewReceiptSchema.parse(row.payload));
      await authorize();
      return EcbRateReviewsSchema.parse({
        reviews,
        nextBefore: rows.rows.length > 50 ? reviews[49]!.headVersion : null,
      });
    });
  }
  async review(
    target: string,
    body: unknown,
    authorize: Authorize,
    complete?: (c: pg.PoolClient) => Promise<void>,
  ) {
    if (target !== ECB_RATE_SOURCE)
      throw new NotFoundException('Unknown policy-rate source.');
    const parsed = input(EcbRateReviewSchema, body),
      request = { ...parsed, requestId: parsed.requestId.toLowerCase() };
    const fingerprint = sha(JSON.stringify(request));
    await authorize();
    return this.transaction(async (c) => {
      const current = await this.locked(c, true);
      const prior = await c.query<{ fingerprint: string; payload: unknown }>(
        'SELECT fingerprint,payload FROM ecb_rate_reviews WHERE request_id=$1',
        [request.requestId],
      );
      await authorize();
      if (prior.rows[0]) {
        if (complete || prior.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Review request already consumed. Create a new proposal against the current source head.',
          );
        return EcbRateReviewReceiptSchema.parse(prior.rows[0].payload);
      }
      if (current.version !== request.expectedVersion || !current.edition)
        throw new ConflictException(
          'Rate source changed or has no accepted edition. Reload and review again.',
        );
      if (request.status === 'withdrawn' && current.status !== 'published')
        throw new ConflictException(
          'Only a currently published source can be withdrawn.',
        );
      await this.edition(c, current.edition);
      await authorize();
      const receipt = EcbRateReviewReceiptSchema.parse({
        requestId: request.requestId,
        sourceId: ECB_RATE_SOURCE,
        headVersion: current.version + 1,
        edition:
          request.status === 'withdrawn'
            ? current.published_edition!
            : current.edition,
        status: request.status,
        correctionNote: request.correctionNote,
        reviewedAt: new Date().toISOString(),
      });
      await c.query(
        "UPDATE ecb_rate_head SET version=$2,status=$3,published_edition=CASE WHEN $3='published' THEN edition ELSE published_edition END,reviewed_at=$4 WHERE id=$1",
        [target, receipt.headVersion, receipt.status, receipt.reviewedAt],
      );
      await c.query(
        'INSERT INTO ecb_rate_reviews(request_id,fingerprint,edition,status,head_version,reviewed_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          receipt.requestId,
          fingerprint,
          receipt.edition,
          receipt.status,
          receipt.headVersion,
          receipt.reviewedAt,
          receipt,
        ],
      );
      await authorize();
      if (complete) await complete(c);
      return receipt;
    });
  }
  async refresh(body: unknown, authorize: Authorize) {
    const id = input(EcbRateRefreshSchema, body).requestId.toLowerCase();
    await authorize();
    let c: pg.PoolClient | undefined,
      locked = false,
      transaction = false,
      started = false;
    let retainedHash: string | null = null,
      category: EcbRateRun['category'] = 'fetch';
    try {
      c = await this.pool.connect();
      const gate = await c.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(360680) AS locked',
      );
      locked = gate.rows[0]?.locked === true;
      if (!locked)
        throw new ConflictException('An ECB rate refresh is already running.');
      await authorize();
      await c.query(
        "UPDATE ecb_rate_runs SET status='failed',category='interrupted',finished_at=clock_timestamp() WHERE status='running'",
      );
      const prior = await c.query<RunRow>(
        'SELECT * FROM ecb_rate_runs WHERE request_id=$1',
        [id],
      );
      await authorize();
      if (prior.rows[0]) return run(prior.rows[0]);
      const recent = await c.query(
        "SELECT 1 FROM ecb_rate_runs WHERE started_at>clock_timestamp()-interval '60 seconds' LIMIT 1",
      );
      if (recent.rowCount)
        throw new ConflictException(
          'Wait at least 60 seconds between new ECB source requests. Same-request receipts can be reopened now.',
        );
      await c.query(
        "INSERT INTO ecb_rate_runs(request_id,status,category) VALUES($1,'running','pending')",
        [id],
      );
      started = true;
      const raw = await this.fetchSource();
      if (raw.url !== ECB_RATE_URL || raw.hash !== ecbReceiptHash(raw))
        throw Error('Invalid retrieval receipt.');
      category = 'storage';
      const collection = this.mongo.db().collection<Raw>('ecb_rate_raw');
      await collection.updateOne(
        { _id: raw.hash },
        { $setOnInsert: raw },
        { upsert: true, timeoutMS: 3000, maxTimeMS: 2500 },
      );
      const retained = await collection.findOne(
        { _id: raw.hash },
        { timeoutMS: 3000, maxTimeMS: 2500 },
      );
      if (!retained || ecbReceiptHash(retained) !== raw.hash)
        throw Error('Raw rate receipt not retained.');
      retainedHash = raw.hash;
      category = 'parse';
      const parsed = parseEcbRates(raw.body);
      const canonicalHash = sha(JSON.stringify(parsed.observations));
      category = 'storage';
      await c.query('BEGIN');
      transaction = true;
      const current = await this.locked(c, true);
      const previous = current.edition
        ? await c.query<{ canonical_hash: string }>(
            'SELECT canonical_hash FROM ecb_rate_editions WHERE edition=$1',
            [current.edition],
          )
        : null;
      if (current.edition) {
        const previousEdition = await this.edition(c, current.edition);
        const keys = new Set(
          parsed.observations.map((row) => `${row.series}/${row.effectiveOn}`),
        );
        if (
          previousEdition.observations.some(
            (row) => !keys.has(`${row.series}/${row.effectiveOn}`),
          )
        ) {
          category = 'parse';
          throw Error(
            'Previously accepted change dates disappeared from this full response.',
          );
        }
      }
      await authorize();
      let edition = current.edition;
      const changed = previous?.rows[0]?.canonical_hash !== canonicalHash;
      if (changed) {
        edition = (current.edition ?? 0) + 1;
        const value = EcbRateEditionSchema.parse({
          edition,
          parserVersion: ECB_RATE_PARSER,
          sourceId: ECB_RATE_SOURCE,
          sourceUrl: raw.url,
          retrievedAt: raw.retrievedAt,
          responsePreparedAt: parsed.responsePreparedAt,
          sourceHash: raw.hash,
          unit: 'percent-per-annum',
          region: 'euro-area',
          knownAt: null,
          vintageBasis: 'retrieval-revision-only',
          observations: parsed.observations,
        });
        await c.query(
          'INSERT INTO ecb_rate_editions(edition,retrieved_at,source_hash,canonical_hash,payload) VALUES($1,$2,$3,$4,$5)',
          [edition, raw.retrievedAt, raw.hash, canonicalHash, value],
        );
        await c.query(
          'INSERT INTO ecb_rate_observations(edition,series,effective_on,value) SELECT $1,r.series,r."effectiveOn"::date,r.value::numeric FROM jsonb_to_recordset($2::jsonb) AS r(series text,"effectiveOn" text,value text)',
          [edition, JSON.stringify(parsed.observations)],
        );
      }
      await c.query(
        'UPDATE ecb_rate_head SET edition=$2,version=version+$3,checked_at=$4 WHERE id=$1',
        [ECB_RATE_SOURCE, edition, changed ? 1 : 0, raw.retrievedAt],
      );
      const result = await c.query<RunRow>(
        "UPDATE ecb_rate_runs SET status='succeeded',category=$2,finished_at=clock_timestamp(),edition=$3,source_hash=$4,observation_count=$5 WHERE request_id=$1 RETURNING *",
        [
          id,
          changed ? 'changed' : 'unchanged',
          edition,
          raw.hash,
          parsed.observations.length,
        ],
      );
      await authorize();
      await c.query('COMMIT');
      transaction = false;
      return run(result.rows[0]!);
    } catch (error) {
      if (c && transaction) {
        await c.query('ROLLBACK').catch(() => {});
      }
      if (started && c) {
        let failed: RunRow | undefined;
        try {
          const result = await c.query<RunRow>(
            "UPDATE ecb_rate_runs SET status='failed',category=$2,finished_at=clock_timestamp(),source_hash=$3 WHERE request_id=$1 AND status='running' RETURNING *",
            [id, category, retainedHash],
          );
          failed = result.rows[0];
        } catch {
          /* A failed receipt write does not become a successful run. */
        }
        if (!(error instanceof HttpException) && failed) {
          await authorize();
          return run(failed);
        }
      }
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'ECB rate refresh could not be completed. Reload run status before starting a new request.',
      );
    } finally {
      if (locked && c)
        await c.query('SELECT pg_advisory_unlock(360680)').catch(() => {});
      c?.release();
    }
  }
}

@Controller('policy-rates')
export class EcbRateController {
  constructor(@Inject(ECB_RATE_STORE) private readonly store: EcbRateStore) {}
  @Get() current() {
    return this.store.publicView();
  }
  @Get('history') history(@Query() query: unknown) {
    return this.store.history(query);
  }
  @Get('editions/:edition') edition(@Param('edition') edition: string) {
    return this.store.readEdition(edition);
  }
  @Get('evidence/:edition') async evidence(@Param('edition') edition: string) {
    return EcbRateEvidenceSchema.parse({
      scope: 'reviewed-numerical-edition',
      edition: await this.store.readEdition(edition),
    });
  }
}
@OperatorRead()
@Controller('ops/policy-rates')
export class OpsEcbRateController {
  constructor(
    @Inject(ECB_RATE_STORE) private readonly store: EcbRateStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() current(@Headers('cookie') cookie?: string) {
    return this.store.operations(() => this.ops.permission(cookie, 'read'));
  }
  @Get('history') history(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.history(query, () => this.ops.permission(cookie, 'read'));
  }
  @Get('runs') runs(@Headers('cookie') cookie?: string) {
    return this.store.runs(() => this.ops.permission(cookie, 'read'));
  }
  @Get('reviews') reviews(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.reviews(query, () => this.ops.permission(cookie, 'read'));
  }
  @Get('editions/:edition') edition(
    @Param('edition') edition: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.readEdition(edition, () =>
      this.ops.permission(cookie, 'read'),
    );
  }
  @Get('retained/:id') retained(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.retained(id, () => this.ops.permission(cookie, 'read'));
  }
  @OperatorAction('prepare') @Post('refresh') refresh(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.store.refresh(body, () =>
      this.ops.permission(cookie, 'prepare'),
    );
  }
  @OperatorAction('blocked') @Put('review') review(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.store.review(ECB_RATE_SOURCE, body, () =>
      this.ops.require(cookie),
    );
  }
}
export function ecbRateProvider(config: AppConfig) {
  return { provide: ECB_RATE_STORE, useValue: new EcbRateStore(config) };
}
