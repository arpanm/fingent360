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
  SovereignCaptureSchema,
  SovereignReviewSchema,
  SovereignEditionSchema,
  SovereignListSchema,
  SovereignSnapshotSchema,
  SovereignCalculationInputSchema,
  calculateSovereignAuction,
  SOVEREIGN_ORIGINALS,
  SOVEREIGN_TERMS,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { FundsRawStore, FUNDS_RAW } from './funds-bonds.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
const sha = (v: string | Uint8Array) =>
  createHash('sha256').update(v).digest('hex');
const canonical = (v: unknown) =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort())
      : x,
  );
function parse<T>(schema: z.ZodType<T>, v: unknown) {
  const result = schema.safeParse(v);
  if (!result.success)
    throw new BadRequestException(
      'Review the original source pack and calculation fields.',
    );
  return result.data;
}
function cursor(after?: string) {
  if (!after) return null;
  const parts = after.split('|');
  if (
    parts.length !== 2 ||
    !z.iso.datetime().safeParse(parts[0]).success ||
    !z.uuid().safeParse(parts[1]).success
  )
    throw new BadRequestException('Invalid source page cursor.');
  return parts;
}
async function project(c: pg.PoolClient, row: Record<string, unknown>) {
  const review = (
    await c.query(
      'SELECT decision,reviewed_at FROM sovereign_bond_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
      [row.id],
    )
  ).rows[0];
  return SovereignEditionSchema.parse({
    id: row.id,
    terms: SOVEREIGN_TERMS,
    recordedAt: (row.recorded_at as Date).toISOString(),
    retrievedAt: null,
    originals: row.originals,
    error: row.error,
    state:
      review?.decision === 'publish'
        ? 'published'
        : review?.decision === 'withdraw'
          ? 'withdrawn'
          : row.error
            ? 'quarantined'
            : 'draft',
    reviewedAt: review?.reviewed_at.toISOString() ?? null,
  });
}
async function page(
  c: pg.PoolClient,
  after: string | undefined,
  publicOnly: boolean,
) {
  const pos = cursor(after);
  const rows = (
    await c.query(
      'SELECT e.*,to_char(recorded_at AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') page_at FROM sovereign_bond_editions e WHERE ($1::timestamptz IS NULL OR (recorded_at,id)<($1::timestamptz,$2::uuid))' +
        (publicOnly
          ? " AND (SELECT decision FROM sovereign_bond_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish'"
          : '') +
        ' ORDER BY recorded_at DESC,id DESC LIMIT 26',
      [pos?.[0] ?? null, pos?.[1] ?? null],
    )
  ).rows;
  const editions = [];
  for (const row of rows.slice(0, 25)) editions.push(await project(c, row));
  return SovereignListSchema.parse({
    editions,
    nextCursor: rows.length > 25 ? rows[24].page_at + '|' + rows[24].id : null,
  });
}
export async function sovereignBondSnapshot(c: pg.PoolClient) {
  await c.query('LOCK TABLE sovereign_bond_reviews IN SHARE MODE');
  const rows = (
    await c.query(
      "SELECT * FROM sovereign_bond_editions e WHERE (SELECT decision FROM sovereign_bond_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY recorded_at DESC,id DESC LIMIT 101",
    )
  ).rows;
  if (rows.length > 100)
    throw new ServiceUnavailableException(
      'Sovereign snapshot capacity exceeded.',
    );
  const editions = [];
  for (const row of rows) editions.push(await project(c, row));
  return SovereignSnapshotSchema.parse({
    capturedAt: new Date().toISOString(),
    editions,
  });
}
@Controller('sovereign-bonds')
export class SovereignBondsController {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  @Get() read(@Query('after') after?: string) {
    return this.account.transaction(async (c) => {
      await c.query('LOCK TABLE sovereign_bond_reviews IN SHARE MODE');
      return page(c, after, true);
    });
  }
  @Get('snapshot') snapshot() {
    return this.account.transaction((c) => sovereignBondSnapshot(c));
  }
  @Post(':id/calculate') calculate(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    parse(z.uuid(), id);
    const input = parse(SovereignCalculationInputSchema, body);
    return this.account.transaction(async (c) => {
      await c.query('LOCK TABLE sovereign_bond_reviews IN SHARE MODE');
      const row = (
        await c.query('SELECT * FROM sovereign_bond_editions WHERE id=$1', [id])
      ).rows[0];
      if (!row)
        throw new NotFoundException('Historical source pack unavailable.');
      const edition = await project(c, row);
      if (edition.state !== 'published')
        throw new ConflictException(
          'Historical source pack is not currently admitted.',
        );
      return calculateSovereignAuction(edition, input);
    });
  }
}
@Controller('ops/sovereign-bonds')
export class SovereignBondsOperationsController {
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
  @Get(':id/evidence/:kind') @OperatorRead() evidence(
    @Param('id') id: string,
    @Param('kind') kind: string,
    @Headers('cookie') cookie?: string,
  ) {
    parse(z.uuid(), id);
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const row = (
        await c.query('SELECT * FROM sovereign_bond_editions WHERE id=$1', [id])
      ).rows[0];
      if (!row) throw new NotFoundException('Original unavailable.');
      const edition = await project(c, row),
        original = edition.originals.find((o) => o.kind === kind);
      if (!original) throw new NotFoundException('Original kind unavailable.');
      const value = await this.raw.read(original.hash);
      if (!value || sha(Buffer.from(value.body, 'base64')) !== original.hash)
        throw new ServiceUnavailableException(
          'Original unavailable or corrupt.',
        );
      await this.actor(cookie, 'read', c);
      return { ...original, body: value.body };
    });
  }
  @Post('import') @OperatorAction('prepare') async capture(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    const input = parse(SovereignCaptureSchema, body);
    await this.actor(cookie, 'prepare');
    const originals: z.infer<typeof SovereignEditionSchema>['originals'] = [];
    let error: string | null = null;
    for (const source of SOVEREIGN_ORIGINALS) {
      const entry = input.originals.find((o) => o.kind === source.kind)!,
        bytes = Buffer.from(entry.body, 'base64');
      if (bytes.length > 2000000 || bytes.toString('base64') !== entry.body)
        throw new BadRequestException(
          'Each original must be valid base64 up to2MB.',
        );
      const hash = sha(bytes);
      if (source.mime === 'application/pdf') {
        if (
          bytes.subarray(0, 5).toString() !== '%PDF-' ||
          !bytes.subarray(-2048).includes(Buffer.from('%%EOF'))
        )
          error =
            'Unsupported original envelope; independent publication unavailable.';
      } else {
        try {
          const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          if (!/<html(?:\s|>)/i.test(html) || !/<\/html\s*>/i.test(html))
            error =
              'Unsupported original envelope; independent publication unavailable.';
        } catch {
          error = 'Unsupported original text encoding.';
        }
      }
      await this.raw.retain(hash, entry.body, new Date().toISOString());
      originals.push({ ...source, hash });
    }
    const fingerprint = sha(
      canonical({ originals, permission: input.permissionReference }),
    );
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'sovereign:' + input.requestId,
      ]);
      let row = (
        await c.query('SELECT * FROM sovereign_bond_editions WHERE id=$1', [
          input.requestId,
        ])
      ).rows[0];
      if (row) {
        const old = sha(
          canonical({
            originals: row.originals,
            permission: row.permission_reference,
          }),
        );
        if (old !== fingerprint)
          throw new ConflictException('Source capture request changed.');
      } else
        row = (
          await c.query(
            'INSERT INTO sovereign_bond_editions(id,originals,error,permission_reference,prepared_by) VALUES($1,$2,$3,$4,$5) RETURNING *',
            [
              input.requestId,
              JSON.stringify(originals),
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
    const input = parse(SovereignReviewSchema, body),
      fingerprint = sha(JSON.stringify({ id, input }));
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c);
      const row = (
        await c.query(
          'SELECT * FROM sovereign_bond_editions WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Source pack unavailable.');
      const prior = (
        await c.query(
          'SELECT fingerprint FROM sovereign_bond_reviews WHERE request_id=$1',
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
      if (input.decision === 'publish') {
        const named = await this.ops.permission(cookie, 'approve', c);
        if (typeof named === 'string' || actor === row.prepared_by)
          throw new ForbiddenException(
            'A different named reviewer must inspect all originals.',
          );
        if (row.error || !input.allOriginalsChecked)
          throw new ConflictException(
            'Inspect the identity, auction, terms and conventions originals.',
          );
        const edition = await project(c, row);
        if (
          input.termsVersion !== edition.terms.version ||
          JSON.stringify(input.sourceHashes) !==
            JSON.stringify(edition.originals.map((o) => o.hash))
        )
          throw new ConflictException(
            'Review must bind the exact retained originals and terms version.',
          );
        for (const original of edition.originals) {
          const value = await this.raw.read(original.hash);
          if (
            !value ||
            sha(Buffer.from(value.body, 'base64')) !== original.hash
          )
            throw new ServiceUnavailableException(
              'Retained source unavailable or corrupt.',
            );
        }
      }
      await c.query(
        'INSERT INTO sovereign_bond_reviews(request_id,edition_id,fingerprint,decision,reason,reviewer) VALUES($1,$2,$3,$4,$5,$6)',
        [input.requestId, id, fingerprint, input.decision, input.reason, actor],
      );
      const result = await project(c, row);
      await this.actor(cookie, 'approve', c);
      return result;
    });
  }
}
