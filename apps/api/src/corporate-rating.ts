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
  CorporateRatingCaptureSchema,
  CorporateRatingReviewSchema,
  CorporateRatingEditionSchema,
  CorporateRatingListSchema,
  CorporateRatingSnapshotSchema,
  CORPORATE_RATING_SOURCE,
  CORPORATE_RATING_VERSION,
  CORPORATE_RATINGS,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { FundsRawStore, FUNDS_RAW } from './funds-bonds.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
const sha = (v: string | Uint8Array) =>
  createHash('sha256').update(v).digest('hex');
function parse<T>(schema: z.ZodType<T>, v: unknown) {
  const r = schema.safeParse(v);
  if (!r.success) throw new BadRequestException('Review rating source fields.');
  return r.data;
}
function cursor(after?: string) {
  if (!after) return null;
  const p = after.split('|');
  if (
    p.length !== 2 ||
    !z.iso.datetime().safeParse(p[0]).success ||
    !z.uuid().safeParse(p[1]).success
  )
    throw new BadRequestException('Invalid rating history cursor.');
  return p;
}
async function project(c: pg.PoolClient, row: Record<string, unknown>) {
  const r = (
    await c.query(
      'SELECT decision,reviewed_at FROM corporate_rating_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
      [row.id],
    )
  ).rows[0];
  return CorporateRatingEditionSchema.parse({
    id: row.id,
    version: CORPORATE_RATING_VERSION,
    sourceUrl: CORPORATE_RATING_SOURCE.url,
    hash: row.hash,
    recordedAt: (row.recorded_at as Date).toISOString(),
    retrievedAt: null,
    publishedOn: '2026-05-13',
    annexureAsOf: '2026-03-31',
    observations: row.error ? [] : CORPORATE_RATINGS,
    state:
      r?.decision === 'publish'
        ? 'published'
        : r?.decision === 'withdraw'
          ? 'withdrawn'
          : row.error
            ? 'quarantined'
            : 'draft',
    error: row.error,
    reviewedAt: r?.reviewed_at.toISOString() ?? null,
  });
}
async function list(
  c: pg.PoolClient,
  after: string | undefined,
  publicOnly: boolean,
) {
  const p = cursor(after),
    rows = (
      await c.query(
        'SELECT e.*,to_char(recorded_at AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') page_at FROM corporate_rating_editions e WHERE ($1::timestamptz IS NULL OR (recorded_at,id)<($1::timestamptz,$2::uuid))' +
          (publicOnly
            ? " AND (SELECT decision FROM corporate_rating_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish'"
            : '') +
          ' ORDER BY recorded_at DESC,id DESC LIMIT 26',
        [p?.[0] ?? null, p?.[1] ?? null],
      )
    ).rows;
  const editions = [];
  for (const row of rows.slice(0, 25)) editions.push(await project(c, row));
  return CorporateRatingListSchema.parse({
    editions,
    nextCursor: rows.length > 25 ? rows[24].page_at + '|' + rows[24].id : null,
  });
}
export async function corporateRatingSnapshot(c: pg.PoolClient) {
  await c.query('LOCK TABLE corporate_rating_reviews IN SHARE MODE');
  const rows = (
    await c.query(
      "SELECT * FROM corporate_rating_editions e WHERE (SELECT decision FROM corporate_rating_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY recorded_at DESC,id DESC LIMIT 101",
    )
  ).rows;
  if (rows.length > 100)
    throw new ServiceUnavailableException('Rating snapshot capacity exceeded.');
  const editions = [];
  for (const row of rows) editions.push(await project(c, row));
  return CorporateRatingSnapshotSchema.parse({
    capturedAt: new Date().toISOString(),
    editions,
  });
}
@Controller('corporate-ratings')
export class CorporateRatingsController {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  @Get() read(@Query('after') after?: string) {
    return this.account.transaction(async (c) => {
      await c.query('LOCK TABLE corporate_rating_reviews IN SHARE MODE');
      return list(c, after, true);
    });
  }
  @Get('snapshot') snapshot() {
    return this.account.transaction((c) => corporateRatingSnapshot(c));
  }
}
@Controller('ops/corporate-ratings')
export class CorporateRatingsOperationsController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(FUNDS_RAW) private readonly raw: FundsRawStore,
  ) {}
  private async actor(
    cookie: string | undefined,
    action: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const a = await this.ops.permission(cookie, action, c);
    return typeof a === 'string' ? a : a.identity.id;
  }
  @Get() @OperatorRead() read(
    @Query('after') after?: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const result = await list(c, after, false);
      await this.actor(cookie, 'read', c);
      return result;
    });
  }
  @Get(':id/evidence') @OperatorRead() evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    parse(z.uuid(), id);
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const row = (
        await c.query('SELECT * FROM corporate_rating_editions WHERE id=$1', [
          id,
        ])
      ).rows[0];
      if (!row) throw new NotFoundException('Rating original unavailable.');
      const raw = await this.raw.read(row.hash);
      if (!raw || sha(Buffer.from(raw.body, 'base64')) !== row.hash)
        throw new ServiceUnavailableException(
          'Rating original unavailable or corrupt.',
        );
      await this.actor(cookie, 'read', c);
      return {
        hash: row.hash,
        body: raw.body,
        sourceUrl: CORPORATE_RATING_SOURCE.url,
      };
    });
  }
  @Post('import') @OperatorAction('prepare') async capture(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    const input = parse(CorporateRatingCaptureSchema, body);
    await this.actor(cookie, 'prepare');
    const bytes = Buffer.from(input.body, 'base64');
    if (bytes.length > 2000000 || bytes.toString('base64') !== input.body)
      throw new BadRequestException(
        'Original must be canonical base64 up to2MB.',
      );
    const hash = sha(bytes),
      error =
        hash !== CORPORATE_RATING_SOURCE.hash
          ? 'Original bytes do not match the researched ICRA142975 revision. A new verified adapter is required.'
          : null;
    await this.raw.retain(hash, input.body, new Date().toISOString());
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'corporate-rating:' + input.requestId,
      ]);
      let row = (
        await c.query('SELECT * FROM corporate_rating_editions WHERE id=$1', [
          input.requestId,
        ])
      ).rows[0];
      if (row) {
        if (
          row.hash !== hash ||
          row.permission_reference !== input.permissionReference
        )
          throw new ConflictException('Rating capture request changed.');
      } else
        row = (
          await c.query(
            'INSERT INTO corporate_rating_editions(id,hash,error,permission_reference,prepared_by) VALUES($1,$2,$3,$4,$5) RETURNING *',
            [input.requestId, hash, error, input.permissionReference, actor],
          )
        ).rows[0];
      const result = await project(c, row);
      await this.actor(cookie, 'prepare', c);
      return result;
    });
  }
  @Post(':id/review') @OperatorAction('approve') review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    parse(z.uuid(), id);
    const input = parse(CorporateRatingReviewSchema, body),
      fingerprint = sha(JSON.stringify({ id, input }));
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c);
      const row = (
        await c.query(
          'SELECT * FROM corporate_rating_editions WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Rating original unavailable.');
      const prior = (
        await c.query(
          'SELECT fingerprint FROM corporate_rating_reviews WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictException('Rating review request changed.');
        const result = await project(c, row);
        await this.actor(cookie, 'approve', c);
        return result;
      }
      if (input.decision === 'publish') {
        const named = await this.ops.permission(cookie, 'approve', c);
        if (typeof named === 'string' || actor === row.prepared_by)
          throw new ForbiddenException(
            'A separate named reviewer must inspect rating evidence.',
          );
        if (
          row.error ||
          !input.originalChecked ||
          input.sourceHash !== row.hash
        )
          throw new ConflictException(
            'Review the exact original hash and instrument transcription.',
          );
        const raw = await this.raw.read(row.hash);
        if (!raw || sha(Buffer.from(raw.body, 'base64')) !== row.hash)
          throw new ServiceUnavailableException(
            'Rating original unavailable or corrupt.',
          );
      }
      await c.query(
        'INSERT INTO corporate_rating_reviews(request_id,edition_id,fingerprint,decision,reason,reviewer) VALUES($1,$2,$3,$4,$5,$6)',
        [input.requestId, id, fingerprint, input.decision, input.reason, actor],
      );
      const result = await project(c, row);
      await this.actor(cookie, 'approve', c);
      return result;
    });
  }
}
