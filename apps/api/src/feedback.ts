import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  GoneException,
  Headers,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import pg from 'pg';
import { z } from 'zod';
import {
  FeedbackReceiptSchema,
  FeedbackReportSchema,
  FeedbackReviewSchema,
  FeedbackListSchema,
  FeedbackStatusSchema,
} from '@fingent360/contracts';
import type { AppConfig } from './config.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { validateFeedbackSubmission } from './feedback-validation.js';
export const FEEDBACK_STORE = Symbol('FEEDBACK_STORE');
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
interface FeedbackRow {
  id: string;
  token_hash: string;
  payload_hash: string;
  status: string;
  version: number;
  received_at: Date;
  updated_at: Date;
  expires_at: Date;
  deleted_at: Date | null;
  text: string | null;
  context: unknown;
  image_meta: { mime: 'image/png'; width: number; height: number } | null;
  image_bytes: Buffer | null;
  audio_meta: {
    mime: 'audio/webm' | 'audio/mp4' | 'audio/ogg';
    durationMs: number;
  } | null;
  audio_bytes: Buffer | null;
}
const receipt = (row: FeedbackRow) =>
  FeedbackReceiptSchema.parse({
    id: row.id,
    status: row.status,
    receivedAt: row.received_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    version: row.version,
  });
const report = (row: FeedbackRow) =>
  FeedbackReportSchema.parse({
    ...receipt(row),
    text: row.text,
    context: row.context,
    image:
      row.image_meta && row.image_bytes
        ? { ...row.image_meta, base64: row.image_bytes.toString('base64') }
        : null,
    audio:
      row.audio_meta && row.audio_bytes
        ? { ...row.audio_meta, base64: row.audio_bytes.toString('base64') }
        : null,
  });
