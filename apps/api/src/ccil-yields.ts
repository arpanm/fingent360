import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
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
  CCIL_YIELDS_URL,
  CcilCaptureSchema,
  CcilReviewSchema,
  CcilEditionSchema,
  CcilYieldsListSchema,
  CcilYieldsSnapshotSchema,
  parseCcilYields,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { FundsRawStore, FUNDS_RAW } from './funds-bonds.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
export const CCIL_GATE = Symbol('CCIL_GATE');
export type CcilGate = { enabled: boolean; permissionReference?: string };
const sha = (body: string) => createHash('sha256').update(body).digest('hex');
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
const enabled = (gate: CcilGate) =>
  gate.enabled && Boolean(gate.permissionReference?.trim());
async function edition(c: pg.PoolClient, row: Record<string, unknown>) {
  const review = (
    await c.query(
      'SELECT * FROM ccil_yield_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
      [row.id],
    )
  ).rows[0];
  return CcilEditionSchema.parse({
    id: row.id,
    hash: row.hash,
    sourceUrl: CCIL_YIELDS_URL,
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
@Controller('bond-yields')
export class CcilYieldsController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(CCIL_GATE) private readonly gate: CcilGate,
  ) {}
  @Get() read() {
    return this.account.transaction(async (c) => {
      if (!enabled(this.gate)) return { enabled: false, editions: [] };
      await c.query('LOCK TABLE ccil_yield_reviews IN SHARE MODE');
      const found = await c.query(
        "SELECT e.* FROM ccil_yield_editions e WHERE permission_reference=$1 AND (SELECT decision FROM ccil_yield_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY data->>'date' DESC,retrieved_at DESC,id LIMIT 101",
        [this.gate.permissionReference],
      );
      if (found.rows.length > 100)
        throw new ServiceUnavailableException(
          'Yield history exceeds explicit100-edition bound.',
        );
      const editions = [];
      for (const row of found.rows) editions.push(await edition(c, row));
      return CcilYieldsListSchema.parse({ enabled: true, editions });
    });
  }
  @Get('snapshot') async snapshot() {
    return CcilYieldsSnapshotSchema.parse({
      ...(await this.read()),
      capturedAt: new Date().toISOString(),
    });
  }
}
@OperatorRead()
@Controller('ops/bond-yields')
export class OpsCcilYieldsController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(FUNDS_RAW) private readonly raw: FundsRawStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(CCIL_GATE) private readonly gate: CcilGate,
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
  @Get() queue(@Headers('cookie') cookie?: string) {
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const rows = await c.query(
          'SELECT * FROM ccil_yield_editions ORDER BY retrieved_at DESC,id LIMIT 100',
        ),
        editions = [];
      for (const row of rows.rows) editions.push(await edition(c, row));
      await this.actor(cookie, 'read', c);
      return CcilYieldsListSchema.parse({
        enabled: enabled(this.gate),
        editions,
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
          await c.query('SELECT hash FROM ccil_yield_editions WHERE id=$1', [
            id,
          ])
        ).rows[0],
    );
    if (!row) throw new NotFoundException('Capture unavailable.');
    const raw = await this.raw.read(row.hash);
    await this.actor(cookie, 'read');
    if (!raw || sha(raw.body) !== row.hash)
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
    const input = parse(CcilCaptureSchema, body);
    if (!input.body)
      throw new BadRequestException('Provide unchanged source HTML.');
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
    const input = parse(CcilCaptureSchema, body);
    if (input.body !== undefined)
      throw new BadRequestException(
        'Fetch does not accept substituted source data.',
      );
    const response = await fetch(CCIL_YIELDS_URL, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (
      !response.ok ||
      !response.headers.get('content-type')?.includes('text/html') ||
      !response.body
    )
      throw new ServiceUnavailableException(
        'Original CCIL public page unavailable.',
      );
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 500000)
          throw new ServiceUnavailableException(
            'CCIL page exceeds capture bound.',
          );
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return this.retain(
      {
        ...input,
        body: new TextDecoder('utf-8', { fatal: true }).decode(
          Buffer.concat(chunks),
        ),
      },
      cookie,
    );
  }
  private async retain(
    input: z.infer<typeof CcilCaptureSchema>,
    cookie?: string,
  ) {
    this.requireGate();
    const actor = await this.actor(cookie, 'prepare'),
      body = input.body!,
      hash = sha(body),
      at = new Date().toISOString();
    let data = null,
      error = null;
    try {
      data = parseCcilYields(body);
    } catch {
      error = 'Unverified source table; retained privately for inspection.';
    }
    await this.raw.retain(hash, body, at);
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'prepare', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'ccil:' + input.requestId,
      ]);
      const old = (
        await c.query('SELECT * FROM ccil_yield_editions WHERE id=$1', [
          input.requestId,
        ])
      ).rows[0];
      if (old) {
        if (
          old.hash !== hash ||
          old.permission_reference !== this.gate.permissionReference
        )
          throw new ConflictException(
            'Capture request reused with different evidence or permission.',
          );
        const result = await edition(c, old);
        await this.actor(cookie, 'prepare', c);
        return result;
      }
      const row = (
        await c.query(
          'INSERT INTO ccil_yield_editions(id,hash,retrieved_at,data,error,prepared_by,permission_reference) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [
            input.requestId,
            hash,
            at,
            data,
            error,
            actor,
            this.gate.permissionReference,
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
    const input = parse(CcilReviewSchema, body),
      fingerprint = sha(canonical({ id, input }));
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'ccil-review:' + input.requestId,
      ]);
      const row = (
        await c.query(
          'SELECT * FROM ccil_yield_editions WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Capture unavailable.');
      const old = (
        await c.query(
          'SELECT fingerprint FROM ccil_yield_reviews WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (old) {
        if (old.fingerprint !== fingerprint)
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
        if (!raw || sha(raw.body) !== row.hash)
          throw new ServiceUnavailableException(
            'Retained source unavailable or corrupt.',
          );
        if (canonical(parseCcilYields(raw.body)) !== canonical(row.data))
          throw new ConflictException(
            'Source no longer reconstructs parsed edition.',
          );
      }
      await this.actor(cookie, 'approve', c);
      await c.query(
        'INSERT INTO ccil_yield_reviews(request_id,edition_id,fingerprint,decision,reason,reviewer) VALUES($1,$2,$3,$4,$5,$6)',
        [input.requestId, id, fingerprint, input.decision, input.reason, actor],
      );
      const result = await edition(c, row);
      await this.actor(cookie, 'approve', c);
      return result;
    });
  }
}
