import {
  FILING_WATCH_ADMISSION_SQL,
  admitFilingWatchReview,
  lockFilingWatchAdmission,
} from './filing-watch.js';
import { EquityPriceRangeSchema } from '@fingent360/contracts';
import { readEquityPriceHistory } from './equity-price-history.js';
import { canonicalSourceJson } from './canonical-source-json.js';
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
import {
  reconcileEquityIdentity,
  EquityImportSchema,
  EquityFetchSchema,
  EquityEditionSchema,
  EquityReviewSchema,
  EquityQueueSchema,
  EquityCompanySchema,
  EquityCompaniesSchema,
  EquitySnapshotSchema,
  EQUITY_MASTER_URL,
  EQUITY_INDEX_URL,
  NSE_UDIFF_PARSER,
  NSE_ACTIONS_PARSER,
  NSE_ACTIONS_URL,
  NSE_INDAS_HTML_PARSER,
  NSE_INDAS_STATEMENTS_PARSER,
  NSE_BANKING_PARSER,
  NSE_GI_PARSER,
  NSE_LI_PARSER,
  isNseLiSource,
  isNseGiSource,
  isNseBankingSource,
  isNseIndasSource,
  type ActionIdentity,
  nseUdiffUrl,
  nseUdiffFilename,
  parseEquitySource,
} from '@fingent360/contracts';
import { readUdiffArchive } from './equity-udiff-archive.js';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import type { AppConfig } from './config.js';
import type pg from 'pg';

const hash = (body: string) => createHash('sha256').update(body).digest('hex');
export const EQUITY_COVERAGE_RAW = Symbol('EQUITY_COVERAGE_RAW');
const admission = `(SELECT decision FROM equity_reviews r WHERE r.edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' AND (${FILING_WATCH_ADMISSION_SQL})`;
function input<T>(schema: z.ZodType<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException('Invalid equity evidence request.');
  return result.data;
}
export class EquityRawStore {
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await this.mongo.close();
  }
  async retain(value: {
    hash: string;
    sourceUrl: string;
    retrievedAt: string;
    body: string;
  }) {
    try {
      await this.mongo
        .db()
        .collection<{
          _id: string;
          sourceUrl: string;
          retrievedAt: string;
          body: string;
        }>('equity_source_documents')
        .updateOne(
          { _id: value.hash },
          {
            $setOnInsert: {
              sourceUrl: value.sourceUrl,
              retrievedAt: value.retrievedAt,
              body: value.body,
            },
          },
          { upsert: true },
        );
    } catch {
      throw new ServiceUnavailableException(
        'Source retention unavailable. No edition was published.',
      );
    }
  }
  async read(id: string) {
    return this.mongo
      .db()
      .collection<{ _id: string; body: string }>('equity_source_documents')
      .findOne({ _id: id });
  }
  async retainArchive(id: string, bytes: Uint8Array, sourceUrl: string) {
    await this.mongo
      .db()
      .collection<{ _id: string; body: string; sourceUrl: string }>(
        'equity_source_archives',
      )
      .updateOne(
        { _id: id },
        {
          $setOnInsert: {
            body: Buffer.from(bytes).toString('base64'),
            sourceUrl,
          },
        },
        { upsert: true },
      );
  }
  async readArchive(id: string) {
    return this.mongo
      .db()
      .collection<{ _id: string; body: string }>('equity_source_archives')
      .findOne({ _id: id });
  }
}
export function equityCoverageProvider(config: AppConfig) {
  return { provide: EQUITY_COVERAGE_RAW, useValue: new EquityRawStore(config) };
}

