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
  ECB_FX_SOURCE,
  ECB_FX_URL,
  ECB_FX_PARSER,
  EcbFxEditionSchema,
  EcbFxRefreshSchema,
  EcbFxReviewSchema,
  EcbFxReviewReceiptSchema,
  EcbFxRunSchema,
  EcbFxOperationsSchema,
  EcbFxPublicSchema,
  EcbFxHistorySchema,
  EcbFxEvidenceSchema,
  EcbFxRetainedSchema,
  EcbFxRunsSchema,
  EcbFxReviewsSchema,
  parseEcbFx,
  ecbFxEvaluationDay,
  deriveEcbFx,
  compareEcbFx,
  type EcbFxEdition,
  type EcbFxRun,
} from '@fingent360/contracts';
import {
  fetchEcbFx,
  ecbFxReceiptHash,
  type EcbFxRaw,
} from './ecb-fx-provider.js';
import type { AppConfig } from './config.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';

export const ECB_FX_STORE = Symbol('ECB_FX_STORE');
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
// A source-wide withdrawal retires every earlier publication. A later review
// admits only its explicitly published edition; older retained data stay private.
const publicReview =
  "r.status='published' AND r.head_version>(SELECT COALESCE(max(w.head_version),0) FROM ecb_fx_reviews w WHERE w.status='withdrawn')";
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
  status: EcbFxRun['status'];
  category: EcbFxRun['category'];
  edition: number | null;
  source_hash: string | null;
  observation_count: number;
};
type Raw = EcbFxRaw & { _id: string };
function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException('Invalid ECB reference FX request.');
  return parsed.data;
}
const number = (value: string) =>
  input(z.string().regex(/^[1-9][0-9]{0,8}$/), value);
