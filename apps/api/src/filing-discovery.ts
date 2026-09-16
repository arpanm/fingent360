import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { MongoClient } from 'mongodb';
import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  Query,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  FILING_DISCOVERY_URL,
  FilingDiscoveryGateSchema,
  FilingDiscoveryInputSchema,
  FilingDiscoveryFetchSchema,
  FilingDiscoveryCaptureSchema,
  FilingDiscoveryInboxSchema,
  parseFilingDiscovery,
} from '@fingent360/contracts';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import type { AppConfig } from './config.js';
import { canonicalSourceJson } from './canonical-source-json.js';
const RAW = Symbol('FILING_DISCOVERY_RAW'),
  hash = (v: string) => createHash('sha256').update(v).digest('hex');
type Original = {
  _id: string;
  body: string;
  capturedAt: string;
  url: string;
  rightsEvidence: string;
};
class DiscoveryRaw {
  readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  onApplicationShutdown() {
    return this.mongo.close();
  }
}
export const filingDiscoveryProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new DiscoveryRaw(config),
});
async function gate(c: pg.PoolClient) {
  const v = (
    await c.query('SELECT * FROM filing_discovery_gate WHERE id=true FOR SHARE')
  ).rows[0];
  if (!v?.enabled || v.rights_evidence.length < 30)
    throw new ForbiddenException(
      'Record and enable permitted RSS retention and internal display first.',
    );
  return { rights: v.rights_evidence as string, version: v.version as number };
}
async function fetchOriginal() {
  let response: Response;
  try {
    response = await fetch(FILING_DISCOVERY_URL, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/rss+xml, application/xml' },
    });
  } catch (cause) {
    throw new ConflictException(
      'Official RSS transport unavailable. Retain an original downloaded file instead.',
      { cause },
    );
  }
  if (!response.ok || !response.body)
    throw new ConflictException(
      'Official RSS unavailable. Retain an original downloaded file instead.',
    );
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 2_000_000) throw new BadRequestException('RSS exceeds2MB.');
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Buffer.concat(chunks),
  );
}
async function retain(
  c: pg.PoolClient,
  mongo: MongoClient,
  input: { requestId: string; body: string },
  actor: string,
  permission: { rights: string; version: number },
) {
  const fingerprint = hash(input.body),
    rightsHash = hash(permission.rights);
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    input.requestId,
  ]);
  const old = (
    await c.query('SELECT * FROM filing_discovery_captures WHERE id=$1', [
      input.requestId,
    ])
  ).rows[0];
  if (old) {
    if (
      old.actor_id !== actor ||
      old.fingerprint !== fingerprint ||
      old.rights_hash !== rightsHash
    )
      throw new ConflictException(
        'Capture request ID already belongs to different content or permission.',
      );
    return FilingDiscoveryCaptureSchema.parse(old.receipt);
  }
  const capturedAt = new Date().toISOString();
  await mongo
    .db()
    .collection<Original>('filing_discovery_raw')
    .updateOne(
      { _id: input.requestId },
      {
        $setOnInsert: {
          body: input.body,
          capturedAt,
          url: FILING_DISCOVERY_URL,
          rightsEvidence: permission.rights,
        },
      },
      { upsert: true },
    );
  const original = await mongo
    .db()
    .collection<Original>('filing_discovery_raw')
    .findOne({ _id: input.requestId });
  if (
    !original ||
    original.body !== input.body ||
    original.rightsEvidence !== permission.rights
  )
    throw new ConflictException(
      'Original capture differs from retained bytes.',
    );
  let items: ReturnType<typeof parseFilingDiscovery> = [],
    status: 'retained' | 'quarantined' = 'retained',
    message =
      'Discovery only: original XML and security identity require acquisition and verified mapping.';
  try {
    items = parseFilingDiscovery(input.body);
  } catch {
    status = 'quarantined';
    message =
      'Original RSS retained, unsupported or invalid structure. No items were inferred.';
  }
  const receipt = FilingDiscoveryCaptureSchema.parse({
    id: input.requestId,
    bodyHash: fingerprint,
    status,
    itemCount: items.length,
    message,
    capturedAt: original.capturedAt,
  });
  await c.query(
    'INSERT INTO filing_discovery_captures(id,actor_id,fingerprint,rights_hash,receipt) VALUES($1,$2,$3,$4,$5)',
    [input.requestId, actor, fingerprint, rightsHash, receipt],
  );
  for (const item of items) {
    const id = hash(canonicalSourceJson(item));
    await c.query(
      'INSERT INTO filing_discovery_items(id,payload,first_capture) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
      [id, item, input.requestId],
    );
    await c.query(
      'INSERT INTO filing_discovery_members(capture_id,item_id) VALUES($1,$2)',
      [input.requestId, id],
    );
  }
  return receipt;
}
export async function captureScheduledFilingDiscovery(
  pool: pg.Pool,
  mongo: MongoClient,
) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const initial = await gate(c);
    if (
      !(
        await c.query(
          "SELECT enabled FROM research_auto_schedules WHERE source_id='equity-filing-discovery' FOR SHARE",
        )
      ).rows[0]?.enabled
    )
      throw new ForbiddenException('RSS discovery schedule is disabled.');
    await c.query('COMMIT');
    const body = await fetchOriginal();
    await c.query('BEGIN');
    const current = await gate(c);
    if (
      current.version !== initial.version ||
      !(
        await c.query(
          "SELECT enabled FROM research_auto_schedules WHERE source_id='equity-filing-discovery' FOR SHARE",
        )
      ).rows[0]?.enabled
    )
      throw new ConflictException(
        'RSS permission or schedule changed during acquisition.',
      );
    const fingerprint = hash(body);
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      'filing-discovery:' + fingerprint,
    ]);
    const previous = (
      await c.query(
        'SELECT receipt FROM filing_discovery_captures WHERE fingerprint=$1 AND rights_hash=$2 ORDER BY created_at DESC LIMIT 1',
        [fingerprint, hash(current.rights)],
      )
    ).rows[0];
    const receipt = previous
      ? FilingDiscoveryCaptureSchema.parse(previous.receipt)
      : await retain(
          c,
          mongo,
          { requestId: randomUUID(), body },
          'scheduled-filing-discovery',
          current,
        );
    await c.query('COMMIT');
    if (receipt.status === 'quarantined')
      throw new ConflictException(
        'RSS original retained in quarantine. Inspect capture before retry.',
      );
    return receipt.bodyHash;
  } catch (error) {
    await c.query('ROLLBACK');
    throw error;
  } finally {
    c.release();
  }
}
@OperatorRead()
@Controller('ops/filing-discovery')
export class FilingDiscoveryOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: DiscoveryRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    action: 'read' | 'prepare' | 'administer',
    c?: pg.PoolClient,
  ) {
    const value = await this.ops.permission(cookie, action, c);
    return typeof value === 'string' ? value : value.identity.id;
  }
  @Get() read(
    @Headers('cookie') cookie?: string,
    @Query('after') after?: string,
    @Query('captureAfter') captureAfter?: string,
  ) {
    if (
      (after && !/^[a-f0-9]{64}$/.test(after)) ||
      (captureAfter && !z.uuid().safeParse(captureAfter).success)
    )
      throw new BadRequestException('Invalid discovery cursor.');
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      if (
        (after &&
          !(
            await c.query('SELECT 1 FROM filing_discovery_items WHERE id=$1', [
              after,
            ])
          ).rows.length) ||
        (captureAfter &&
          !(
            await c.query(
              'SELECT 1 FROM filing_discovery_captures WHERE id=$1',
              [captureAfter],
            )
          ).rows.length)
      )
        throw new NotFoundException('Discovery cursor unavailable.');
      const settings = (
          await c.query(
            'SELECT enabled,rights_evidence FROM filing_discovery_gate WHERE id=true',
          )
        ).rows[0],
        items = (
          await c.query(
            'SELECT * FROM filing_discovery_items WHERE($1::text IS NULL OR(created_at,id)<(SELECT created_at,id FROM filing_discovery_items WHERE id=$1)) ORDER BY created_at DESC,id DESC LIMIT 21',
            [after ?? null],
          )
        ).rows,
        captures = (
          await c.query(
            'SELECT * FROM filing_discovery_captures WHERE($1::uuid IS NULL OR(created_at,id)<(SELECT created_at,id FROM filing_discovery_captures WHERE id=$1)) ORDER BY created_at DESC,id DESC LIMIT 21',
            [captureAfter ?? null],
          )
        ).rows;
      await this.actor(cookie, 'read', c);
      return FilingDiscoveryInboxSchema.parse({
        gate: {
          enabled: settings.enabled,
          rightsEvidence: settings.rights_evidence,
        },
        items: items.slice(0, 20).map((v) => ({
          id: v.id,
          item: v.payload,
          captureId: v.first_capture,
          observedAt: v.created_at.toISOString(),
        })),
        next: items.length > 20 ? items[19].id : null,
        captures: captures.slice(0, 20).map((v) => v.receipt),
        captureNext: captures.length > 20 ? captures[19].id : null,
      });
    });
  }
  @OperatorAction('administer') @Post('gate') configure(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const p = FilingDiscoveryGateSchema.safeParse(body);
    if (!p.success)
      throw new BadRequestException('Complete source permission.');
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'administer', c);
      await c.query(
        'UPDATE filing_discovery_gate SET enabled=$1,rights_evidence=$2,version=version+1 WHERE id=true',
        [p.data.enabled, p.data.rightsEvidence],
      );
      await this.actor(cookie, 'administer', c);
      return p.data;
    });
  }
  @OperatorAction('prepare') @Post('capture') capture(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const p = FilingDiscoveryInputSchema.safeParse(body);
    if (!p.success)
      throw new BadRequestException('Upload original RSS within2MB.');
    return this.store.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c),
        permission = await gate(c),
        receipt = await retain(c, this.raw.mongo, p.data, actor, permission);
      await this.actor(cookie, 'prepare', c);
      return receipt;
    });
  }
  @OperatorAction('prepare') @Post('fetch') async fetch(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const p = FilingDiscoveryFetchSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('Provide request ID.');
    const initial = await this.store.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c),
        permission = await gate(c),
        old = (
          await c.query(
            'SELECT actor_id,rights_hash,receipt FROM filing_discovery_captures WHERE id=$1',
            [p.data.requestId],
          )
        ).rows[0];
      if (
        old &&
        (old.actor_id !== actor || old.rights_hash !== hash(permission.rights))
      )
        throw new ConflictException(
          'Fetch request ID belongs to another actor or permission.',
        );
      await this.actor(cookie, 'prepare', c);
      return {
        ...permission,
        receipt: old ? FilingDiscoveryCaptureSchema.parse(old.receipt) : null,
      };
    });
    if (initial.receipt) return initial.receipt;
    const bodyText = await fetchOriginal();
    return this.store.transaction(async (c) => {
      const actor = await this.actor(cookie, 'prepare', c),
        permission = await gate(c);
      if (permission.version !== initial.version)
        throw new ConflictException('RSS permission changed during fetch.');
      const receipt = await retain(
        c,
        this.raw.mongo,
        { requestId: p.data.requestId, body: bodyText },
        actor,
        permission,
      );
      await this.actor(cookie, 'prepare', c);
      return receipt;
    });
  }
  @Get(':id/evidence') evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    if (!z.uuid().safeParse(id).success)
      throw new BadRequestException('Invalid capture ID.');
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const row = (
        await c.query(
          'SELECT receipt FROM filing_discovery_captures WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('RSS capture unavailable.');
      const original = await this.raw.mongo
        .db()
        .collection<Original>('filing_discovery_raw')
        .findOne({ _id: id });
      if (!original || hash(original.body) !== row.receipt.bodyHash)
        throw new ConflictException('Retained RSS is unavailable or changed.');
      await this.actor(cookie, 'read', c);
      return {
        body: original.body,
        bodyHash: row.receipt.bodyHash,
        capturedAt: original.capturedAt,
        url: original.url,
      };
    });
  }
}
