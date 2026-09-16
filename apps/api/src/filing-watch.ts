import { createHash, randomUUID } from 'node:crypto';
import type pg from 'pg';
import { MongoClient } from 'mongodb';
import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  Param,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  FILING_WATCH_SOURCES,
  FilingWatchGateSchema,
  FilingWatchStatusSchema,
  EquityEditionSchema,
  parseEquitySource,
} from '@fingent360/contracts';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import type { AppConfig } from './config.js';
import { canonicalSourceJson } from './canonical-source-json.js';
const hash = (v: string) => createHash('sha256').update(v).digest('hex'),
  digest = (v: unknown) => hash(canonicalSourceJson(v)),
  RAW = Symbol('FILING_WATCH_RAW');
export const FILING_WATCH_ADMISSION_SQL =
  'NOT EXISTS (SELECT 1 FROM filing_watch_attempts fw WHERE fw.edition_id=e.id) OR EXISTS (SELECT 1 FROM filing_watch_attempts fw JOIN filing_watch_gate fg ON fg.id=true WHERE fw.edition_id=e.id AND fg.enabled AND fg.rights_hash=fw.rights_hash AND fg.source_ids ? fw.source_id)';
export async function lockFilingWatchAdmission(c: pg.PoolClient) {
  await c.query('SELECT id FROM filing_watch_gate WHERE id=true FOR SHARE');
}
/** Called within the existing independent equity publication transaction. */
export async function admitFilingWatchReview(
  c: pg.PoolClient,
  id: string,
  named: boolean,
) {
  const rows = (
    await c.query(
      'SELECT source_id,rights_hash FROM filing_watch_attempts WHERE edition_id=$1',
      [id],
    )
  ).rows;
  if (!rows.length) return;
  const gate = (
    await c.query('SELECT * FROM filing_watch_gate WHERE id=true FOR SHARE')
  ).rows[0];
  if (
    !named ||
    !gate?.enabled ||
    !rows.some(
      (r) =>
        gate.source_ids.includes(r.source_id) &&
        r.rights_hash === gate.rights_hash,
    )
  )
    throw new ForbiddenException(
      'Named review and current original-filing permission are required.',
    );
}
class FilingWatchRaw {
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
export const filingWatchProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new FilingWatchRaw(config),
});
async function fetchOriginal(url: string) {
  if (!FILING_WATCH_SOURCES.some((s) => s.sourceUrl === url))
    throw Error('Original is not registered.');
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'text/html' },
  });
  if (!response.ok || !response.body)
    throw Error('Original filing unavailable.');
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const p = await reader.read();
      if (p.done) break;
      size += p.value.byteLength;
      if (size > 4000000) throw Error('Original exceeds 4 MB.');
      chunks.push(p.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Buffer.concat(chunks),
  );
}
export async function captureScheduledFilingWatch(
  pool: pg.Pool,
  mongo: MongoClient,
) {
  const c = await pool.connect();
  let locked = false;
  const outcomes: string[] = [];
  let successful = 0;
  try {
    locked =
      (await c.query('SELECT pg_try_advisory_lock(360927) AS locked')).rows[0]
        ?.locked === true;
    if (!locked)
      throw new ConflictException('Original filing watch is already active.');
    await c.query('BEGIN');
    const initial = (
        await c.query('SELECT * FROM filing_watch_gate WHERE id=true FOR SHARE')
      ).rows[0],
      schedule = (
        await c.query(
          "SELECT enabled FROM research_auto_schedules WHERE source_id='equity-filing-watch' FOR SHARE",
        )
      ).rows[0];
    if (
      !initial?.enabled ||
      !initial.actor_id ||
      !schedule?.enabled ||
      initial.rights_evidence.length < 30
    )
      throw new ForbiddenException(
        'Original filing watch requires enabled permission and schedule.',
      );
    const selected = FilingWatchGateSchema.parse({
      enabled: initial.enabled,
      sourceIds: initial.source_ids,
      rightsEvidence: initial.rights_evidence,
    });
    await c.query('COMMIT');
    for (
      let index = 0;
      index < Math.min(3, selected.sourceIds.length);
      index++
    ) {
      const id =
          selected.sourceIds[
            (initial.cursor + index) % selected.sourceIds.length
          ]!,
        source = FILING_WATCH_SOURCES.find((s) => s.symbol === id)!;
      let body: string | null = null,
        status: 'draft' | 'unchanged' | 'quarantine' | 'unavailable' =
          'unavailable',
        message =
          'Original filing transport unavailable; retry will preserve other sources.';
      try {
        body = await fetchOriginal(source.sourceUrl);
      } catch {
        body = null;
      }
      const retrievedAt = new Date().toISOString(),
        bodyHash = body === null ? null : hash(body),
        attemptId = randomUUID();
      await c.query('BEGIN');
      const current = (
          await c.query(
            'SELECT * FROM filing_watch_gate WHERE id=true FOR SHARE',
          )
        ).rows[0],
        enabled = (
          await c.query(
            "SELECT enabled FROM research_auto_schedules WHERE source_id='equity-filing-watch' FOR SHARE",
          )
        ).rows[0]?.enabled;
      if (
        !current?.enabled ||
        !enabled ||
        current.version !== initial.version ||
        current.rights_hash !== initial.rights_hash
      )
        throw new ConflictException(
          'Permission or source selection changed during acquisition.',
        );
      let editionId: string | null = null;
      if (body !== null && bodyHash) {
        await mongo
          .db()
          .collection<{
            _id: string;
            sourceUrl: string;
            retrievedAt: string;
            body: string;
          }>('equity_source_documents')
          .updateOne(
            { _id: bodyHash },
            {
              $setOnInsert: { sourceUrl: source.sourceUrl, retrievedAt, body },
            },
            { upsert: true },
          );
        const prior = (
          await c.query(
            'SELECT edition_id FROM filing_watch_attempts WHERE source_id=$1 AND body_hash=$2 AND rights_hash=$3 AND edition_id IS NOT NULL ORDER BY created_at DESC LIMIT 1',
            [id, bodyHash, current.rights_hash],
          )
        ).rows[0];
        if (prior) {
          editionId = prior.edition_id;
          status = 'unchanged';
          message =
            'Original bytes unchanged; existing edition retained, no duplicate draft.';
        } else {
          let edition: ReturnType<typeof EquityEditionSchema.parse> | null =
            null;
          try {
            const parsed = parseEquitySource(
              'nse-integrated-indas-html-v1',
              body,
              retrievedAt.slice(0, 10),
            );
            if (
              !parsed.observations.length ||
              parsed.observations.some(
                (o) =>
                  o.isin !== source.isin ||
                  o.effectiveOn > retrievedAt.slice(0, 10),
              )
            )
              throw Error(
                'Registered issuer identity or observation date does not agree.',
              );
            edition = EquityEditionSchema.parse({
              id: randomUUID(),
              hash: bodyHash,
              parser: 'nse-integrated-indas-html-v1',
              sourceUrl: source.sourceUrl,
              effectiveOn: retrievedAt.slice(0, 10),
              publishedAt: null,
              retrievedAt,
              rightsBasis: current.rights_evidence,
              observations: parsed.observations,
            });
          } catch {
            status = 'quarantine';
            message =
              'Original retained; unsupported filing layout or identity. Inspect before changing a parser.';
          }
          if (edition) {
            editionId = edition.id;
            await c.query(
              'INSERT INTO equity_editions(id,fingerprint,actor_hash,payload) VALUES($1,$2,$3,$4)',
              [
                edition.id,
                digest({ source: id, bodyHash, rights: current.rights_hash }),
                current.actor_id,
                edition,
              ],
            );
            await c.query(
              "INSERT INTO equity_observations(edition_id,ordinal,isin,kind,effective_on,payload) SELECT $1,ordinality::integer,value->>'isin',value->>'kind',(value->>'effectiveOn')::date,value FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY",
              [edition.id, JSON.stringify(edition.observations)],
            );
            status = 'draft';
            message =
              'Changed original retained as a draft. Different named reviewer must publish.';
          }
        }
      }
      await c.query(
        'INSERT INTO filing_watch_attempts(id,source_id,source_url,rights_hash,gate_version,status,edition_id,body_hash,message) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          attemptId,
          id,
          source.sourceUrl,
          current.rights_hash,
          current.version,
          status,
          editionId,
          bodyHash,
          message,
        ],
      );
      await c.query('UPDATE filing_watch_gate SET cursor=$1 WHERE id=true', [
        (initial.cursor + index + 1) % selected.sourceIds.length,
      ]);
      await c.query('COMMIT');
      outcomes.push(attemptId);
      if (status === 'draft' || status === 'unchanged') successful++;
    }
    if (!successful)
      throw new ConflictException(
        'Every selected original was unavailable or quarantined; inspect attempts and retry.',
      );
    return digest(outcomes);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    if (locked)
      await c.query('SELECT pg_advisory_unlock(360927)').catch(() => {});
    c.release();
  }
}
@OperatorRead()
@Controller('ops/filing-watch')
export class FilingWatchOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: FilingWatchRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    action: 'read' | 'administer',
    c?: pg.PoolClient,
  ) {
    const v = await this.ops.permission(cookie, action, c);
    return typeof v === 'string' ? v : v.identity.id;
  }
  @Get() read(
    @Headers('cookie') cookie?: string,
    @Query('after') after?: string,
  ) {
    if (after && !z.uuid().safeParse(after).success)
      throw new BadRequestException('Invalid filing history cursor.');
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      if (
        after &&
        !(
          await c.query('SELECT 1 FROM filing_watch_attempts WHERE id=$1', [
            after,
          ])
        ).rows.length
      )
        throw new NotFoundException('History cursor unavailable.');
      const gate = (
          await c.query('SELECT * FROM filing_watch_gate WHERE id=true')
        ).rows[0],
        rows = (
          await c.query(
            `SELECT f.*,(SELECT payload FROM equity_editions WHERE id=f.edition_id) AS edition,CASE WHEN f.edition_id IS NULL THEN NULL ELSE COALESCE((SELECT CASE decision WHEN 'publish' THEN 'published' ELSE 'withdrawn' END FROM equity_reviews WHERE edition_id=f.edition_id ORDER BY seq DESC LIMIT 1),'draft') END AS edition_state FROM filing_watch_attempts f WHERE ($1::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM filing_watch_attempts WHERE id=$1)) ORDER BY created_at DESC,id DESC LIMIT 21`,
            [after ?? null],
          )
        ).rows;
      await this.actor(cookie, 'read', c);
      return FilingWatchStatusSchema.parse({
        gate: {
          enabled: gate.enabled,
          sourceIds: gate.source_ids,
          rightsEvidence: gate.rights_evidence,
        },
        version: gate.version,
        attempts: rows.slice(0, 20).map((r) => ({
          id: r.id,
          sourceId: r.source_id,
          sourceUrl: r.source_url,
          status: r.status,
          editionId: r.edition_id,
          bodyHash: r.body_hash,
          message: r.message,
          edition: r.edition,
          editionState: r.edition_state,
          createdAt: r.created_at.toISOString(),
        })),
        next: rows.length > 20 ? rows[19].id : null,
      });
    });
  }
  @OperatorAction('administer') @Post('gate') configure(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const p = FilingWatchGateSchema.safeParse(body);
    if (!p.success)
      throw new BadRequestException(
        'Select original sources and explicit permission.',
      );
    return this.store.transaction(async (c) => {
      const actor = await this.actor(cookie, 'administer', c);
      await c.query(
        'UPDATE filing_watch_gate SET enabled=$1,source_ids=$2,rights_evidence=$3,rights_hash=$4,actor_id=$5,version=version+1,cursor=0 WHERE id=true',
        [
          p.data.enabled,
          JSON.stringify(p.data.sourceIds),
          p.data.rightsEvidence,
          hash(p.data.rightsEvidence),
          actor,
        ],
      );
      await this.actor(cookie, 'administer', c);
      return p.data;
    });
  }
  @Get(':id/evidence') evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    if (!z.uuid().safeParse(id).success)
      throw new BadRequestException('Invalid filing attempt.');
    return this.store.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const row = (
        await c.query(
          'SELECT body_hash,source_url FROM filing_watch_attempts WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (!row?.body_hash)
        throw new NotFoundException(
          'This attempt did not receive source bytes.',
        );
      const raw = await this.raw.mongo
        .db()
        .collection<{ _id: string; body: string }>('equity_source_documents')
        .findOne({ _id: row.body_hash });
      if (!raw || hash(raw.body) !== row.body_hash)
        throw new ConflictException(
          'Retained original is unavailable or changed.',
        );
      await this.actor(cookie, 'read', c);
      return {
        sourceUrl: row.source_url,
        bodyHash: row.body_hash,
        body: raw.body,
      };
    });
  }
}