export async function equityCompanyForTrace(c: pg.PoolClient, isin: string) {
  await lockFilingWatchAdmission(c);
  const result = await c.query(
    `SELECT o.payload,e.id,e.payload-'observations' AS edition FROM equity_observations o JOIN equity_editions e ON e.id=o.edition_id WHERE o.isin=$1 AND ${admission} ORDER BY o.effective_on DESC,e.created_at DESC,e.id,o.ordinal LIMIT 1001`,
    [isin],
  );
  if (!result.rowCount)
    throw new NotFoundException('No reviewed company evidence is available.');
  return companyRows(isin, result.rows);
}
const company = equityCompanyForTrace;
function companyRows(
  isin: string,
  all: { payload: unknown; id: string; edition: unknown }[],
) {
  const rows = all.slice(0, 1000).map((r) => ({
    ...r,
    edition: EquityEditionSchema.omit({ observations: true }).parse(r.edition),
    payload: EquityCompanySchema.shape.records.element.shape.observation.parse(
      r.payload,
    ),
  }));
  const identity = rows.find((r) => r.payload.kind === 'identity');
  const namedPrice = rows.find(
    (r) => r.payload.kind === 'price' && r.payload.udiff,
  );
  const parsed = EquityCompanySchema.parse({
    isin,
    name:
      identity?.payload.kind === 'identity'
        ? identity.payload.name
        : namedPrice?.payload.kind === 'price'
          ? (namedPrice.payload.udiff?.name ?? isin)
          : isin,
    records: rows.map((r) => ({
      observation: r.payload,
      editionId: r.id,
      sourceUrl: r.edition.sourceUrl,
      hash: r.edition.hash,
      retrievedAt: r.edition.retrievedAt,
      publishedAt: r.edition.publishedAt,
    })),
    truncated: all.length > 1000,
  });
  return EquityCompanySchema.parse({
    ...parsed,
    identityReconciliation: reconcileEquityIdentity(
      parsed.records,
      parsed.truncated,
    ),
  });
}
@Controller('equities')
export class EquityCoverageController {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  @Get() async list(@Query('after') after?: string, @Query('q') q?: string) {
    if (after !== undefined)
      input(z.string().regex(/^IN[A-Z0-9]{9}[0-9]$/), after);
    if (q !== undefined) input(z.string().max(100), q);
    return this.account.transaction(async (c) => {
      await lockFilingWatchAdmission(c);
      const result = await c.query(
        `SELECT DISTINCT o.isin FROM equity_observations o JOIN equity_editions e ON e.id=o.edition_id WHERE ${admission} AND ($1::text IS NULL OR o.isin>$1) AND ($2::text IS NULL OR position(lower($2) in lower(o.isin || ' ' || COALESCE(o.payload->>'name','') || ' ' || COALESCE(o.payload->>'symbol','') || ' ' || COALESCE(o.payload->'udiff'->>'name','') || ' ' || COALESCE(o.payload->'udiff'->>'symbol','')))>0) ORDER BY o.isin LIMIT 51`,
        [after ?? null, q?.trim() || null],
      );
      const companies = [];
      for (const row of result.rows.slice(0, 50)) {
        const data = await company(c, row.isin);
        companies.push({ isin: data.isin, name: data.name });
      }
      return EquityCompaniesSchema.parse({
        companies,
        nextAfter: result.rows.length > 50 ? result.rows[49].isin : null,
      });
    });
  }
  @Get('snapshot') async snapshot() {
    return this.account.transaction(async (c) => {
      await lockFilingWatchAdmission(c);
      // Publication/withdrawal cannot change admission during a snapshot capture.
      await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
      const rows = await c.query(
        `SELECT o.isin,o.payload,e.id,e.payload-'observations' AS edition FROM equity_observations o JOIN equity_editions e ON e.id=o.edition_id WHERE ${admission} ORDER BY o.isin,o.effective_on DESC,e.created_at DESC,e.id,o.ordinal LIMIT 100001`,
      );
      if (rows.rows.length > 100000)
        throw new ServiceUnavailableException(
          'Equity snapshot exceeds its limit; use connected browsing.',
        );
      const groups = new Map<string, typeof rows.rows>();
      for (const row of rows.rows) {
        const group = groups.get(row.isin) ?? [];
        group.push(row);
        groups.set(row.isin, group);
      }
      if (groups.size > 10000)
        throw new ServiceUnavailableException(
          'Too many companies for this device snapshot.',
        );
      const companies = [...groups].map(([isin, group]) =>
        companyRows(isin, group),
      );
      return EquitySnapshotSchema.parse({
        capturedAt: new Date().toISOString(),
        companies,
      });
    });
  }
  @Get(':isin/prices') async priceHistory(
    @Param('isin') isin: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('after') after?: string,
    @Query('limit') limit?: string,
  ) {
    input(z.string().regex(/^IN[A-Z0-9]{9}[0-9]$/), isin);
    const range = input(EquityPriceRangeSchema, {
      from,
      to,
      after: after ?? null,
      limit: limit === undefined ? 15 : Number(limit),
    });
    return this.account.transaction((c) =>
      readEquityPriceHistory(c, isin, range),
    );
  }
  @Get(':isin') async detail(@Param('isin') isin: string) {
    input(z.string().regex(/^IN[A-Z0-9]{9}[0-9]$/), isin);
    return this.account.transaction((c) => company(c, isin));
  }
}

