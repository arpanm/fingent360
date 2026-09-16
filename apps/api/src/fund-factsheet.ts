import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  FactsheetPageSchema,
  FactsheetCaptureSchema,
  FactsheetReviewSchema,
  FactsheetEditionSchema,
  FactsheetListSchema,
  FactsheetSnapshotSchema,
  FactsheetMappingSchema,
  FundNavSchema,
  parseKotakFactsheet,
  factsheetIdentityMatches,
  factsheetIdentityKey,
  FACTSHEET_PARSER,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { FundsRawStore, FUNDS_RAW } from './funds-bonds.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
const canonicalSourceJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
function input<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      'Review factsheet fields and explicit Direct/Regular mappings.',
    );
  return result.data;
}
async function mapping(
  c: pg.PoolClient,
  code: string,
  plan: 'Direct' | 'Regular',
) {
  const rows = await c.query(
    "SELECT o.payload,e.id FROM fund_nav_observations o JOIN fund_nav_editions e ON e.id=o.edition_id WHERE o.scheme_code=$1 AND (SELECT decision FROM fund_nav_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY o.observed_on DESC,e.created_at DESC,e.id LIMIT 1",
    [code],
  );
  const row = rows.rows[0];
  if (!row)
    throw new ConflictException(
      'Choose a published AMFI identity for each plan.',
    );
  const identity = FundNavSchema.parse(row.payload);
  if (!factsheetIdentityMatches(identity, plan))
    throw new ConflictException(
      'AMFI AMC, exact scheme name and explicit plan must match the factsheet. Legacy missing-plan records are not inferred.',
    );
  return FactsheetMappingSchema.parse({
    plan,
    schemeCode: code,
    navEditionId: row.id,
    identity,
  });
}
async function project(
  c: pg.PoolClient,
  row: Record<string, unknown>,
  publicOnly = false,
) {
  const review = (
    await c.query(
      'SELECT * FROM fund_factsheet_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
      [row.id],
    )
  ).rows[0];
  const state =
    review?.decision === 'publish'
      ? 'published'
      : review?.decision === 'withdraw'
        ? 'withdrawn'
        : row.parsed_values
          ? 'draft'
          : 'quarantined';
  const mappings = z
    .array(FactsheetMappingSchema)
    .parse(review?.mappings ?? []);
  if (publicOnly) {
    if (state !== 'published' || mappings.length !== 2) return null;
    for (const bound of mappings) {
      try {
        const current = await mapping(c, bound.schemeCode, bound.plan);
        if (
          factsheetIdentityKey(current.identity) !==
          factsheetIdentityKey(bound.identity)
        )
          return null;
        const original = (
          await c.query(
            'SELECT decision FROM fund_nav_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
            [bound.navEditionId],
          )
        ).rows[0];
        if (original?.decision !== 'publish') return null;
      } catch (error) {
        if (error instanceof ConflictException) return null;
        throw error;
      }
    }
  }
  return FactsheetEditionSchema.parse({
    id: row.id,
    parser: FACTSHEET_PARSER,
    hash: row.hash,
    sourceUrl: row.source_url,
    retrievedAt: (row.retrieved_at as Date).toISOString(),
    values: row.parsed_values,
    error: row.error,
    state,
    mappings,
    reviewedAt: review?.reviewed_at.toISOString() ?? null,
  });
}
@Controller('fund-factsheets')
export class FundFactsheetController {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  private readAll(code?: string) {
    return this.account.transaction(async (c) => {
      await c.query(
        'LOCK TABLE fund_factsheet_reviews,fund_nav_reviews IN SHARE MODE',
      );
      const rows = await c.query(
        "SELECT e.* FROM fund_factsheet_editions e WHERE (SELECT decision FROM fund_factsheet_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY retrieved_at DESC,id LIMIT 101",
      );
      if (rows.rows.length > 100)
        throw new ServiceUnavailableException(
          'Factsheet history exceeds100 captures; request an archive.',
        );
      const editions = [];
      for (const row of rows.rows) {
        const value = await project(c, row, true);
        if (
          value &&
          (!code || value.mappings.some((m) => m.schemeCode === code))
        )
          editions.push(value);
      }
      return FactsheetListSchema.parse({ editions });
    });
  }
  @Get() read(
    @Query('schemeCode') code?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    if (code !== undefined) input(z.string().regex(/^[0-9]{5,8}$/), code);
    const page = input(FactsheetPageSchema, { cursor, limit });
    return this.account.transaction(async (c) => {
      await c.query(
        'LOCK TABLE fund_factsheet_reviews,fund_nav_reviews IN SHARE MODE',
      );
      const [at, id] = page.cursor?.split('|') ?? [];
      const rows = await c.query(
        "SELECT e.* FROM fund_factsheet_editions e JOIN LATERAL (SELECT decision,mappings FROM fund_factsheet_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1) r ON r.decision='publish' WHERE ($1::timestamptz IS NULL OR (e.retrieved_at,e.id)<($1::timestamptz,$2::uuid)) AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(r.mappings) m WHERE m->>'schemeCode'=$3)) ORDER BY e.retrieved_at DESC,e.id DESC LIMIT $4",
        [at ?? null, id ?? null, code ?? null, page.limit + 1],
      );
      const scanned = rows.rows.slice(0, page.limit),
        editions = [];
      for (const row of scanned) {
        const value = await project(c, row, true);
        if (value) editions.push(value);
      }
      const last = scanned.at(-1);
      return FactsheetListSchema.parse({
        editions,
        nextCursor:
          rows.rows.length > page.limit && last
            ? last.retrieved_at.toISOString() + '|' + last.id
            : null,
      });
    });
  }
  @Get('snapshot') async snapshot() {
    return FactsheetSnapshotSchema.parse({
      capturedAt: new Date().toISOString(),
      ...(await this.readAll()),
    });
  }
}
@OperatorRead()
@Controller('ops/fund-factsheets')
export class OpsFundFactsheetController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(FUNDS_RAW) private readonly raw: FundsRawStore,
  ) {}
  private async actor(
    cookie: string | undefined,
    p: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const actor = await this.ops.permission(cookie, p, c);
    return typeof actor === 'string' ? actor : actor.identity.id;
  }
  @Get() queue(
    @Headers('cookie') cookie?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const page = input(FactsheetPageSchema, { cursor, limit });
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      await c.query('LOCK TABLE fund_factsheet_reviews IN SHARE MODE');
      const [at, id] = page.cursor?.split('|') ?? [];
      const rows = await c.query(
          'SELECT * FROM fund_factsheet_editions WHERE ($1::timestamptz IS NULL OR (retrieved_at,id)<($1::timestamptz,$2::uuid)) ORDER BY retrieved_at DESC,id DESC LIMIT $3',
          [at ?? null, id ?? null, page.limit + 1],
        ),
        scanned = rows.rows.slice(0, page.limit),
        editions = [];
      for (const row of scanned) editions.push(await project(c, row));
      await this.actor(cookie, 'read', c);
      const last = scanned.at(-1);
      return FactsheetListSchema.parse({
        editions,
        nextCursor:
          rows.rows.length > page.limit && last
            ? last.retrieved_at.toISOString() + '|' + last.id
            : null,
      });
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    input(z.uuid(), id);
    await this.actor(cookie, 'read');
    const row = await this.account.transaction(
      async (c) =>
        (
          await c.query(
            'SELECT hash FROM fund_factsheet_editions WHERE id=$1',
            [id],
          )
        ).rows[0],
    );
    if (!row) throw new NotFoundException('Factsheet unavailable.');
    const raw = await this.raw.read(row.hash);
    await this.actor(cookie, 'read');
    if (!raw || hash(raw.body) !== row.hash)
      throw new ServiceUnavailableException(
        'Original factsheet is missing or corrupt.',
      );
    return { id, hash: row.hash, body: raw.body };
  }
  @OperatorAction('prepare') @Post('import') async capture(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    const data = input(FactsheetCaptureSchema, body),
      actor = await this.actor(cookie, 'prepare');
    if (Buffer.byteLength(data.body, 'utf8') > 1000000)
      throw new BadRequestException('Factsheet exceeds1MB.');
    const digest = hash(data.body),
      at = new Date().toISOString();
    let values = null,
      error = null;
    try {
      values = parseKotakFactsheet(data.body, data.sourceUrl);
      if (values.observedOn > at.slice(0, 10))
        throw Error('Future source date.');
    } catch {
      values = null;
      error =
        'Unsupported or inconsistent factsheet. Original retained; publication unavailable.';
    }
    await this.raw.retain(digest, data.body, at);
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'prepare', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'fund-factsheet:' + data.requestId,
      ]);
      const existing = (
        await c.query('SELECT * FROM fund_factsheet_editions WHERE id=$1', [
          data.requestId,
        ])
      ).rows[0];
      if (existing) {
        if (
          existing.hash !== digest ||
          existing.source_url !== data.sourceUrl ||
          existing.permission_reference !== data.permissionReference ||
          existing.prepared_by !== actor
        )
          throw new ConflictException(
            'Capture request reused with different evidence or actor.',
          );
        const result = await project(c, existing);
        await this.actor(cookie, 'prepare', c);
        return result;
      }
      const row = (
        await c.query(
          'INSERT INTO fund_factsheet_editions(id,hash,source_url,retrieved_at,parsed_values,error,prepared_by,permission_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
          [
            data.requestId,
            digest,
            data.sourceUrl,
            at,
            values,
            error,
            actor,
            data.permissionReference,
          ],
        )
      ).rows[0];
      const result = await project(c, row);
      await this.actor(cookie, 'prepare', c);
      return result;
    });
  }
  @OperatorAction('approve') @Post(':id/review') review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    input(z.uuid(), id);
    const data = input(FactsheetReviewSchema, body),
      fingerprint = hash(canonicalSourceJson({ id, data }));
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c);
      await c.query('LOCK TABLE fund_nav_reviews IN SHARE MODE');
      const row = (
        await c.query(
          'SELECT * FROM fund_factsheet_editions WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Factsheet unavailable.');
      const old = (
        await c.query(
          'SELECT fingerprint FROM fund_factsheet_reviews WHERE request_id=$1',
          [data.requestId],
        )
      ).rows[0];
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new ConflictException('Review request reused.');
        const result = await project(c, row);
        await this.actor(cookie, 'approve', c);
        return result;
      }
      const mappings = [];
      if (data.decision === 'publish') {
        const named = await this.ops.permission(cookie, 'approve', c);
        if (typeof named === 'string' || actor === row.prepared_by)
          throw new ForbiddenException(
            'A different named reviewer must verify the factsheet and both plan identities.',
          );
        if (!row.parsed_values)
          throw new ConflictException('Quarantined factsheet cannot publish.');
        const original = await this.raw.read(row.hash);
        if (!original || hash(original.body) !== row.hash)
          throw new ServiceUnavailableException(
            'Original factsheet missing or corrupt.',
          );
        if (
          canonicalSourceJson(
            parseKotakFactsheet(original.body, row.source_url),
          ) !== canonicalSourceJson(row.parsed_values)
        )
          throw new ConflictException(
            'Original factsheet does not reconstruct its receipt.',
          );
        if (
          !data.plans ||
          new Set(data.plans.map((p) => p.plan)).size !== 2 ||
          new Set(data.plans.map((p) => p.schemeCode)).size !== 2
        )
          throw new BadRequestException(
            'Provide different admitted AMFI codes for Direct and Regular.',
          );
        for (const p of data.plans)
          mappings.push(await mapping(c, p.schemeCode, p.plan));
      }
      await c.query(
        'INSERT INTO fund_factsheet_reviews(request_id,edition_id,fingerprint,decision,mappings,reason,reviewer) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          data.requestId,
          id,
          fingerprint,
          data.decision,
          JSON.stringify(mappings),
          data.reason,
          actor,
        ],
      );
      const result = await project(c, row);
      await this.actor(cookie, 'approve', c);
      return result;
    });
  }
}
