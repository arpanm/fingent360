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
  FundMergerCaptureSchema,
  FundMergerReviewSchema,
  FundMergerEditionSchema,
  FundMergerListSchema,
  FundMergerSnapshotSchema,
  fundMergerTerms,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { FundsRawStore, FUNDS_RAW } from './funds-bonds.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
const sha = (v: string | Uint8Array) =>
  createHash('sha256').update(v).digest('hex');
function parse<T>(schema: z.ZodType<T>, v: unknown) {
  const result = schema.safeParse(v);
  if (!result.success)
    throw new BadRequestException(
      'Review the merger notice and exact plan fields.',
    );
  return result.data;
}
function position(after?: string) {
  if (!after) return null;
  const parts = after.split('|');
  if (
    parts.length !== 2 ||
    !z.iso.datetime().safeParse(parts[0]).success ||
    !z.uuid().safeParse(parts[1]).success
  )
    throw new BadRequestException('Invalid merger page cursor.');
  return parts;
}
async function mapping(c: pg.PoolClient, code: string, name: string) {
  const row = (
    await c.query(
      "SELECT e.id,o.payload FROM fund_nav_observations o JOIN fund_nav_editions e ON e.id=o.edition_id WHERE o.scheme_code=$1 AND (o.payload->>'name'=$2 OR o.payload->>'name' LIKE $2||' - %' OR o.payload->>'name' LIKE $2||'-%') AND (SELECT decision FROM fund_nav_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY o.observed_on DESC,e.created_at DESC,e.id LIMIT 1",
      [code, name],
    )
  ).rows[0];
  if (
    !row ||
    !/^HDFC(?: Mutual Fund)?$/i.test(row.payload.amc) ||
    !(
      row.payload.name === name ||
      row.payload.name.startsWith(name + ' - ') ||
      row.payload.name.startsWith(name + '-')
    )
  )
    throw new ConflictException(
      'Select the exact admitted HDFC scheme and plan, including historical identity if renamed.',
    );
  return { editionId: row.id, observation: row.payload };
}
async function project(
  c: pg.PoolClient,
  row: Record<string, unknown>,
  publicOnly = false,
) {
  const review = (
    await c.query(
      'SELECT * FROM fund_merger_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
      [row.id],
    )
  ).rows[0];
  const item = FundMergerEditionSchema.parse({
    id: row.id,
    hash: row.hash,
    recordedAt: (row.recorded_at as Date).toISOString(),
    retrievedAt: null,
    terms: row.terms,
    error: row.error,
    state:
      review?.decision === 'publish'
        ? 'published'
        : review?.decision === 'withdraw'
          ? 'withdrawn'
          : row.error
            ? 'quarantined'
            : 'draft',
    mapping: review?.mapping ?? null,
    reviewedAt: review?.reviewed_at.toISOString() ?? null,
  });
  if (publicOnly) {
    if (item.state !== 'published' || !item.mapping) return null;
    for (const selected of [item.mapping.from, item.mapping.to]) {
      const admitted = (
        await c.query(
          "SELECT o.payload FROM fund_nav_observations o WHERE o.edition_id=$1 AND o.scheme_code=$2 AND (SELECT decision FROM fund_nav_reviews WHERE edition_id=o.edition_id ORDER BY seq DESC LIMIT 1)='publish'",
          [selected.editionId, selected.observation.schemeCode],
        )
      ).rows;
      if (
        !admitted.some(
          (r) =>
            JSON.stringify(r.payload) === JSON.stringify(selected.observation),
        )
      ) {
        const canon = (v: unknown) =>
          JSON.stringify(v, (_k, x) =>
            x && typeof x === 'object' && !Array.isArray(x)
              ? Object.fromEntries(Object.entries(x).sort())
              : x,
          );
        if (
          !admitted.some(
            (r) => canon(r.payload) === canon(selected.observation),
          )
        )
          return null;
      }
    }
  }
  return item;
}
export async function fundMergerSnapshot(c: pg.PoolClient) {
  await c.query(
    'LOCK TABLE fund_merger_reviews,fund_nav_reviews IN SHARE MODE',
  );
  const rows = (
    await c.query(
      "SELECT * FROM fund_merger_editions e WHERE (SELECT decision FROM fund_merger_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY recorded_at DESC,id DESC LIMIT 101",
    )
  ).rows;
  if (rows.length > 100)
    throw new ServiceUnavailableException(
      'Merger snapshot capacity exceeded; use paginated reader.',
    );
  const editions = [];
  for (const row of rows) {
    const item = await project(c, row, true);
    if (item) editions.push(item);
  }
  return FundMergerSnapshotSchema.parse({
    capturedAt: new Date().toISOString(),
    editions,
  });
}
async function page(
  c: pg.PoolClient,
  after: string | undefined,
  publicOnly: boolean,
  code?: string,
) {
  const pos = position(after);
  const filter = publicOnly
    ? " AND (SELECT decision FROM fund_merger_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish'"
    : '';
  const rows = (
    await c.query(
      'SELECT e.*,to_char(recorded_at AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') page_at FROM fund_merger_editions e WHERE ($1::timestamptz IS NULL OR (recorded_at,id)<($1::timestamptz,$2::uuid))' +
        filter +
        " AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM fund_merger_reviews r WHERE r.edition_id=e.id AND r.seq=(SELECT max(seq) FROM fund_merger_reviews WHERE edition_id=e.id) AND (r.mapping->'from'->'observation'->>'schemeCode'=$3 OR r.mapping->'to'->'observation'->>'schemeCode'=$3))) ORDER BY recorded_at DESC,id DESC LIMIT 26",
      [pos?.[0] ?? null, pos?.[1] ?? null, code ?? null],
    )
  ).rows;
  const editions = [];
  for (const row of rows.slice(0, 25)) {
    const item = await project(c, row, publicOnly);
    if (item) editions.push(item);
  }
  return FundMergerListSchema.parse({
    editions,
    nextCursor: rows.length > 25 ? rows[24].page_at + '|' + rows[24].id : null,
  });
}
@Controller('fund-mergers')
export class FundMergersController {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  @Get() read(
    @Query('after') after?: string,
    @Query('schemeCode') code?: string,
  ) {
    if (code !== undefined) parse(z.string().regex(/^\d{5,8}$/), code);
    return this.account.transaction(async (c) => {
      await c.query(
        'LOCK TABLE fund_merger_reviews,fund_nav_reviews IN SHARE MODE',
      );
      return page(c, after, true, code);
    });
  }
  @Get('snapshot') snapshot() {
    return this.account.transaction((c) => fundMergerSnapshot(c));
  }
}
@Controller('ops/fund-mergers')
export class FundMergersOperationsController {
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
      const result = await page(c, after, false);
      await this.actor(cookie, 'read', c);
      return result;
    });
  }
  @Get(':id/evidence') @OperatorRead() async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    parse(z.uuid(), id);
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const row = (
        await c.query('SELECT hash FROM fund_merger_editions WHERE id=$1', [id])
      ).rows[0];
      if (!row) throw new NotFoundException('Original unavailable.');
      const value = await this.raw.read(row.hash);
      if (!value || sha(Buffer.from(value.body, 'base64')) !== row.hash)
        throw new ServiceUnavailableException(
          'Original unavailable or corrupt.',
        );
      await this.actor(cookie, 'read', c);
      return { id, hash: row.hash, body: value.body, mime: 'application/pdf' };
    });
  }
  @Post('import') @OperatorAction('prepare') async capture(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    const input = parse(FundMergerCaptureSchema, body);
    await this.actor(cookie, 'prepare');
    const bytes = Buffer.from(input.body, 'base64');
    if (bytes.length > 1500000 || bytes.toString('base64') !== input.body)
      throw new BadRequestException(
        'Original exceeds1.5MB or invalid encoding.',
      );
    const hash = sha(bytes),
      terms = fundMergerTerms(input.from),
      error =
        bytes.subarray(0, 5).toString() !== '%PDF-' ||
        !bytes.subarray(-2048).includes(Buffer.from('%%EOF'))
          ? 'Unsupported PDF envelope; no source interpretation accepted.'
          : null;
    await this.raw.retain(hash, input.body, new Date().toISOString());
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'fund-merger:' + input.requestId,
      ]);
      let row = (
        await c.query('SELECT * FROM fund_merger_editions WHERE id=$1', [
          input.requestId,
        ])
      ).rows[0];
      if (row) {
        if (
          row.hash !== hash ||
          row.terms.from !== input.from ||
          row.permission_reference !== input.permissionReference
        )
          throw new ConflictException('Capture request changed.');
      } else
        row = (
          await c.query(
            'INSERT INTO fund_merger_editions(id,hash,terms,error,permission_reference,prepared_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
            [
              input.requestId,
              hash,
              terms,
              error,
              input.permissionReference,
              actor,
            ],
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
    const input = parse(FundMergerReviewSchema, body),
      fingerprint = sha(JSON.stringify({ id, input }));
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c);
      await c.query('LOCK TABLE fund_nav_reviews IN SHARE MODE');
      const row = (
        await c.query(
          'SELECT * FROM fund_merger_editions WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Notice unavailable.');
      const prior = (
        await c.query(
          'SELECT fingerprint FROM fund_merger_reviews WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictException('Review request changed.');
        const result = await project(c, row);
        await this.actor(cookie, 'approve', c);
        return result;
      }
      let selected = null;
      if (input.decision === 'publish') {
        const named = await this.ops.permission(cookie, 'approve', c);
        if (typeof named === 'string' || actor === row.prepared_by)
          throw new ForbiddenException(
            'A different named reviewer must inspect the original notice.',
          );
        if (
          row.error ||
          !input.originalAndPlansChecked ||
          !input.fromCode ||
          !input.toCode ||
          input.fromCode === input.toCode
        )
          throw new ConflictException(
            'Inspect the original and distinct exact AMFI plans before publication.',
          );
        const original = await this.raw.read(row.hash);
        if (!original || sha(Buffer.from(original.body, 'base64')) !== row.hash)
          throw new ServiceUnavailableException(
            'Original unavailable or corrupt.',
          );
        selected = {
          from: await mapping(c, input.fromCode, row.terms.from),
          to: await mapping(c, input.toCode, row.terms.to),
          planRelationship: 'independently-reviewed-no-conversion-ratio',
        };
      }
      await c.query(
        'INSERT INTO fund_merger_reviews(request_id,edition_id,fingerprint,decision,mapping,reason,reviewer) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          input.requestId,
          id,
          fingerprint,
          input.decision,
          selected,
          input.reason,
          actor,
        ],
      );
      const result = await project(c, row);
      await this.actor(cookie, 'approve', c);
      return result;
    });
  }
}
