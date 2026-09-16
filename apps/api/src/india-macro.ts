import {
  IndiaGdpArchiveRequestSchema,
  IndiaGdpArchiveResultSchema,
} from '@fingent360/contracts';
import {
  fetchIndiaGdpArchive,
  parsePibArchiveMetadata,
} from './india-gdp-archive-provider.js';
import {
  IndiaGdpInputSchema,
  IndiaGdpEditionSchema,
  IndiaGdpPublicEditionSchema,
  INDIA_GDP_PARSER,
  selectIndiaGdp,
} from '@fingent360/contracts';
import { parseIndiaGdpRelease } from './india-gdp-provider.js';
import { canonicalSourceJson } from './canonical-source-json.js';
import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  Inject,
  ServiceUnavailableException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Param,
  NotFoundException,
} from '@nestjs/common';
import {
  IndiaMacroQueuePageSchema,
  IndiaMacroAttemptPageSchema,
  IndiaMacroImportSchema,
  IndiaMacroReviewSchema,
  IndiaMacroEditionSchema,
  IndiaMacroDashboardSchema,
  IndiaCalendarInputSchema,
  IndiaCalendarEditionSchema,
  parseIndiaCpiCapture,
  selectIndiaCpiVintages,
} from '@fingent360/contracts';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import type { AppConfig } from './config.js';
import type pg from 'pg';
import { parseIndiaCpiRelease } from './india-macro-provider.js';
const RAW = Symbol('INDIA_MACRO_RAW');
const hash = (value: unknown) =>
  createHash('sha256').update(canonicalSourceJson(value)).digest('hex');
