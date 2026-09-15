import { z } from 'zod';
import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import pg from 'pg';
import { MongoClient } from 'mongodb';
import {
  EvalDetailSchema,
  EvalListSchema,
  EvalQuerySchema,
  PublicViewContextSchema,
  EventExtractionAttemptSchema,
  MediaAssetSchema,
} from '@fingent360/contracts';
import { admitPublications } from './publication.js';
import type { AppConfig } from './config.js';
import { OperatorRead } from './operator-permissions.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
export const EVAL_LINEAGE_STORE = Symbol('EVAL_LINEAGE_STORE');
export class EvalLineageStore {
  private readonly pool: pg.Pool;
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {});
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await Promise.allSettled([this.pool.end(), this.mongo.close()]);
  }
  async list(query: unknown) {
    const parsed = EvalQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException('Invalid evaluation filter.');
    const q = parsed.data;
    let cursor: { at: string; id: string } | undefined;
    if (q.before) {
      try {
        cursor = z
          .strictObject({
            at: z.string().max(80),
            id: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .parse(
            JSON.parse(Buffer.from(q.before, 'base64url').toString('utf8')),
          );
        if (!Number.isFinite(Date.parse(cursor.at)))
          throw Error('Invalid time');
      } catch {
        throw new BadRequestException('Invalid evaluation cursor.');
      }
    }
    const rows = await this.pool.query<{
      id: string;
      source_id: string;
      source_version: number;
      captured_at: Date;
      cursor_at: string;
    }>(
      `SELECT id,source_id,source_version,captured_at,captured_at::text AS cursor_at FROM evaluation_public_views WHERE ($1::text IS NULL OR source_id=$1) AND ($2::timestamptz IS NULL OR (captured_at,id)<($2,$3)) ORDER BY captured_at DESC,id DESC LIMIT 51`,
      [q.sourceId ?? null, cursor?.at ?? null, cursor?.id ?? null],
    );
    const tail = rows.rows[49];
    return EvalListSchema.parse({
      items: rows.rows.slice(0, 50).map((r) => ({
        sourceId: r.source_id,
        sourceVersion: r.source_version,
        capturedAt: r.captured_at.toISOString(),
      })),
      nextBefore:
        rows.rows.length > 50 && tail
          ? Buffer.from(
              JSON.stringify({ at: tail.cursor_at, id: tail.id }),
            ).toString('base64url')
          : null,
    });
  }
  async detail(
    sourceId: string,
    authorize: () => Promise<unknown> = async () => undefined,
  ) {
    if (!EvalQuerySchema.safeParse({ sourceId }).success)
      throw new BadRequestException('Invalid source.');
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const current = (await admitPublications(c, [sourceId])).find(
        (s) => s.status === 'published',
      );
      if (!current) {
        await authorize();
        await c.query('COMMIT');
        return EvalDetailSchema.parse({
          sourceId,
          current: false,
          traces: [],
          views: [],
          feedback: [],
          compositions: [],
          eventAttempts: [],
          imageAttempts: [],
          sourceHashes: [],
          note: 'Current source is unavailable or withdrawn. Retained content is withheld.',
        });
      }
      const calls = await c.query<{
        id: string;
        source_id: string;
        source_version: number;
        kind: string;
        provider: string;
        model: string;
        started_at: Date;
        finished_at: Date | null;
        status: string;
        instructions: string;
        input: string;
        raw_output: string | null;
        text_output: string | null;
        outcome: string;
      }>(
        'SELECT * FROM evaluation_public_calls WHERE source_id=$1 ORDER BY started_at DESC LIMIT 25',
        [sourceId],
      );
      const views = await c.query<{
        id: string;
        source_id: string;
        source_version: number;
        captured_at: Date;
        payload: unknown;
      }>(
        'SELECT * FROM evaluation_public_views WHERE source_id=$1 ORDER BY captured_at DESC LIMIT 25',
        [sourceId],
      );
      const feedback = await c.query<{
        id: string;
        status: string;
        received_at: Date;
        text: string | null;
        context: unknown;
      }>(
        "SELECT id,status,received_at,text,context FROM feedback_reports WHERE deleted_at IS NULL AND expires_at>now() AND context->'publicView'->'item'->>'id'=$1 ORDER BY received_at DESC LIMIT 25",
        [sourceId],
      );
      const compositions = await c.query<{
        id: string;
        item: unknown;
        asset_id: string;
        image_attempt_id: string | null;
        image_hash: string | null;
        captured_at: Date;
        data: unknown;
      }>(
        'SELECT v.*,m.data FROM evaluation_public_compositions v JOIN discovery_media m ON m.id=v.asset_id WHERE v.source_id=$1 ORDER BY v.captured_at DESC LIMIT 25',
        [sourceId],
      );
      const eventAttempts = await c.query<{ payload: unknown }>(
        "SELECT payload FROM event_extraction_requests WHERE payload->'source'->>'id'=$1 ORDER BY payload->>'startedAt' DESC LIMIT 25",
        [sourceId],
      );
      const images = await c.query<{
        id: string;
        asset_id: string;
        provider: string;
        model: string;
        status: string;
        started_at: Date;
        message: string;
      }>(
        'SELECT a.* FROM story_image_attempts a JOIN discovery_media m ON m.id=a.asset_id WHERE m.item_id=$1 ORDER BY a.started_at DESC LIMIT 25',
        [sourceId],
      );
      const result = EvalDetailSchema.parse({
        sourceId,
        current: true,
        traces: calls.rows.map((r) => ({
          id: r.id,
          sourceId: r.source_id,
          sourceVersion: r.source_version,
          kind: r.kind,
          provider: r.provider,
          model: r.model,
          startedAt: r.started_at.toISOString(),
          finishedAt: r.finished_at?.toISOString() ?? null,
          status: r.status,
          instructions: r.instructions,
          input: r.input,
          rawOutput: r.raw_output,
          textOutput: r.text_output,
          outcome: r.outcome,
        })),
        views: views.rows.map((r) => ({
          id: r.id,
          sourceId: r.source_id,
          sourceVersion: r.source_version,
          capturedAt: r.captured_at.toISOString(),
          payload: r.payload,
        })),
        feedback: feedback.rows.flatMap((r) => {
          const context = r.context as { publicView?: unknown } | null;
          const view = PublicViewContextSchema.safeParse(context?.publicView);
          return view.success
            ? [
                {
                  id: r.id,
                  status: r.status,
                  receivedAt: r.received_at.toISOString(),
                  text: r.text,
                  view: view.data,
                },
              ]
            : [];
        }),
        compositions: compositions.rows.map((v) => ({
          id: v.id,
          item: v.item,
          media: {
            assetId: v.asset_id,
            imageAttemptId: v.image_attempt_id,
            imageHash: v.image_hash,
          },
          captions: MediaAssetSchema.parse(v.data).captions,
          capturedAt: v.captured_at.toISOString(),
        })),
        eventAttempts: eventAttempts.rows.flatMap((row) => {
          const parsed = EventExtractionAttemptSchema.safeParse(row.payload);
          return parsed.success ? [parsed.data] : [];
        }),
        imageAttempts: images.rows.map((r) => ({
          id: r.id,
          assetId: r.asset_id,
          provider: r.provider,
          model: r.model,
          status: r.status,
          startedAt: r.started_at.toISOString(),
          message: r.message,
        })),
        sourceHashes: [
          ...new Set(
            [
              current.sourceHash,
              ...views.rows.map(
                (r) => (r.payload as { sourceHash?: string }).sourceHash,
              ),
            ].filter((v): v is string => !!v),
          ),
        ],
        note: 'Public-source traces only. Feedback snapshots are client-supplied observations, not proof of rendering or verified source facts. Deleted/expired reports are excluded. Individual lists are bounded to 25 newest records. Consumer validation remains in event/media receipts; provider success is not editorial approval.',
      });
      await authorize();
      await c.query('COMMIT');
      return result;
    } catch (error) {
      await c.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      c.release();
    }
  }
  async sourceEvidence(
    sourceId: string,
    authorize: () => Promise<unknown> = async () => undefined,
  ) {
    const detail = await this.detail(sourceId, authorize);
    if (!detail.current) return { available: false, records: [] };
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const current = (await admitPublications(c, [sourceId])).find(
        (s) => s.status === 'published',
      );
      if (!current) {
        await authorize();
        await c.query('COMMIT');
        return { available: false, records: [] };
      }
      const records = await this.mongo
        .db()
        .collection<{
          _id: string;
          url: string;
          body: string;
          retrievedAt: string;
        }>('discovery_raw')
        .find({ _id: { $in: detail.sourceHashes } })
        .limit(5)
        .toArray();
      await authorize();
      await c.query('COMMIT');
      return {
        available: true,
        limit: 5,
        records: records.map((r) => ({
          hash: r._id,
          url: r.url,
          body: r.body.slice(0, 2000000),
          retrievedAt: r.retrievedAt,
          truncated: r.body.length > 2000000,
        })),
      };
    } catch (error) {
      await c.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      c.release();
    }
  }
}
@OperatorRead()
@Controller('ops/evaluations')
export class EvalLineageController {
  constructor(
    @Inject(EVAL_LINEAGE_STORE) private readonly store: EvalLineageStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() async list(
    @Query('sourceId') sourceId?: string,
    @Query('before') before?: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.ops.require(cookie);
    const value = await this.store.list({ sourceId, before });
    await this.ops.require(cookie);
    return value;
  }
  @Get(':id') async detail(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.ops.require(cookie);
    const value = await this.store.detail(id, () => this.ops.require(cookie));
    await this.ops.require(cookie);
    return value;
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.ops.require(cookie);
    const value = await this.store.sourceEvidence(id, () =>
      this.ops.require(cookie),
    );
    await this.ops.require(cookie);
    return value;
  }
}