function validId(id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new BadRequestException('Invalid feedback ID.');
}
function tokenHash(token?: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new NotFoundException('Feedback not found.');
  return hash(token);
}
function owns(row: FeedbackRow, token?: string) {
  const supplied = tokenHash(token);
  if (
    !timingSafeEqual(
      Buffer.from(supplied, 'hex'),
      Buffer.from(row.token_hash, 'hex'),
    )
  )
    throw new NotFoundException('Feedback not found.');
}
export class FeedbackStore {
  private readonly pool: pg.Pool;
  constructor(private readonly config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {});
  }
  async onApplicationShutdown() {
    await this.pool.end();
  }
  origin(origin?: string) {
    if (
      origin !== this.config.WEB_ORIGIN &&
      origin !== 'https://appassets.androidplatform.net'
    )
      throw new ForbiddenException('Feedback origin is not allowed.');
  }
  private async transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
    const c = await this.pool.connect().catch(() => {
      throw new ServiceUnavailableException(
        'Feedback storage unavailable. Retry later with the same report.',
      );
    });
    try {
      await c.query(
        'UPDATE feedback_reports SET deleted_at=now(),updated_at=now(),text=NULL,context=NULL,image_meta=NULL,image_bytes=NULL,audio_meta=NULL,audio_bytes=NULL WHERE deleted_at IS NULL AND expires_at<=now()',
      );
      await c.query('BEGIN');
      const result = await work(c);
      await c.query('COMMIT');
      return result;
    } catch (error) {
      await c.query('ROLLBACK').catch(() => {});
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Feedback storage unavailable. Retry later with the same report.',
      );
    } finally {
      c.release();
    }
  }
  private async row(c: pg.PoolClient, id: string) {
    const r = await c.query<FeedbackRow>(
      'SELECT * FROM feedback_reports WHERE id=$1 FOR UPDATE',
      [id],
    );
    return r.rows[0];
  }
  private async limit(c: pg.PoolClient, address: string) {
    const privateAddress = createHmac('sha256', this.config.DATABASE_URL)
      .update(address)
      .digest('hex');
    for (const [bucket, max] of [
      ['global', 200],
      [privateAddress, 20],
    ] as const) {
      const r = await c.query<{ count: number }>(
        "INSERT INTO feedback_rate_limits(bucket,window_start,count) VALUES($1,date_trunc('hour',now()),1) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN feedback_rate_limits.window_start<date_trunc('hour',now()) THEN 1 ELSE feedback_rate_limits.count+1 END,window_start=date_trunc('hour',now()) RETURNING count",
        [bucket],
      );
      if (r.rows[0]!.count > max)
        throw new HttpException(
          'Too many new reports. Keep this report and retry later.',
          429,
        );
    }
    await c.query(
      "DELETE FROM feedback_rate_limits WHERE window_start<now()-interval '2 days'",
    );
  }
  async submit(body: unknown, address: string) {
    const { submission, image, audio } = validateFeedbackSubmission(body);
    const { receiptToken, ...payload } = submission;
    const digest = hash(JSON.stringify(payload));
    return this.transaction(async (c) => {
      await c.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,360401))',
        [submission.id],
      );
      const old = await this.row(c, submission.id);
      if (old) {
        if (old.token_hash !== hash(receiptToken))
          throw new ConflictException(
            'Feedback ID already exists with different receipt details.',
          );
        if (old.deleted_at || old.expires_at <= new Date())
          throw new GoneException(
            'Feedback was deleted or expired. This report ID cannot be reused.',
          );
        if (old.payload_hash !== digest)
          throw new ConflictException(
            'Submitted feedback is immutable. Create a new report for changes.',
          );
        return receipt(old);
      }
      await this.limit(c, address);
      const r = await c.query<FeedbackRow>(
        'INSERT INTO feedback_reports(id,token_hash,payload_hash,text,context,image_meta,image_bytes,audio_meta,audio_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [
          submission.id,
          hash(receiptToken),
          digest,
          submission.text,
          JSON.stringify(submission.context),
          submission.image
            ? JSON.stringify({
                mime: submission.image.mime,
                width: submission.image.width,
                height: submission.image.height,
              })
            : null,
          image,
          submission.audio
            ? JSON.stringify({
                mime: submission.audio.mime,
                durationMs: submission.audio.durationMs,
              })
            : null,
          audio,
        ],
      );
      await c.query(
        "INSERT INTO feedback_audit(report_id,actor,action,version) VALUES($1,'capability','submitted',1)",
        [submission.id],
      );
      return receipt(r.rows[0]!);
    });
  }
  async get(id: string, token?: string) {
    validId(id);
    tokenHash(token);
    return this.transaction(async (c) => {
      const row = await this.row(c, id);
      if (!row) throw new NotFoundException('Feedback not found.');
      owns(row, token);
      if (row.deleted_at || row.expires_at <= new Date())
        throw new GoneException('Feedback was deleted or expired.');
      return report(row);
    });
  }
  private async erase(c: pg.PoolClient, row: FeedbackRow, actor: string) {
    if (!row.deleted_at) {
      await c.query(
        'UPDATE feedback_reports SET deleted_at=now(),updated_at=now(),version=version+1,text=NULL,context=NULL,image_meta=NULL,image_bytes=NULL,audio_meta=NULL,audio_bytes=NULL WHERE id=$1',
        [row.id],
      );
      await c.query(
        "INSERT INTO feedback_audit(report_id,actor,action,version) VALUES($1,$2,'deleted',$3)",
        [row.id, actor, row.version + 1],
      );
    }
    return { id: row.id, deleted: true };
  }
  async remove(id: string, token?: string, address = 'unknown') {
    validId(id);
    const digest = tokenHash(token);
    return this.transaction(async (c) => {
      await c.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,360401))',
        [id],
      );
      const row = await this.row(c, id);
      if (!row) {
        await this.limit(c, address);
        await c.query(
          'INSERT INTO feedback_reports(id,token_hash,payload_hash,deleted_at) VALUES($1,$2,$3,now())',
          [id, digest, hash('deleted-before-receipt')],
        );
        await c.query(
          "INSERT INTO feedback_audit(report_id,actor,action,version) VALUES($1,'capability','cancelled-before-receipt',1)",
          [id],
        );
        return { id, deleted: true };
      }
      owns(row, token);
      return this.erase(c, row, 'capability');
    });
  }

  async list(status?: string, cursor?: string) {
    const selected = FeedbackStatusSchema.optional().safeParse(status);
    if (!selected.success)
      throw new BadRequestException('Invalid feedback status.');
    let after: { id: string; at: string; status: string } | null = null;
    if (cursor !== undefined) {
      try {
        if (cursor.length > 200 || !/^[A-Za-z0-9_-]+$/.test(cursor))
          throw Error();
        const bytes = Buffer.from(cursor, 'base64url');
        if (bytes.toString('base64url') !== cursor) throw Error();
        after = z
          .strictObject({
            id: z.uuid(),
            at: z.iso.datetime(),
            status: z.string(),
          })
          .parse(JSON.parse(bytes.toString('utf8')));
        if (after.status !== (status ?? '')) throw Error();
      } catch {
        throw new BadRequestException('Invalid feedback cursor.');
      }
    }
    return this.transaction(async (c) => {
      const result = await c.query<FeedbackRow>(
        'SELECT id,status,version,received_at,updated_at,text,context,image_meta,audio_meta FROM feedback_reports WHERE deleted_at IS NULL AND expires_at>now() AND ($1::text IS NULL OR status=$1) AND ($2::timestamptz IS NULL OR (received_at,id)<($2,$3::uuid)) ORDER BY received_at DESC,id DESC LIMIT 51',
        [status ?? null, after?.at ?? null, after?.id ?? null],
      );
      const rows = result.rows.slice(0, 50),
        last = rows.at(-1);
      return FeedbackListSchema.parse({
        items: rows.map((row) => ({
          ...receipt(row),
          text: row.text,
          context: row.context,
          hasImage: row.image_meta !== null,
          hasAudio: row.audio_meta !== null,
        })),
        nextCursor:
          result.rows.length > 50 && last
            ? Buffer.from(
                JSON.stringify({
                  id: last.id,
                  at: last.received_at.toISOString(),
                  status: status ?? '',
                }),
              ).toString('base64url')
            : null,
      });
    });
  }
  async operatorGet(id: string) {
    validId(id);
    return this.transaction(async (c) => {
      const row = await this.row(c, id);
      if (!row || row.deleted_at || row.expires_at <= new Date())
        throw new NotFoundException('Feedback not found.');
      return report(row);
    });
  }
  async review(
    id: string,
    body: unknown,
    actor: string,
    authorize: () => Promise<unknown> = async () => undefined,
  ) {
    validId(id);
    const parsed = FeedbackReviewSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Choose a valid feedback status and expected version.',
      );
    return this.transaction(async (c) => {
      const row = await this.row(c, id);
      await authorize();
      if (!row || row.deleted_at || row.expires_at <= new Date())
        throw new NotFoundException('Feedback not found.');
      if (row.version !== parsed.data.expectedVersion)
        throw new ConflictException(
          'Feedback changed. Reload before reviewing.',
        );
      const r = await c.query<FeedbackRow>(
        'UPDATE feedback_reports SET status=$2,version=version+1,updated_at=now() WHERE id=$1 RETURNING *',
        [id, parsed.data.status],
      );
      await c.query(
        'INSERT INTO feedback_audit(report_id,actor,action,version) VALUES($1,$2,$3,$4)',
        [id, actor, `status:${parsed.data.status}`, r.rows[0]!.version],
      );
      await authorize();
      return receipt(r.rows[0]!);
    });
  }
  async operatorRemove(
    id: string,
    actor: string,
    authorize: () => Promise<unknown> = async () => undefined,
  ) {
    validId(id);
    return this.transaction(async (c) => {
      const row = await this.row(c, id);
      await authorize();
      if (!row) throw new NotFoundException('Feedback not found.');
      return this.erase(c, row, actor);
    });
  }
}
@Controller('feedback')
export class FeedbackController {
  constructor(@Inject(FEEDBACK_STORE) private readonly store: FeedbackStore) {}
  @Post() submit(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Req() request: { socket: { remoteAddress?: string } },
  ) {
    this.store.origin(origin);
    return this.store.submit(body, request.socket.remoteAddress ?? 'unknown');
  }
  @Get(':id') get(
    @Param('id') id: string,
    @Headers('x-feedback-token') token?: string,
  ) {
    return this.store.get(id, token);
  }
  @Delete(':id') remove(
    @Param('id') id: string,
    @Headers('x-feedback-token') token: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Req() request: { socket: { remoteAddress?: string } },
  ) {
    this.store.origin(origin);
    return this.store.remove(
      id,
      token,
      request.socket.remoteAddress ?? 'unknown',
    );
  }
}
@OperatorRead()
@Controller('ops/feedback')
export class OpsFeedbackController {
  constructor(
    @Inject(FEEDBACK_STORE) private readonly store: FeedbackStore,
    @Inject(OPERATOR_STORE) private readonly operator: OperatorStore,
  ) {}
  @Get() async list(
    @Headers('cookie') cookie: string | undefined,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
  ) {
    await this.operator.require(cookie);
    return this.store.list(status, cursor);
  }
  @Get(':id') async get(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.operator.require(cookie);
    return this.store.operatorGet(id);
  }
  @OperatorAction('administer')
  @Patch(':id')
  async review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin?: string,
  ) {
    this.operator.origin(origin);
    const actor = await this.operator.require(cookie);
    return this.store.review(id, body, actor, () =>
      this.operator.permission(cookie, 'administer'),
    );
  }
  @OperatorAction('administer')
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin?: string,
  ) {
    this.operator.origin(origin);
    const actor = await this.operator.require(cookie);
    return this.store.operatorRemove(id, actor, () =>
      this.operator.permission(cookie, 'administer'),
    );
  }
}
export function feedbackProvider(config: AppConfig) {
  return { provide: FEEDBACK_STORE, useValue: new FeedbackStore(config) };
}