const run = (row: RunRow) =>
  EcbFxRunSchema.parse({
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

export class EcbFxStore {
  private readonly pool: pg.Pool;
  private readonly mongo: MongoClient;
  constructor(
    config: AppConfig,
    private readonly fetchSource: () => Promise<EcbFxRaw> = fetchEcbFx,
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
        'ECB reference FX storage is unavailable. Retry; previously reviewed values are unchanged.',
      );
    } finally {
      c?.release();
    }
  }
  private async locked(c: pg.PoolClient, write = false) {
    const rows = await c.query<Head>(
      `SELECT version,status,edition,published_edition,checked_at,reviewed_at FROM ecb_fx_head WHERE id=$1 FOR ${write ? 'UPDATE' : 'SHARE'}`,
      [ECB_FX_SOURCE],
    );
    if (!rows.rows[0])
      throw new ServiceUnavailableException(
        'ECB reference FX source is not initialized.',
      );
    return rows.rows[0];
  }
  private async edition(c: pg.PoolClient, edition: number) {
    const rows = await c.query<{ payload: unknown }>(
      'SELECT payload FROM ecb_fx_editions WHERE edition=$1',
      [edition],
    );
    if (!rows.rows[0]) throw new NotFoundException('FX edition unavailable.');
    const value = EcbFxEditionSchema.parse(rows.rows[0].payload);
    // Canonical numeric storage independently reconciles the public JSON edition.
    const facts = await c.query<{
      date: string;
      usd: string;
      inr: string;
      usdSource: string;
      inrSource: string;
      derived: string;
    }>(
      `SELECT to_char(observed_on,'YYYY-MM-DD') AS date,usd_per_eur::text AS usd,inr_per_eur::text AS inr,
       usd_source AS "usdSource",inr_source AS "inrSource",derived_inr_per_usd::text AS derived
       FROM ecb_fx_observations WHERE edition=$1 ORDER BY observed_on`,
      [edition],
    );
    const decimal = (input: string) =>
      input.includes('.') ? input.replace(/0+$/, '').replace(/\.$/, '') : input;
    if (
      facts.rows.length !== value.observations.length ||
      facts.rows.some((row, index) => {
        const source = value.observations[index]!;
        return (
          row.date !== source.date ||
          row.usdSource !== source.usdPerEur ||
          row.inrSource !== source.inrPerEur ||
          decimal(row.usd) !== decimal(source.usdPerEur) ||
          decimal(row.inr) !== decimal(source.inrPerEur) ||
          row.derived !== deriveEcbFx(source.usdPerEur, source.inrPerEur).value
        );
      })
    )
      throw Error('Numerical edition reconciliation failed.');
    return value;
  }
  async publicView() {
    return this.transaction(async (c) => {
      const current = await this.locked(c),
        now = new Date();
      return EcbFxPublicSchema.parse({
        status: current.status === 'draft' ? 'never-published' : current.status,
        edition:
          current.status === 'published'
            ? await this.edition(c, current.published_edition!)
            : null,
        checkedAt: current.checked_at?.toISOString() ?? null,
        reviewedAt: current.reviewed_at?.toISOString() ?? null,
        evaluatedAt: now.toISOString(),
        evaluatedOn: ecbFxEvaluationDay(now),
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
        throw new NotFoundException('Reviewed FX history unavailable.');
      const rows = await c.query<{ edition: number }>(
        `SELECT edition FROM ecb_fx_editions e WHERE ($1::integer IS NULL OR edition<$1) ${authorize ? '' : `AND EXISTS(SELECT 1 FROM ecb_fx_reviews r WHERE r.edition=e.edition AND ${publicReview})`} ORDER BY edition DESC LIMIT 51`,
        [args.before ? Number(args.before) : null],
      );
      const editions: EcbFxEdition[] = [];
      for (const row of rows.rows.slice(0, 50))
        editions.push(await this.edition(c, row.edition));
      if (authorize) await authorize();
      return EcbFxHistorySchema.parse({
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
          `SELECT 1 FROM ecb_fx_reviews r WHERE r.edition=$1 AND ${publicReview} LIMIT 1`,
          [edition],
        );
        if (current.status !== 'published' || !reviewed.rowCount)
          throw new NotFoundException('Reviewed FX edition unavailable.');
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
        'SELECT * FROM ecb_fx_runs ORDER BY started_at DESC,request_id DESC LIMIT 1',
      );
      await authorize();
      return EcbFxOperationsSchema.parse({
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
        'SELECT * FROM ecb_fx_runs ORDER BY started_at DESC,request_id DESC LIMIT 51',
      );
      await authorize();
      return EcbFxRunsSchema.parse({
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
        'SELECT * FROM ecb_fx_runs WHERE request_id=$1',
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
        .collection<Raw>('ecb_fx_raw')
        .findOne({ _id: hash }, { timeoutMS: 3000, maxTimeMS: 2500 });
      await authorize();
      if (!raw || raw.url !== ECB_FX_URL || ecbFxReceiptHash(raw) !== hash)
        throw new ServiceUnavailableException(
          'Retained FX evidence is unavailable.',
        );
      return EcbFxRetainedSchema.parse({
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
        'SELECT payload FROM ecb_fx_reviews WHERE ($1::integer IS NULL OR head_version<$1) ORDER BY head_version DESC LIMIT 51',
        [args.before ? Number(args.before) : null],
      );
      const reviews = rows.rows
        .slice(0, 50)
        .map((row) => EcbFxReviewReceiptSchema.parse(row.payload));
      await authorize();
      return EcbFxReviewsSchema.parse({
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
    if (target !== ECB_FX_SOURCE)
      throw new NotFoundException('Unknown ECB reference FX source.');
    const parsed = input(EcbFxReviewSchema, body),
      request = { ...parsed, requestId: parsed.requestId.toLowerCase() };
    const fingerprint = sha(JSON.stringify(request));
    await authorize();
    return this.transaction(async (c) => {
      const current = await this.locked(c, true);
      const prior = await c.query<{ fingerprint: string; payload: unknown }>(
        'SELECT fingerprint,payload FROM ecb_fx_reviews WHERE request_id=$1',
        [request.requestId],
      );
      await authorize();
      if (prior.rows[0]) {
        if (complete || prior.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Review request already consumed. Create a new proposal against the current source head.',
          );
        return EcbFxReviewReceiptSchema.parse(prior.rows[0].payload);
      }
      if (current.version !== request.expectedVersion || !current.edition)
        throw new ConflictException(
          'FX source changed or has no accepted edition. Reload and review again.',
        );
      if (request.status === 'withdrawn' && current.status !== 'published')
        throw new ConflictException(
          'Only a currently published source can be withdrawn.',
        );
      await this.edition(c, current.edition);
      await authorize();
      const receipt = EcbFxReviewReceiptSchema.parse({
        requestId: request.requestId,
        sourceId: ECB_FX_SOURCE,
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
        "UPDATE ecb_fx_head SET version=$2,status=$3,published_edition=CASE WHEN $3='published' THEN edition ELSE published_edition END,reviewed_at=$4 WHERE id=$1",
        [target, receipt.headVersion, receipt.status, receipt.reviewedAt],
      );
      await c.query(
        'INSERT INTO ecb_fx_reviews(request_id,fingerprint,edition,status,head_version,reviewed_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
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
    const id = input(EcbFxRefreshSchema, body).requestId.toLowerCase();
    await authorize();
    let c: pg.PoolClient | undefined,
      locked = false,
      transaction = false,
      started = false;
    let raw: EcbFxRaw | null = null,
      retainedHash: string | null = null,
      category: EcbFxRun['category'] = 'fetch';
    try {
      c = await this.pool.connect();
      const gate = await c.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock(360810) AS locked',
      );
      locked = gate.rows[0]?.locked === true;
      if (!locked)
        throw new ConflictException(
          'An ECB reference FX refresh is already running.',
        );
      await authorize();
      await c.query(
        "UPDATE ecb_fx_runs SET status='failed',category='interrupted',finished_at=clock_timestamp() WHERE status='running'",
      );
      const prior = await c.query<RunRow>(
        'SELECT * FROM ecb_fx_runs WHERE request_id=$1',
        [id],
      );
      await authorize();
      if (prior.rows[0]) return run(prior.rows[0]);
      const recent = await c.query(
        "SELECT 1 FROM ecb_fx_runs WHERE started_at>clock_timestamp()-interval '60 seconds' LIMIT 1",
      );
      if (recent.rowCount)
        throw new ConflictException(
          'Wait at least 60 seconds between new reference XML requests. Same-request receipts can be reopened now.',
        );
      await c.query(
        "INSERT INTO ecb_fx_runs(request_id,status,category) VALUES($1,'running','pending')",
        [id],
      );
      started = true;
      raw = await this.fetchSource();
      if (raw.url !== ECB_FX_URL || raw.hash !== ecbFxReceiptHash(raw))
        throw Error('Invalid retrieval receipt.');
      category = 'storage';
      const collection = this.mongo.db().collection<Raw>('ecb_fx_raw');
      await collection.updateOne(
        { _id: raw.hash },
        { $setOnInsert: raw },
        { upsert: true, timeoutMS: 3000, maxTimeMS: 2500 },
      );
      const retained = await collection.findOne(
        { _id: raw.hash },
        { timeoutMS: 3000, maxTimeMS: 2500 },
      );
      if (!retained || ecbFxReceiptHash(retained) !== raw.hash)
        throw Error('Raw FX receipt not retained.');
      retainedHash = raw.hash;
      category = 'parse';
      const parsed = parseEcbFx(raw.body);
      if (
        parsed.observations.some(
          (row) => row.date > ecbFxEvaluationDay(new Date(raw!.retrievedAt)),
        )
      )
        throw Error('A reported reference date is later than this retrieval.');
      // Original lexical inputs are part of the immutable edition: even a
      // source precision-only revision is preserved, separately from its ratio.
      const canonicalHash = sha(JSON.stringify(parsed.observations));
      category = 'storage';
      await c.query('BEGIN');
      transaction = true;
      const current = await this.locked(c, true);
      const previous = current.edition
        ? await c.query<{ canonical_hash: string }>(
            'SELECT canonical_hash FROM ecb_fx_editions WHERE edition=$1',
            [current.edition],
          )
        : null;
      const previousEdition = current.edition
        ? await this.edition(c, current.edition)
        : null;
      await authorize();
      let edition = current.edition;
      const changed = previous?.rows[0]?.canonical_hash !== canonicalHash;
      if (changed) {
        edition = (current.edition ?? 0) + 1;
        const value = EcbFxEditionSchema.parse({
          edition,
          parserVersion: ECB_FX_PARSER,
          sourceId: ECB_FX_SOURCE,
          sourceUrl: raw.url,
          retrievedAt: raw.retrievedAt,
          sourceHash: raw.hash,
          knownAt: null,
          vintageBasis: 'retrieval-revision-only',
          sourceWindow: 'rolling-90-day-file',
          windowStart: parsed.observations[0]!.date,
          windowEnd: parsed.observations[parsed.observations.length - 1]!.date,
          observations: parsed.observations,
          comparison: compareEcbFx(previousEdition, parsed.observations),
        });
        await c.query(
          'INSERT INTO ecb_fx_editions(edition,retrieved_at,source_hash,canonical_hash,payload) VALUES($1,$2,$3,$4,$5)',
          [edition, raw.retrievedAt, raw.hash, canonicalHash, value],
        );
        await c.query(
          `INSERT INTO ecb_fx_observations(edition,observed_on,usd_per_eur,inr_per_eur,usd_source,inr_source,derived_inr_per_usd)
          SELECT $1,r.date::date,r."usdPerEur"::numeric,r."inrPerEur"::numeric,r."usdPerEur",r."inrPerEur",(r."derivedInrPerUsd"->>'value')::numeric
          FROM jsonb_to_recordset($2::jsonb) AS r(date text,"usdPerEur" text,"inrPerEur" text,"derivedInrPerUsd" jsonb)`,
          [edition, JSON.stringify(parsed.observations)],
        );
      }
      await c.query(
        'UPDATE ecb_fx_head SET edition=$2,version=version+$3,checked_at=$4 WHERE id=$1',
        [ECB_FX_SOURCE, edition, changed ? 1 : 0, raw.retrievedAt],
      );
      const result = await c.query<RunRow>(
        "UPDATE ecb_fx_runs SET status='succeeded',category=$2,finished_at=clock_timestamp(),edition=$3,source_hash=$4,observation_count=$5 WHERE request_id=$1 RETURNING *",
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
            "UPDATE ecb_fx_runs SET status='failed',category=$2,finished_at=clock_timestamp(),source_hash=$3 WHERE request_id=$1 AND status='running' RETURNING *",
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
        'ECB reference FX refresh could not be completed. Reload run status before starting a new request.',
      );
    } finally {
      if (locked && c)
        await c.query('SELECT pg_advisory_unlock(360810)').catch(() => {});
      c?.release();
    }
  }
}

@Controller('reference-fx')
export class EcbFxController {
  constructor(@Inject(ECB_FX_STORE) private readonly store: EcbFxStore) {}
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
    return EcbFxEvidenceSchema.parse({
      scope: 'reviewed-numerical-edition',
      edition: await this.store.readEdition(edition),
    });
  }
}
@OperatorRead()
@Controller('ops/reference-fx')
export class OpsEcbFxController {
  constructor(
    @Inject(ECB_FX_STORE) private readonly store: EcbFxStore,
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
    return this.store.review(ECB_FX_SOURCE, body, () =>
      this.ops.require(cookie),
    );
  }
}
export function ecbFxProvider(config: AppConfig) {
  return { provide: ECB_FX_STORE, useValue: new EcbFxStore(config) };
}
