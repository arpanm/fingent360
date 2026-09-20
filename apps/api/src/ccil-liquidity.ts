import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Query,
  Post,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import type pg from 'pg';
import {
  CcilLiquidityPageSchema,
  CcilLiquidityCaptureSchema,
  CcilLiquidityReviewSchema,
  CcilLiquidityEditionSchema,
  CcilLiquidityListSchema,
  CcilLiquiditySnapshotSchema,
  parseCcilLiquidity,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { FundsRawStore, FUNDS_RAW } from './funds-bonds.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
export const CCIL_LIQUIDITY_GATE = Symbol('CCIL_LIQUIDITY_GATE');
export type CcilLiquidityGate = {
  enabled: boolean;
  permissionReference?: string;
};
const sha = (body: string) => createHash('sha256').update(body).digest('hex');
const rawHash = (body: string) =>
  createHash('sha256').update(Buffer.from(body, 'base64')).digest('hex');
const parseOriginal = (body: string) =>
  parseCcilLiquidity(Buffer.from(body, 'base64'));
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
function parse<T>(schema: z.ZodType<T>, body: unknown) {
  const value = schema.safeParse(body);
  if (!value.success)
    throw new BadRequestException('Review valid CCIL capture/review fields.');
  return value.data;
}
const enabled = (gate: CcilLiquidityGate) =>
  gate.enabled && Boolean(gate.permissionReference?.trim());
async function edition(c: pg.PoolClient, row: Record<string, unknown>) {
  const review = (
    await c.query(
      'SELECT * FROM ccil_liquidity_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
      [row.id],
    )
  ).rows[0];
  return CcilLiquidityEditionSchema.parse({
    id: row.id,
    hash: row.hash,
    sourceUrl: row.source_url,
    retrievedAt: (row.retrieved_at as Date).toISOString(),
    data: row.data,
    error: row.error,
    state:
      review?.decision === 'publish'
        ? 'published'
        : review?.decision === 'withdraw'
          ? 'withdrawn'
          : row.data
            ? 'draft'
            : 'quarantined',
    reviewedAt: review?.reviewed_at.toISOString() ?? null,
  });
}
@Controller('bond-liquidity')
export class CcilLiquidityController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(CCIL_LIQUIDITY_GATE) private readonly gate: CcilLiquidityGate,
  ) {}
  @Get() read(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const page = parse(CcilLiquidityPageSchema, { cursor, limit });
    return this.account.transaction(async (c) => {
      if (!enabled(this.gate))
        return CcilLiquidityListSchema.parse({ enabled: false, editions: [] });
      await c.query('LOCK TABLE ccil_liquidity_reviews IN SHARE MODE');
      const [at, id] = page.cursor?.split('|') ?? [];
      const rows = await c.query(
        "SELECT e.* FROM ccil_liquidity_editions e WHERE permission_reference=$1 AND (SELECT decision FROM ccil_liquidity_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' AND ($2::timestamptz IS NULL OR (retrieved_at,id)<($2::timestamptz,$3::uuid)) ORDER BY retrieved_at DESC,id DESC LIMIT $4",
        [this.gate.permissionReference, at ?? null, id ?? null, page.limit + 1],
      );
      const scanned = rows.rows.slice(0, page.limit),
        editions = [];
      for (const row of scanned) editions.push(await edition(c, row));
      const last = scanned.at(-1);
      return CcilLiquidityListSchema.parse({
        enabled: true,
        editions,
        nextCursor:
          rows.rows.length > page.limit && last
            ? last.retrieved_at.toISOString() + '|' + last.id
            : null,
      });
    });
  }
  @Get('snapshot') snapshot() {
    return this.account.transaction(async (c) => {
      if (!enabled(this.gate))
        return CcilLiquiditySnapshotSchema.parse({
          enabled: false,
          editions: [],
          capturedAt: new Date().toISOString(),
        });
      await c.query('LOCK TABLE ccil_liquidity_reviews IN SHARE MODE');
      const rows = await c.query(
        "SELECT e.* FROM ccil_liquidity_editions e WHERE permission_reference=$1 AND (SELECT decision FROM ccil_liquidity_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY retrieved_at DESC,id DESC LIMIT 4",
        [this.gate.permissionReference],
      );
      if (rows.rows.length > 3)
        throw new ServiceUnavailableException(
          'Complete liquidity snapshot exceeds3 editions; use connected history.',
        );
      const editions = [];
      for (const row of rows.rows) editions.push(await edition(c, row));
      return CcilLiquiditySnapshotSchema.parse({
        enabled: true,
        editions,
        capturedAt: new Date().toISOString(),
      });
    });
  }
}
@OperatorRead()
@Controller('ops/bond-liquidity')
export class OpsCcilLiquidityController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(FUNDS_RAW) private readonly raw: FundsRawStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(CCIL_LIQUIDITY_GATE) private readonly gate: CcilLiquidityGate,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const actor = await this.ops.permission(cookie, permission, c);
    return typeof actor === 'string' ? actor : actor.identity.id;
  }
  private requireGate() {
    if (!enabled(this.gate))
      throw new ServiceUnavailableException(
        'CCIL source disabled. Configure genuine written deployment permission before retention or distribution.',
      );
  }
  @Get() queue(
    @Headers('cookie') cookie?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const page = parse(CcilLiquidityPageSchema, { cursor, limit });
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      await c.query('LOCK TABLE ccil_liquidity_reviews IN SHARE MODE');
      const [at, id] = page.cursor?.split('|') ?? [];
      const rows = await c.query(
          'SELECT * FROM ccil_liquidity_editions WHERE ($1::timestamptz IS NULL OR (retrieved_at,id)<($1::timestamptz,$2::uuid)) ORDER BY retrieved_at DESC,id DESC LIMIT $3',
          [at ?? null, id ?? null, page.limit + 1],
        ),
        scanned = rows.rows.slice(0, page.limit),
        editions = [];
      for (const row of scanned) editions.push(await edition(c, row));
      await this.actor(cookie, 'read', c);
      const last = scanned.at(-1);
      return CcilLiquidityListSchema.parse({
        enabled: enabled(this.gate),
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
    parse(z.uuid(), id);
    await this.actor(cookie, 'read');
    const row = await this.account.transaction(
      async (c) =>
        (
          await c.query(
            'SELECT hash FROM ccil_liquidity_editions WHERE id=$1',
            [id],
          )
        ).rows[0],
    );
    if (!row) throw new NotFoundException('Capture unavailable.');
    const raw = await this.raw.read(row.hash);
    await this.actor(cookie, 'read');
    if (!raw || rawHash(raw.body) !== row.hash)
      throw new ServiceUnavailableException(
        'Retained evidence unavailable or corrupt.',
      );
    return { id, hash: row.hash, body: raw.body };
  }
  @OperatorAction('prepare') @Post('import') import(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    this.requireGate();
    const input = parse(CcilLiquidityCaptureSchema, body);
    if (
      (input.body && Buffer.from(input.body, 'base64').length > 2000000) ||
      (input.body !== undefined &&
        Buffer.from(input.body, 'base64').toString('base64') !== input.body)
    )
      throw new BadRequestException(
        'Original exceeds2MB or is not canonical base64.',
      );
    if (!input.body)
      throw new BadRequestException(
        'Provide unchanged source XLSX encoded as base64.',
      );
    return this.retain(input, cookie);
  }
  @OperatorAction('prepare') @Post('fetch') async fetch(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    this.requireGate();
    await this.actor(cookie, 'prepare');
    const input = parse(CcilLiquidityCaptureSchema, body);
    if (input.body !== undefined)
      throw new BadRequestException(
        'Fetch does not accept substituted source data.',
      );
    // A committed fixed-original fetch is recoverable without touching the provider.
    const replay = await this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c);
      const old = (
        await c.query('SELECT * FROM ccil_liquidity_editions WHERE id=$1', [
          input.requestId,
        ])
      ).rows[0];
      if (!old) return null;
      if (
        old.prepared_by !== actor ||
        old.source_url !== input.sourceUrl ||
        old.permission_reference !== this.gate.permissionReference ||
        old.acquisition_mode !== 'fetch'
      )
        throw new ConflictException(
          'Capture request reused with different actor, source, permission or acquisition mode.',
        );
      const result = await edition(c, old);
      await this.actor(cookie, 'prepare', c);
      return result;
    });
    if (replay) return replay;
    const response = await fetch(input.sourceUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (
      !response.ok ||
      !response.headers
        .get('content-type')
        ?.split(';')[0]
        ?.match(
          /^(application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet|application\/octet-stream)$/,
        ) ||
      !response.body
    )
      throw new ServiceUnavailableException(
        'Original CCIL liquidity workbook unavailable.',
      );
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 2000000)
          throw new ServiceUnavailableException(
            'CCIL workbook exceeds capture bound.',
          );
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return this.retain(
      {
        ...input,
        body: Buffer.concat(chunks).toString('base64'),
      },
      cookie,
      'fetch',
    );
  }
  private async retain(
    input: z.infer<typeof CcilLiquidityCaptureSchema>,
    cookie?: string,
    mode: 'import' | 'fetch' = 'import',
  ) {
    this.requireGate();
    const actor = await this.actor(cookie, 'prepare'),
      body = input.body!,
      hash = rawHash(body),
      at = new Date().toISOString();
    let data = null,
      error = null;
    try {
      data = parseOriginal(body);
    } catch {
      error =
        'Unverified liquidity workbook; retained privately for inspection.';
    }
    await this.raw.retain(hash, body, at);
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'prepare', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'ccil-liquidity:' + input.requestId,
      ]);
      const old = (
        await c.query('SELECT * FROM ccil_liquidity_editions WHERE id=$1', [
          input.requestId,
        ])
      ).rows[0];
      if (old) {
        if (
          old.prepared_by !== actor ||
          old.acquisition_mode !== mode ||
          old.hash !== hash ||
          old.source_url !== input.sourceUrl ||
          old.permission_reference !== this.gate.permissionReference
        )
          throw new ConflictException(
            'Capture request reused with different actor, evidence or permission.',
          );
        const result = await edition(c, old);
        await this.actor(cookie, 'prepare', c);
        return result;
      }
      const row = (
        await c.query(
          'INSERT INTO ccil_liquidity_editions(id,hash,retrieved_at,data,error,prepared_by,permission_reference,source_url,acquisition_mode) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
          [
            input.requestId,
            hash,
            at,
            data,
            error,
            actor,
            this.gate.permissionReference,
            input.sourceUrl,
            mode,
          ],
        )
      ).rows[0];
      const result = await edition(c, row);
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
    parse(z.uuid(), id);
    const input = parse(CcilLiquidityReviewSchema, body),
      fingerprint = sha(canonical({ id, input }));
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'ccil-liquidity-review:' + input.requestId,
      ]);
      const row = (
        await c.query(
          'SELECT * FROM ccil_liquidity_editions WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Capture unavailable.');
      const old = (
        await c.query(
          'SELECT fingerprint,reviewer FROM ccil_liquidity_reviews WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (old) {
        if (old.fingerprint !== fingerprint || old.reviewer !== actor)
          throw new ConflictException('Review request reused.');
        const result = await edition(c, row);
        await this.actor(cookie, 'approve', c);
        return result;
      }
      if (input.decision === 'publish') {
        this.requireGate();
        if (
          !row.data ||
          row.permission_reference !== this.gate.permissionReference
        )
          throw new ConflictException(
            'Capture has no admissible table/current permission.',
          );
        const named = await this.ops.permission(cookie, 'approve', c);
        if (typeof named === 'string' || actor === row.prepared_by)
          throw new ForbiddenException(
            'A different named reviewer must publish source evidence.',
          );
        const raw = await this.raw.read(row.hash);
        if (!raw || rawHash(raw.body) !== row.hash)
          throw new ServiceUnavailableException(
            'Retained source unavailable or corrupt.',
          );
        if (canonical(parseOriginal(raw.body)) !== canonical(row.data))
          throw new ConflictException(
            'Source no longer reconstructs parsed edition.',
          );
      }
      await this.actor(cookie, 'approve', c);
      await c.query(
        'INSERT INTO ccil_liquidity_reviews(request_id,edition_id,fingerprint,decision,reason,reviewer) VALUES($1,$2,$3,$4,$5,$6)',
        [input.requestId, id, fingerprint, input.decision, input.reason, actor],
      );
      const result = await edition(c, row);
      await this.actor(cookie, 'approve', c);
      return result;
    });
  }
}