@OperatorRead()
@Controller('ops/equities')
export class OpsEquityCoverageController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(EQUITY_COVERAGE_RAW) private readonly raw: EquityRawStore,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const actor = await this.ops.permission(cookie, permission, c);
    return typeof actor === 'string' ? actor : actor.identity.id;
  }
  @Get() async queue(@Headers('cookie') cookie?: string) {
    await this.actor(cookie, 'read');
    return this.account.transaction(async (c) => {
      const rows = await c.query(
        "SELECT e.payload,COALESCE((SELECT CASE decision WHEN 'publish' THEN 'published' ELSE 'withdrawn' END FROM equity_reviews r WHERE r.edition_id=e.id ORDER BY seq DESC LIMIT 1),'draft') AS state FROM equity_editions e ORDER BY e.created_at DESC,e.id LIMIT 50",
      );
      await this.actor(cookie, 'read', c);
      return EquityQueueSchema.parse({
        editions: rows.rows.map((r) => ({
          edition: r.payload,
          state: r.state,
        })),
      });
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    input(z.uuid(), id);
    await this.actor(cookie, 'read');
    const edition = await this.account.transaction(async (c) => {
      const rows = await c.query(
        'SELECT payload FROM equity_editions WHERE id=$1',
        [id],
      );
      await this.actor(cookie, 'read', c);
      return rows.rows[0]?.payload;
    });
    if (!edition) throw new NotFoundException('Edition unavailable.');
    const source = await this.raw.read(edition.hash);
    await this.actor(cookie, 'read');
    if (!source || hash(source.body) !== edition.hash)
      throw new ServiceUnavailableException(
        'Retained source does not reconcile.',
      );
    const archive = edition.archiveHash
      ? await this.raw.readArchive(edition.archiveHash)
      : null;
    await this.actor(cookie, 'read');
    if (
      edition.archiveHash &&
      (!archive ||
        createHash('sha256')
          .update(Buffer.from(archive.body, 'base64'))
          .digest('hex') !== edition.archiveHash)
    )
      throw new ServiceUnavailableException(
        'Original UDiFF archive does not reconcile.',
      );
    return {
      editionId: id,
      hash: edition.hash,
      body: source.body,
      archiveHash: edition.archiveHash ?? null,
      archiveBase64: archive?.body ?? null,
    };
  }
  @OperatorAction('prepare') @Post('import') async import(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.capture(input(EquityImportSchema, body), cookie);
  }
  @OperatorAction('prepare') @Post('fetch') async fetch(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    await this.actor(cookie, 'prepare');
    const data = input(EquityFetchSchema, body);
    const sourceUrl =
      data.parser === 'nse-equity-master-v1' ||
      data.parser === 'nse-equity-master-v2'
        ? EQUITY_MASTER_URL
        : data.parser === NSE_UDIFF_PARSER
          ? nseUdiffUrl(data.effectiveOn)
          : EQUITY_INDEX_URL;
    const existing = await this.account.transaction(async (c) => {
      const found = await c.query(
        'SELECT payload FROM equity_editions WHERE id=$1',
        [data.requestId],
      );
      await this.actor(cookie, 'prepare', c);
      return found.rows[0]?.payload;
    });
    if (existing) {
      const edition = EquityEditionSchema.parse(existing);
      if (
        edition.parser !== data.parser ||
        edition.sourceUrl !== sourceUrl ||
        edition.effectiveOn !== data.effectiveOn ||
        edition.publishedAt !== data.publishedAt ||
        edition.rightsBasis !== data.rightsBasis
      )
        throw new ConflictException(
          'Fetch request ID already belongs to different metadata.',
        );
      return edition;
    }
    const response = await fetch(sourceUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept:
          data.parser === NSE_UDIFF_PARSER ? 'application/zip' : 'text/csv',
        'User-Agent': 'Fingent360/1.0 (permitted source retrieval)',
      },
    });
    if (
      !response.ok ||
      !response.body ||
      /html/i.test(response.headers.get('content-type') ?? '')
    )
      throw new ServiceUnavailableException(
        'Official source did not return a usable source document. No cookies, challenge bypass or fallback source is used.',
      );
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 2000000)
          throw new BadRequestException('Official source exceeds 2 MB.');
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks);
    if (data.parser === NSE_UDIFF_PARSER) {
      const archiveHash = createHash('sha256').update(bytes).digest('hex');
      await this.raw.retainArchive(archiveHash, bytes, sourceUrl);
      let sourceBody;
      try {
        sourceBody = readUdiffArchive(
          bytes,
          nseUdiffFilename(data.effectiveOn),
        );
      } catch {
        throw new BadRequestException(
          'Retained UDiFF archive failed its filename, size or integrity checks.',
        );
      }
      return this.capture(
        {
          ...data,
          sourceUrl,
          body: sourceBody,
          sourceFileName: nseUdiffFilename(data.effectiveOn),
        },
        cookie,
        archiveHash,
      );
    }
    const sourceBody = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return this.capture({ ...data, sourceUrl, body: sourceBody }, cookie);
  }
  private async capture(
    data: z.infer<typeof EquityImportSchema>,
    cookie?: string,
    archiveHash?: string,
  ) {
    const actor = await this.actor(cookie, 'prepare');
    if (
      data.effectiveOn > new Date().toISOString().slice(0, 10) ||
      (data.publishedAt && Date.parse(data.publishedAt) > Date.now())
    )
      throw new BadRequestException(
        'Future source dates are not observations.',
      );
    const fixed =
      data.parser === 'nse-equity-master-v1' ||
      data.parser === 'nse-equity-master-v2'
        ? EQUITY_MASTER_URL
        : data.parser === 'nifty50-constituents-v1'
          ? EQUITY_INDEX_URL
          : data.parser === NSE_ACTIONS_PARSER
            ? NSE_ACTIONS_URL
            : data.parser === NSE_UDIFF_PARSER
              ? nseUdiffUrl(data.effectiveOn)
              : null;
    if (data.parser === NSE_LI_PARSER && !isNseLiSource(data.sourceUrl))
      throw new BadRequestException(
        'Life-insurance reports require the exact official NSE LI rendered source URL.',
      );
    if (data.parser === NSE_GI_PARSER && !isNseGiSource(data.sourceUrl))
      throw new BadRequestException(
        'General-insurance reports require the exact official NSE GI rendered source URL.',
      );
    if (
      data.parser === NSE_BANKING_PARSER &&
      !isNseBankingSource(data.sourceUrl)
    )
      throw new BadRequestException(
        'Bank reports require the exact official NSE Banking rendered source URL.',
      );
    if (
      (data.parser === NSE_INDAS_HTML_PARSER ||
        data.parser === NSE_INDAS_STATEMENTS_PARSER) &&
      !isNseIndasSource(data.sourceUrl)
    )
      throw new BadRequestException(
        'Ind AS HTML requires its original NSE rendered filing URL.',
      );
    if (fixed && data.sourceUrl !== fixed)
      throw new BadRequestException(
        'This parser requires its fixed official source URL.',
      );
    const retrievedAt = new Date().toISOString(),
      digest = hash(data.body),
      fingerprint = hash(JSON.stringify(data));
    await this.raw.retain({
      hash: digest,
      sourceUrl: data.sourceUrl,
      retrievedAt,
      body: data.body,
    });
    const replay = await this.account.transaction(async (c) => {
      const found = await c.query(
        'SELECT fingerprint,payload FROM equity_editions WHERE id=$1',
        [data.requestId],
      );
      await this.actor(cookie, 'prepare', c);
      if (!found.rows[0]) return null;
      if (found.rows[0].fingerprint !== fingerprint)
        throw new ConflictException(
          'Request ID already belongs to a different source.',
        );
      return EquityEditionSchema.parse(found.rows[0].payload);
    });
    if (replay) return replay;
    const identities: ActionIdentity[] =
      data.parser === NSE_ACTIONS_PARSER
        ? await this.account.transaction(async (c) => {
            const found = await c.query(
              `SELECT o.payload,e.id,e.payload->>'hash' AS hash FROM equity_observations o JOIN equity_editions e ON e.id=o.edition_id WHERE o.kind='identity' AND o.payload->>'exchange'='NSE' AND o.effective_on <= $1::date AND ${admission} ORDER BY o.effective_on DESC,e.created_at DESC LIMIT 100001`,
              [data.effectiveOn],
            );
            await this.actor(cookie, 'prepare', c);
            if (found.rows.length > 100000)
              throw new BadRequestException(
                'Identity history exceeds the action parser limit. Narrow source coverage before importing.',
              );
            return found.rows.map((row) => ({
              ...row.payload,
              editionId: row.id,
              hash: row.hash,
            }));
          })
        : [];
    let parsed;
    try {
      parsed = parseEquitySource(
        data.parser,
        data.body,
        data.effectiveOn,
        data.sourceFileName,
        identities,
      );
    } catch {
      throw new BadRequestException(
        'Retained source failed its strict parser. Check the documented version, source rows and published unambiguous NSE symbol/series identities.',
      );
    }
    if (parsed.observations.some((r) => r.effectiveOn > data.effectiveOn))
      throw new BadRequestException(
        'Observation dates exceed the declared source date.',
      );
    const edition = EquityEditionSchema.parse({
      id: data.requestId,
      hash: digest,
      parser: data.parser,
      sourceUrl: data.sourceUrl,
      effectiveOn: data.effectiveOn,
      publishedAt: data.publishedAt,
      retrievedAt,
      rightsBasis: data.rightsBasis,
      observations: parsed.observations,
      ...(data.sourceFileName ? { sourceFileName: data.sourceFileName } : {}),
      ...(parsed.coverage ? { coverage: parsed.coverage } : {}),
      ...(archiveHash ? { archiveHash } : {}),
    });
    return this.account.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        data.requestId,
      ]);
      const previous = await c.query(
        'SELECT fingerprint,payload FROM equity_editions WHERE id=$1',
        [data.requestId],
      );
      if (previous.rows[0]) {
        await this.actor(cookie, 'prepare', c);
        if (previous.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Request ID already belongs to a different source.',
          );
        return EquityEditionSchema.parse(previous.rows[0].payload);
      }
      await c.query(
        'INSERT INTO equity_editions(id,fingerprint,actor_hash,payload) VALUES($1,$2,$3,$4)',
        [data.requestId, fingerprint, actor, edition],
      );
      await c.query(
        "INSERT INTO equity_observations(edition_id,ordinal,isin,kind,effective_on,payload) SELECT $1,ordinality::integer,value->>'isin',value->>'kind',(value->>'effectiveOn')::date,value FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY",
        [data.requestId, JSON.stringify(edition.observations)],
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
    const data = input(EquityReviewSchema, body);
    await this.actor(cookie, 'approve');
    return this.account.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        data.requestId,
      ]);
      const found = await c.query(
        'SELECT actor_hash,payload FROM equity_editions WHERE id=$1 FOR UPDATE',
        [data.editionId],
      );
      if (!found.rows[0]) throw new NotFoundException('Edition unavailable.');
      const previous = await c.query(
        'SELECT edition_id,decision,reason FROM equity_reviews WHERE request_id=$1',
        [data.requestId],
      );
      const actor = await this.actor(cookie, 'approve', c);
      if (data.decision === 'publish')
        await admitFilingWatchReview(c, data.editionId, this.ops.namedMode);
      if (previous.rows[0]) {
        const p = previous.rows[0];
        if (
          p.edition_id !== data.editionId ||
          p.decision !== data.decision ||
          p.reason !== data.reason
        )
          throw new ConflictException('Review request ID already used.');
        return data;
      }
      if (
        data.decision === 'publish' &&
        this.ops.namedMode &&
        found.rows[0].actor_hash === actor
      )
        throw new ForbiddenException(
          'Another named operator must review this evidence.',
        );
      if (
        data.decision === 'publish' &&
        (found.rows[0].payload.parser === 'nse-equity-master-v2' ||
          found.rows[0].payload.parser === NSE_INDAS_HTML_PARSER ||
          found.rows[0].payload.parser === NSE_INDAS_STATEMENTS_PARSER ||
          found.rows[0].payload.parser === NSE_BANKING_PARSER ||
          found.rows[0].payload.parser === NSE_GI_PARSER ||
          found.rows[0].payload.parser === NSE_LI_PARSER ||
          EquityEditionSchema.parse(found.rows[0].payload).observations.some(
            (row) =>
              row.kind === 'fundamental' &&
              (row.statementContext ||
                row.bankContext ||
                row.insuranceContext ||
                row.lifeInsuranceContext),
          )) &&
        !this.ops.namedMode
      )
        throw new ForbiddenException(
          'Named independent review is required for this source.',
        );
      if (data.decision === 'publish') {
        const source = await this.raw.read(found.rows[0].payload.hash);
        if (!source || hash(source.body) !== found.rows[0].payload.hash)
          throw new ConflictException('Original source is missing or changed.');
        if (
          found.rows[0].payload.parser === NSE_INDAS_HTML_PARSER ||
          found.rows[0].payload.parser === NSE_INDAS_STATEMENTS_PARSER ||
          found.rows[0].payload.parser === NSE_BANKING_PARSER ||
          found.rows[0].payload.parser === NSE_GI_PARSER ||
          found.rows[0].payload.parser === NSE_LI_PARSER ||
          found.rows[0].payload.parser === 'nse-equity-master-v2'
        ) {
          const reconstructed = parseEquitySource(
            found.rows[0].payload.parser,
            source.body,
            found.rows[0].payload.effectiveOn,
          );
          if (
            hash(canonicalSourceJson(reconstructed.observations)) !==
            hash(canonicalSourceJson(found.rows[0].payload.observations))
          )
            throw new ConflictException(
              'Source receipt differs from its retained original.',
            );
        }
        const digest = found.rows[0].payload.archiveHash;
        if (digest) {
          const archive = await this.raw.readArchive(digest);
          if (
            !archive ||
            createHash('sha256')
              .update(Buffer.from(archive.body, 'base64'))
              .digest('hex') !== digest
          )
            throw new ConflictException(
              'Original archive is missing or changed.',
            );
        }
      }
      await c.query(
        'INSERT INTO equity_reviews(request_id,edition_id,actor_hash,decision,reason) VALUES($1,$2,$3,$4,$5)',
        [data.requestId, data.editionId, actor, data.decision, data.reason],
      );
      await this.actor(cookie, 'approve', c);
      return data;
    });
  }
}