class IndiaRaw {
  readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await this.mongo.close();
  }
  async put(value: unknown) {
    const id = hash(value);
    await this.mongo
      .db()
      .collection<{ _id: string; value: unknown }>('india_macro_raw')
      .updateOne({ _id: id }, { $setOnInsert: { value } }, { upsert: true });
    return id;
  }
  async read(id: string) {
    const row = await this.mongo
      .db()
      .collection<{ _id: string; value: unknown }>('india_macro_raw')
      .findOne({ _id: id });
    if (!row || hash(row.value) !== id)
      throw new ConflictException(
        'Retained source evidence is missing or changed.',
      );
    return row.value;
  }
}
export const indiaMacroProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new IndiaRaw(config),
});
const published = `(SELECT r.payload->>'decision' FROM india_macro_reviews r WHERE r.edition_id=e.id ORDER BY r.created_at DESC,r.request_id DESC LIMIT 1)='publish'`;
@Controller('india-macro')
export class IndiaMacroController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() async overview(@Query('asOf') asOf?: string) {
    if (
      asOf &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(asOf) ||
        !Number.isFinite(Date.parse(asOf)) ||
        new Date(asOf).toISOString().slice(0, 19) !== asOf.slice(0, 19))
    )
      throw new BadRequestException('Use an explicit UTC as-of timestamp.');
    const at = asOf ? new Date(asOf).toISOString() : null;
    return this.store.transaction(async (c) => {
      await c.query('LOCK TABLE india_macro_reviews IN SHARE MODE');
      const rows = await c.query(
        `SELECT kind,payload FROM india_macro_editions e WHERE ${published} ORDER BY created_at DESC,id LIMIT 601`,
      );
      if (
        rows.rows.length > 600 ||
        rows.rows.filter((row) => row.kind === 'cpi').length > 500 ||
        rows.rows.filter((row) => row.kind === 'gdp').length > 500 ||
        rows.rows.filter((row) => row.kind === 'calendar').length > 100
      )
        throw new ConflictException(
          'Snapshot limit reached. Use a narrower registry scope before adding more editions.',
        );
      const editions = rows.rows
        .filter((row) => row.kind === 'cpi')
        .map((row) => {
          const parsed = IndiaMacroEditionSchema.parse(row.payload);
          return {
            id: parsed.id,
            parser: parsed.parser,
            hash: parsed.hash,
            retrievedAt: parsed.retrievedAt,
            publishedAt: parsed.publishedAt,
            sourceUrl: parsed.sourceUrl,
            title: parsed.title,
            points: parsed.points,
            apiPoints: parsed.apiPoints,
            reconciliation: parsed.reconciliation,
          };
        });
      const calendars = rows.rows
        .filter((row) => row.kind === 'calendar')
        .map((row) => IndiaCalendarEditionSchema.parse(row.payload));
      const gdpEditions = rows.rows
        .filter((row) => row.kind === 'gdp')
        .map((row) => {
          const parsed = IndiaGdpEditionSchema.parse(row.payload);
          return IndiaGdpPublicEditionSchema.parse({
            id: parsed.id,
            parser: parsed.parser,
            hash: parsed.hash,
            retrievedAt: parsed.retrievedAt,
            sourceUrl: parsed.sourceUrl,
            publishedAt: parsed.publishedAt,
            title: parsed.title,
            point: parsed.point,
            nextRelease: parsed.nextRelease,
          });
        });
      return IndiaMacroDashboardSchema.parse({
        gdp: {
          editions: gdpEditions,
          selected: selectIndiaGdp(gdpEditions, at),
        },
        cpi: {
          capturedAt: new Date().toISOString(),
          asOf: at,
          editions,
          selected: selectIndiaCpiVintages(editions, at),
        },
        calendar: calendars[0] ?? null,
        calendarHistory: calendars,
      });
    });
  }
}
@OperatorRead()
@Controller('ops/india-macro')
export class IndiaMacroOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: IndiaRaw,
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
        "SELECT e.id,e.kind,e.payload,COALESCE((SELECT r.payload->>'decision' FROM india_macro_reviews r WHERE r.edition_id=e.id ORDER BY r.created_at DESC,r.request_id DESC LIMIT 1),'draft') AS state FROM india_macro_editions e ORDER BY e.created_at DESC,e.id LIMIT 100",
      );
      await this.actor(cookie, 'read', c);
      return rows.rows;
    });
  }
  private async page(
    cookie: string | undefined,
    after: string | undefined,
    attempts: boolean,
  ) {
    await this.actor(cookie, 'read');
    if (
      after !== undefined &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z\|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        after,
      )
    )
      throw new BadRequestException('Invalid India macro queue cursor.');
    const [at, id] = after?.split('|') ?? [null, null];
    if (
      at &&
      (!Number.isFinite(Date.parse(at)) ||
        new Date(at).toISOString().slice(0, 19) !== at.slice(0, 19))
    )
      throw new BadRequestException('Invalid queue timestamp.');
    return this.store.transaction(async (c) => {
      const rows = attempts
        ? await c.query(
            'SELECT id,hash,reason,created_at,to_char(created_at AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS cursor_at FROM india_macro_attempts WHERE ($1::timestamptz IS NULL OR (created_at,id)<($1::timestamptz,$2::uuid)) ORDER BY created_at DESC,id DESC LIMIT 26',
            [at, id],
          )
        : await c.query(
            "SELECT e.id,e.kind,e.payload,to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cursor_at,COALESCE((SELECT r.payload->>'decision' FROM india_macro_reviews r WHERE r.edition_id=e.id ORDER BY r.created_at DESC,r.request_id DESC LIMIT 1),'draft') AS state FROM india_macro_editions e WHERE ($1::timestamptz IS NULL OR (e.created_at,e.id)<($1::timestamptz,$2::uuid)) ORDER BY e.created_at DESC,e.id DESC LIMIT 26",
            [at, id],
          );
      const visible = rows.rows.slice(0, 25),
        last = visible.at(-1),
        nextCursor =
          rows.rows.length > 25 && last ? `${last.cursor_at}|${last.id}` : null;
      await this.actor(cookie, 'read', c);
      return attempts
        ? IndiaMacroAttemptPageSchema.parse({
            rows: visible.map((row) => ({
              id: row.id,
              hash: row.hash,
              reason: row.reason,
              createdAt: row.created_at.toISOString(),
            })),
            nextCursor,
          })
        : IndiaMacroQueuePageSchema.parse({
            rows: visible.map((row) => ({
              id: row.id,
              kind: row.kind,
              payload: row.payload,
              state: row.state,
            })),
            nextCursor,
          });
    });
  }
  @Get('queue') queuePage(
    @Headers('cookie') cookie?: string,
    @Query('after') after?: string,
  ) {
    return this.page(cookie, after, false);
  }
  @Get('attempt-page') attemptPage(
    @Headers('cookie') cookie?: string,
    @Query('after') after?: string,
  ) {
    return this.page(cookie, after, true);
  }
  @Get('archive-evidence/:hash') async archiveEvidence(
    @Param('hash') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.actor(cookie, 'read');
    if (!/^[a-f0-9]{64}$/.test(id))
      throw new BadRequestException('Invalid archive receipt.');
    return this.store.transaction(async (c) => {
      const value = await this.raw.read(id);
      if (!value || typeof value !== 'object')
        throw new NotFoundException('Archive receipt unavailable.');
      if (
        'retrievedAt' in value &&
        typeof value.retrievedAt === 'string' &&
        'indexHash' in value &&
        typeof value.indexHash === 'string' &&
        /^[a-f0-9]{64}$/.test(value.indexHash)
      ) {
        const index = await this.raw.read(value.indexHash);
        if (
          !index ||
          typeof index !== 'object' ||
          !('indexUrl' in index) ||
          index.indexUrl !== 'https://archive.pib.gov.in/archive2/erelease.aspx'
        )
          throw new NotFoundException('Archive original unavailable.');
        await this.actor(cookie, 'read', c);
        return { ...value, index };
      }
      if (
        !('indexUrl' in value) ||
        value.indexUrl !== 'https://archive.pib.gov.in/archive2/erelease.aspx'
      )
        throw new NotFoundException('Archive receipt unavailable.');
      await this.actor(cookie, 'read', c);
      return value;
    });
  }
  @Get('attempts') async attempts(@Headers('cookie') cookie?: string) {
    await this.actor(cookie, 'read');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        'SELECT id,hash,reason,created_at FROM india_macro_attempts ORDER BY created_at DESC,id LIMIT 100',
      );
      await this.actor(cookie, 'read', c);
      return rows.rows.map((row) => ({
        id: row.id,
        hash: row.hash,
        reason: row.reason,
        createdAt: row.created_at.toISOString(),
      }));
    });
  }
  @Get('attempts/:id/evidence') async attemptedEvidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.actor(cookie, 'read');
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new BadRequestException('Invalid attempt.');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        'SELECT hash FROM india_macro_attempts WHERE id=$1',
        [id],
      );
      if (!rows.rows[0]) throw new NotFoundException('Attempt unavailable.');
      const value = await this.raw.read(rows.rows[0].hash);
      await this.actor(cookie, 'read', c);
      return value;
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.actor(cookie, 'read');
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new BadRequestException('Invalid edition.');
    return this.store.transaction(async (c) => {
      const found = await c.query(
        'SELECT payload FROM india_macro_editions WHERE id=$1',
        [id],
      );
      if (!found.rows[0]) throw new NotFoundException('Edition unavailable.');
      const value = await this.raw.read(found.rows[0].payload.hash);
      await this.actor(cookie, 'read', c);
      return value;
    });
  }
  private async retain(
    id: string,
    kind: string,
    input: unknown,
    cookie: string | undefined,
    make: (retrievedAt: string, hash: string) => unknown,
  ) {
    const fingerprint = hash(input);
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        id,
      ]);
      const actor = await this.actor(cookie, 'prepare', c);
      const old = await c.query(
        'SELECT fingerprint FROM india_macro_editions WHERE id=$1',
        [id],
      );
      if (old.rows[0]) {
        if (old.rows[0].fingerprint !== fingerprint)
          throw new ConflictException('Capture ID belongs to another source.');
        await this.actor(cookie, 'prepare', c);
        return { id, status: 'retained', reason: null };
      }
      const attempted = await c.query(
        'SELECT reason,fingerprint FROM india_macro_attempts WHERE id=$1',
        [id],
      );
      if (attempted.rows[0]) {
        if (attempted.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Capture ID belongs to a quarantined source. Use a new capture for corrected evidence.',
          );
        await this.actor(cookie, 'prepare', c);
        return { id, status: 'quarantined', reason: attempted.rows[0].reason };
      }
      const digest = await this.raw.put(input);
      let payload: unknown;
      try {
        payload = make(new Date().toISOString(), digest);
      } catch (cause) {
        const reason = (
          cause instanceof Error ? cause.message : 'Unsupported source format.'
        ).slice(0, 3000);
        await c.query(
          'INSERT INTO india_macro_attempts(id,hash,reason,actor_id,fingerprint) VALUES($1,$2,$3,$4,$5)',
          [id, digest, reason, actor, fingerprint],
        );
        await this.actor(cookie, 'prepare', c);
        return { id, status: 'quarantined', reason };
      }
      await c.query(
        'INSERT INTO india_macro_editions(id,kind,fingerprint,actor_id,payload) VALUES($1,$2,$3,$4,$5)',
        [id, kind, fingerprint, actor, payload],
      );
      await this.actor(cookie, 'prepare', c);
      return { id, status: 'retained', reason: null };
    });
  }
  @Post('import') @OperatorAction('prepare') async capture(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = IndiaMacroImportSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Complete the source release, API capture and permissions.',
      );
    const input = parsed.data;
    await this.actor(cookie, 'prepare');
    return this.retain(
      input.requestId,
      'cpi',
      input,
      cookie,
      (retrievedAt, digest) => {
        const release = parseIndiaCpiRelease(
          input.releaseHtml,
          input.releaseUrl,
          retrievedAt,
        );
        if (release.publishedAt > retrievedAt)
          throw Error('Publication is in the future.');
        const apiPoints = parseIndiaCpiCapture(input.apiBody);
        if (!apiPoints.length) throw Error('API capture is empty.');
        return IndiaMacroEditionSchema.parse({
          id: input.requestId,
          parser: 'mospi-cpi2024-pib-v1',
          hash: digest,
          retrievedAt,
          ...release,
          apiPoints,
          reconciliation: release.points.every((point) =>
            apiPoints.some(
              (current) =>
                current.period === point.period &&
                current.index === point.index &&
                current.inflation === point.inflation,
            ),
          )
            ? 'matches-current-capture'
            : 'different-current-capture',
          rightsEvidence: input.rightsEvidence,
        });
      },
    );
  }
  @Post('gdp-archive') @OperatorAction('prepare') async archive(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = IndiaGdpArchiveRequestSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Choose one calendar month and confirm actual source rights.',
      );
    if (parsed.data.month > new Date().toISOString().slice(0, 7))
      throw new BadRequestException(
        'Choose an elapsed or current calendar month.',
      );
    await this.actor(cookie, 'prepare');
    const archive = await fetchIndiaGdpArchive(parsed.data.month).catch(
      (cause) => {
        throw new ServiceUnavailableException(
          'Official archive discovery is unavailable. Retry this month later.',
          { cause },
        );
      },
    );
    await this.actor(cookie, 'prepare');
    const indexHash = await this.raw.put({
      month: archive.month,
      indexUrl: archive.indexUrl,
      indexHash: archive.indexHash,
      callback: archive.callback,
    });
    const captureHash = await this.raw.put({
      indexHash,
      retrievedAt: archive.retrievedAt,
      failures: archive.failures,
    });
    const results = [];
    for (const release of archive.releases) {
      const fingerprint = hash({
          month: archive.month,
          releaseUrl: release.url,
          releaseHtml: release.html,
          rightsEvidence: parsed.data.rightsEvidence,
        }),
        id = `${fingerprint.slice(0, 8)}-${fingerprint.slice(8, 12)}-4${fingerprint.slice(13, 16)}-8${fingerprint.slice(17, 20)}-${fingerprint.slice(20, 32)}`;
      const input = IndiaGdpInputSchema.parse({
        requestId: id,
        releaseUrl: release.url,
        releaseHtml: release.html,
        archiveEvidence: { month: archive.month, hash: indexHash },
        rightsEvidence: parsed.data.rightsEvidence,
        rightsConfirmed: true,
      });
      results.push(
        await this.retain(id, 'gdp', input, cookie, (retrievedAt, digest) => {
          const metadata = parsePibArchiveMetadata(input.releaseHtml);
          if (
            new Date(Date.parse(metadata.publishedAt) + 330 * 60000)
              .toISOString()
              .slice(0, 7) !== archive.month
          )
            throw Error('Archive release date falls outside requested month.');
          return IndiaGdpEditionSchema.parse({
            id,
            parser: INDIA_GDP_PARSER,
            hash: digest,
            retrievedAt,
            rightsEvidence: input.rightsEvidence,
            ...parseIndiaGdpRelease(
              input.releaseHtml,
              input.releaseUrl,
              retrievedAt,
            ),
          });
        }),
      );
    }
    await this.actor(cookie, 'prepare');
    return IndiaGdpArchiveResultSchema.parse({
      month: archive.month,
      indexHash,
      captureHash,
      retrievedAt: archive.retrievedAt,
      failures: archive.failures,
      results,
    });
  }
  @Post('gdp') @OperatorAction('prepare') async gdp(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = IndiaGdpInputSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Complete the original GDP HTML, source URL and permissions.',
      );
    const input = parsed.data;
    await this.actor(cookie, 'prepare');
    return this.retain(
      input.requestId,
      'gdp',
      input,
      cookie,
      (retrievedAt, digest) =>
        IndiaGdpEditionSchema.parse({
          id: input.requestId,
          parser: INDIA_GDP_PARSER,
          hash: digest,
          retrievedAt,
          rightsEvidence: input.rightsEvidence,
          ...parseIndiaGdpRelease(
            input.releaseHtml,
            input.releaseUrl,
            retrievedAt,
          ),
        }),
    );
  }
  @Post('calendar') @OperatorAction('prepare') async calendar(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = IndiaCalendarInputSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Complete the official PDF, exact calendar transcription and rights.',
      );
    const input = parsed.data;
    if (
      !Buffer.from(input.pdfBase64, 'base64')
        .subarray(0, 5)
        .equals(Buffer.from('%PDF-'))
    )
      throw new BadRequestException('Attach the original PDF.');
    await this.actor(cookie, 'prepare');
    return this.retain(
      input.requestId,
      'calendar',
      input,
      cookie,
      (retrievedAt, digest) =>
        IndiaCalendarEditionSchema.parse({
          id: input.requestId,
          hash: digest,
          retrievedAt,
          sourceUrl: input.sourceUrl,
          editionLabel: input.editionLabel,
          events: input.events,
          basis: 'reviewed-official-calendar-transcription',
        }),
    );
  }
  @Post('review') @OperatorAction('approve') async review(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = IndiaMacroReviewSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Complete the review.');
    const input = parsed.data;
    await this.actor(cookie, 'approve');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const found = await c.query(
        'SELECT * FROM india_macro_editions WHERE id=$1 FOR UPDATE',
        [input.editionId],
      );
      const actor = await this.actor(cookie, 'approve', c);
      if (!found.rows[0]) throw new NotFoundException('Edition unavailable.');
      const old = await c.query(
        'SELECT payload FROM india_macro_reviews WHERE request_id=$1',
        [input.requestId],
      );
      if (old.rows[0]) {
        if (hash(old.rows[0].payload) !== hash(input))
          throw new ConflictException('Review request changed.');
        await this.actor(cookie, 'approve', c);
        return input;
      }
      if (input.decision === 'publish') {
        if (!this.ops.namedMode || found.rows[0].actor_id === actor)
          throw new ForbiddenException('Use an independent named publisher.');
        const retained = await this.raw.read(found.rows[0].payload.hash);
        if (found.rows[0].kind === 'gdp') {
          const original = IndiaGdpInputSchema.parse(retained),
            edition = IndiaGdpEditionSchema.parse(found.rows[0].payload),
            reparsed = parseIndiaGdpRelease(
              original.releaseHtml,
              original.releaseUrl,
              edition.retrievedAt,
            );
          if (hash({ ...edition, ...reparsed }) !== hash(edition))
            throw new ConflictException(
              'GDP receipt differs from retained original.',
            );
          const duplicates = await c.query(
            "SELECT payload FROM india_macro_editions WHERE kind='gdp' AND id<>$1 AND payload->>'publishedAt'=$2 AND payload->'point'->>'baseYear'=$3",
            [input.editionId, edition.publishedAt, edition.point.baseYear],
          );
          if (
            duplicates.rows.some(
              (row) => hash(row.payload.point) !== hash(edition.point),
            )
          )
            throw new ConflictException(
              'Conflicting GDP values share one original publication timestamp and base.',
            );
        }
        if (found.rows[0].kind === 'cpi') {
          const clashes = await c.query(
            "SELECT payload FROM india_macro_editions WHERE kind='cpi' AND id<>$1 AND payload->>'publishedAt'=$2",
            [input.editionId, found.rows[0].payload.publishedAt],
          );
          if (
            clashes.rows.some(
              (row) =>
                hash(row.payload.points) !== hash(found.rows[0].payload.points),
            )
          )
            throw new ConflictException(
              'Conflicting values share one original publication timestamp. Investigate the source revision before publication.',
            );
        }
      }
      await c.query(
        'INSERT INTO india_macro_reviews(request_id,edition_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, input.editionId, actor, input],
      );
      await this.actor(cookie, 'approve', c);
      return input;
    });
  }
}
