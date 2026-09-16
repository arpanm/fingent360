import { createHash, randomUUID } from 'node:crypto';
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
import { z } from 'zod';
import type pg from 'pg';
import {
  RegulatoryCaptureSchema,
  RegulatoryReviewSchema,
  RegulatoryEditionSchema,
  RegulatoryListSchema,
  RegulatorySnapshotSchema,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { FundsRawStore, FUNDS_RAW } from './funds-bonds.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
export const REGULATORY_GATE = Symbol('REGULATORY_GATE');
export type RegulatoryGate = { enabled: boolean; permissionReference?: string };
const sha = (body: string | Buffer) =>
  createHash('sha256').update(body).digest('hex');
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
    throw new BadRequestException(
      'Review valid source metadata, date precision and original document fields.',
    );
  return value.data;
}
const enabled = (gate: RegulatoryGate) =>
  gate.enabled && Boolean(gate.permissionReference?.trim());
async function edition(c: pg.PoolClient, row: Record<string, unknown>) {
  const review = (
    await c.query(
      'SELECT decision,reviewed_at FROM regulatory_source_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
      [row.id],
    )
  ).rows[0];
  const metadata = RegulatoryEditionSchema.shape.metadata.parse(row.metadata);
  return RegulatoryEditionSchema.parse({
    id: row.id,
    hash: row.hash,
    metadata,
    mime: row.mime,
    retrievedAt: (row.retrieved_at as Date).toISOString(),
    recordedAt: (row.recorded_at as Date).toISOString(),
    acquisition: row.acquisition,
    error: row.error,
    state:
      review?.decision === 'publish'
        ? metadata.reviewBy < new Date().toISOString().slice(0, 10)
          ? 'stale'
          : 'published'
        : review?.decision === 'withdraw'
          ? 'withdrawn'
          : review?.decision === 'supersede'
            ? 'superseded'
            : row.error
              ? 'quarantined'
              : 'draft',
    reviewedAt: review?.reviewed_at.toISOString() ?? null,
    adviceEnabled: false,
    applicability: 'not-assessed',
  });
}
/** Envelope recognition only. No legal dates or meaning are parsed from documents. */
export function inspectRegulatoryBytes(encoded: string, mime: string) {
  const bytes = Buffer.from(encoded, 'base64');
  if (
    bytes.length < 8 ||
    bytes.length > 1500000 ||
    bytes.toString('base64') !== encoded
  )
    throw new Error('Invalid original bytes.');
  if (mime === 'application/pdf') {
    if (
      !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) ||
      !bytes
        .subarray(Math.max(0, bytes.length - 2048))
        .includes(Buffer.from('%%EOF'))
    )
      throw new Error('Unsupported PDF envelope.');
  } else {
    const html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (
      !/<(?:!doctype\s+html|html)(?:\s|>)/i.test(html) ||
      !/<\/html\s*>/i.test(html)
    )
      throw new Error('Unsupported original HTML envelope.');
  }
  return bytes;
}
function before(after?: string) {
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
function cursor(row: Record<string, unknown>) {
  return String(row.page_at) + '|' + String(row.id);
}
@Controller('regulatory-sources')
export class RegulatorySourcesController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(REGULATORY_GATE) private readonly gate: RegulatoryGate,
  ) {}
  @Get() read(
    @Query('after') after?: string,
    @Query('history') history?: string,
  ) {
    const position = before(after);
    if (history !== undefined && !['true', 'false'].includes(history))
      throw new BadRequestException('Invalid history filter.');
    return this.account.transaction(async (c) => {
      if (!enabled(this.gate))
        return { enabled: false, editions: [], nextCursor: null };
      await c.query('LOCK TABLE regulatory_source_reviews IN SHARE MODE');
      const condition =
        history === 'true'
          ? "EXISTS(SELECT 1 FROM regulatory_source_reviews r WHERE r.edition_id=e.id AND r.decision='publish')"
          : "(SELECT decision FROM regulatory_source_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish'";
      const found = await c.query(
        'SELECT e.*,to_char(recorded_at AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') AS page_at FROM regulatory_source_editions e WHERE permission_reference=$1 AND ' +
          condition +
          ' AND ($2::timestamptz IS NULL OR (recorded_at,id)<($2::timestamptz,$3::uuid)) ORDER BY recorded_at DESC,id DESC LIMIT 26',
        [
          this.gate.permissionReference,
          position?.[0] ?? null,
          position?.[1] ?? null,
        ],
      );
      const editions = [];
      for (const row of found.rows.slice(0, 25))
        editions.push(await edition(c, row));
      return RegulatoryListSchema.parse({
        enabled: true,
        editions,
        nextCursor: found.rows.length > 25 ? cursor(found.rows[24]!) : null,
      });
    });
  }
  @Get('snapshot') snapshot() {
    return this.account.transaction(async (c) => {
      if (!enabled(this.gate))
        return RegulatorySnapshotSchema.parse({
          enabled: false,
          editions: [],
          nextCursor: null,
          capturedAt: new Date().toISOString(),
        });
      await c.query('LOCK TABLE regulatory_source_reviews IN SHARE MODE');
      const rows = await c.query(
        "SELECT e.* FROM regulatory_source_editions e WHERE permission_reference=$1 AND (SELECT decision FROM regulatory_source_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY recorded_at DESC,id DESC LIMIT 101",
        [this.gate.permissionReference],
      );
      if (rows.rows.length > 100)
        throw new ServiceUnavailableException(
          'Current source snapshot exceeds100 documents. No incomplete offline library issued.',
        );
      const editions = [];
      for (const row of rows.rows) editions.push(await edition(c, row));
      return RegulatorySnapshotSchema.parse({
        enabled: true,
        editions,
        nextCursor: null,
        capturedAt: new Date().toISOString(),
      });
    });
  }
}
@OperatorRead()
@Controller('ops/regulatory-sources')
export class OpsRegulatorySourcesController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(FUNDS_RAW) private readonly raw: FundsRawStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(REGULATORY_GATE) private readonly gate: RegulatoryGate,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const actor = await this.ops.permission(cookie, permission, c);
    return typeof actor === 'string' ? actor : actor.identity.id;
  }
  private ready() {
    if (!enabled(this.gate))
      throw new ServiceUnavailableException(
        'Regulatory source retention disabled. Configure actual deployment permissions first.',
      );
  }
  @Get() queue(
    @Headers('cookie') cookie?: string,
    @Query('after') after?: string,
  ) {
    const position = before(after);
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const rows = await c.query(
          `SELECT *,to_char(recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_at FROM regulatory_source_editions WHERE ($1::timestamptz IS NULL OR (recorded_at,id)<($1::timestamptz,$2::uuid)) ORDER BY recorded_at DESC,id DESC LIMIT 26`,
          [position?.[0] ?? null, position?.[1] ?? null],
        ),
        editions = [];
      for (const row of rows.rows.slice(0, 25))
        editions.push(await edition(c, row));
      await this.actor(cookie, 'read', c);
      return RegulatoryListSchema.parse({
        enabled: enabled(this.gate),
        editions,
        nextCursor: rows.rows.length > 25 ? cursor(rows.rows[24]!) : null,
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
            'SELECT hash,mime,rights_reference FROM regulatory_source_editions WHERE id=$1',
            [id],
          )
        ).rows[0],
    );
    if (!row) throw new NotFoundException('Original capture unavailable.');
    const raw = await this.raw.read('regulatory-v1:' + row.hash);
    await this.actor(cookie, 'read');
    if (!raw || sha(Buffer.from(raw.body, 'base64')) !== row.hash)
      throw new ServiceUnavailableException(
        'Original bytes unavailable or corrupt.',
      );
    return {
      id,
      hash: row.hash,
      mime: row.mime,
      bodyBase64: raw.body,
      rightsReference: row.rights_reference,
    };
  }
  @OperatorAction('prepare') @Post('import') import(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    this.ready();
    const input = parse(RegulatoryCaptureSchema, body);
    if (!input.bodyBase64 || !input.retrievedAt)
      throw new BadRequestException(
        'Original upload requires bytes and declared retrieval time.',
      );
    return this.retain(input, 'operator-upload', cookie);
  }
  @OperatorAction('prepare') @Post('fetch') async fetch(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    this.ready();
    await this.actor(cookie, 'prepare');
    const input = parse(RegulatoryCaptureSchema, body);
    if (input.bodyBase64 !== undefined || input.retrievedAt !== undefined)
      throw new BadRequestException(
        'Server acquisition does not accept substituted bytes or retrieval time.',
      );
    const response = await fetch(input.metadata.sourceUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: input.mime },
    });
    if (
      !response.ok ||
      response.headers.get('content-type')?.split(';')[0]?.trim() !==
        input.mime ||
      !response.body
    )
      throw new ServiceUnavailableException(
        'Original authority document unavailable or unexpected content type.',
      );
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 1500000)
          throw new ServiceUnavailableException(
            'Original document exceeds1.5MB capture bound.',
          );
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return this.retain(
      {
        ...input,
        bodyBase64: Buffer.concat(chunks).toString('base64'),
        retrievedAt: new Date().toISOString(),
      },
      'server-fetch',
      cookie,
    );
  }
  private async retain(
    input: z.infer<typeof RegulatoryCaptureSchema>,
    acquisition: 'server-fetch' | 'operator-upload',
    cookie?: string,
  ) {
    this.ready();
    const actor = await this.actor(cookie, 'prepare'),
      body = input.bodyBase64!,
      at = input.retrievedAt!;
    if (Date.parse(at) > Date.now() + 60000)
      throw new BadRequestException('Retrieval time cannot be in the future.');
    const bytes = Buffer.from(body, 'base64'),
      hash = sha(bytes),
      fingerprint = sha(
        canonical({
          input: {
            ...input,
            retrievedAt:
              acquisition === 'server-fetch' ? undefined : input.retrievedAt,
          },
          acquisition,
          permission: this.gate.permissionReference,
        }),
      );
    let error: string | null = null;
    try {
      inspectRegulatoryBytes(body, input.mime);
    } catch {
      error =
        'Original byte envelope is unverified. Retained privately; cannot publish.';
    }
    await this.raw.retain('regulatory-v1:' + hash, body, at);
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'prepare', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'regulatory:' + input.requestId,
      ]);
      const old = (
        await c.query('SELECT * FROM regulatory_source_editions WHERE id=$1', [
          input.requestId,
        ])
      ).rows[0];
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new ConflictException(
            'Capture request reused with changed evidence or annotation.',
          );
        const result = await edition(c, old);
        await this.actor(cookie, 'prepare', c);
        return result;
      }
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'regulatory-key:' +
          input.metadata.authority +
          ':' +
          input.metadata.documentKey,
      ]);
      if (input.metadata.supersedes) {
        const prior = (
          await c.query(
            'SELECT metadata FROM regulatory_source_editions WHERE id=$1',
            [input.metadata.supersedes],
          )
        ).rows[0];
        if (
          !prior ||
          prior.metadata.authority !== input.metadata.authority ||
          prior.metadata.documentKey !== input.metadata.documentKey
        )
          throw new ConflictException(
            'Predecessor must be an existing revision of the same authority/document key.',
          );
      }
      const row = (
        await c.query(
          'INSERT INTO regulatory_source_editions(id,hash,metadata,mime,retrieved_at,acquisition,error,prepared_by,permission_reference,rights_reference,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
          [
            input.requestId,
            hash,
            input.metadata,
            input.mime,
            at,
            acquisition,
            error,
            actor,
            this.gate.permissionReference,
            input.rightsReference,
            fingerprint,
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
    const input = parse(RegulatoryReviewSchema, body),
      fingerprint = sha(canonical({ id, input }));
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'regulatory-review:' + input.requestId,
      ]);
      const row = (
        await c.query('SELECT * FROM regulatory_source_editions WHERE id=$1', [
          id,
        ])
      ).rows[0];
      if (!row) throw new NotFoundException('Capture unavailable.');
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'regulatory-key:' +
          row.metadata.authority +
          ':' +
          row.metadata.documentKey,
      ]);
      await c.query(
        'LOCK TABLE regulatory_source_reviews IN SHARE ROW EXCLUSIVE MODE',
      );
      const old = (
        await c.query(
          'SELECT fingerprint FROM regulatory_source_reviews WHERE request_id=$1',
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
        this.ready();
        const named = await this.ops.permission(cookie, 'approve', c);
        if (typeof named === 'string' || actor === row.prepared_by)
          throw new ForbiddenException(
            'A different named editor must publish this original.',
          );
        if (
          row.error ||
          row.permission_reference !== this.gate.permissionReference ||
          !input.originalReviewed ||
          row.metadata.reviewBy < new Date().toISOString().slice(0, 10)
        )
          throw new ConflictException(
            'Original, rights, metadata review and future review date are required.',
          );
        const current = await edition(c, row);
        if (
          ['withdrawn', 'superseded', 'published', 'stale'].includes(
            current.state,
          )
        )
          throw new ConflictException(
            'Issued revisions cannot be republished. Create a new revision.',
          );
        const raw = await this.raw.read('regulatory-v1:' + row.hash);
        if (!raw || sha(Buffer.from(raw.body, 'base64')) !== row.hash)
          throw new ServiceUnavailableException(
            'Original bytes unavailable or corrupt.',
          );
        try {
          inspectRegulatoryBytes(raw.body, row.mime);
        } catch (error) {
          throw new ConflictException(
            'Original byte envelope no longer reconstructs.',
            { cause: error },
          );
        }
        const heads = await c.query(
          "SELECT e.id FROM regulatory_source_editions e WHERE metadata->>'authority'=$1 AND metadata->>'documentKey'=$2 AND (SELECT decision FROM regulatory_source_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish'",
          [row.metadata.authority, row.metadata.documentKey],
        );
        if (heads.rows.some((prior) => prior.id !== row.metadata.supersedes))
          throw new ConflictException(
            'Supersede the currently published revision explicitly.',
          );
        if (row.metadata.supersedes) {
          const prior = await c.query(
            'SELECT decision FROM regulatory_source_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
            [row.metadata.supersedes],
          );
          if (prior.rows[0]?.decision === 'supersede')
            throw new ConflictException(
              'Predecessor already has a published successor. Rebase the revision.',
            );
          await c.query(
            'INSERT INTO regulatory_source_reviews(request_id,edition_id,fingerprint,decision,reason,reviewer) VALUES($1,$2,$3,$4,$5,$6)',
            [
              randomUUID(),
              row.metadata.supersedes,
              fingerprint,
              'supersede',
              'Superseded by reviewed revision ' + id,
              actor,
            ],
          );
        }
      }
      await this.actor(cookie, 'approve', c);
      await c.query(
        'INSERT INTO regulatory_source_reviews(request_id,edition_id,fingerprint,decision,reason,reviewer) VALUES($1,$2,$3,$4,$5,$6)',
        [input.requestId, id, fingerprint, input.decision, input.reason, actor],
      );
      const result = await edition(c, row);
      await this.actor(cookie, 'approve', c);
      return result;
    });
  }
}
