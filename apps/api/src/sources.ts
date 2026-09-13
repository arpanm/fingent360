import { randomUUID, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import pg from 'pg';
import { z } from 'zod';
import {
  SourceInputSchema,
  SourceListSchema,
  SourceRecordSchema,
  SourceUpdateSchema,
  type SourceInput,
} from '@fingent360/contracts';
import { checkOrigin } from './account-security.js';
import type { AppConfig } from './config.js';
export const SOURCE_STORE = Symbol('SOURCE_STORE');
const STORE = SOURCE_STORE;
type Row = {
  source_id: string;
  revision: number;
  data: unknown;
  recorded_at: Date;
};
const record = (row: Row) =>
  SourceRecordSchema.parse({
    id: row.source_id,
    revision: row.revision,
    data: row.data,
    recordedAt: row.recorded_at.toISOString(),
  });
export class SourcesStore {
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
  authorize(auth?: string) {
    const token = this.config.RESEARCH_ADMIN_TOKEN;
    if (!token)
      throw new ServiceUnavailableException(
        'Configure the research operator key before editing sources.',
      );
    const supplied = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
    if (
      !/^[a-f0-9]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(supplied))
    )
      throw new UnauthorizedException('Valid operator key required.');
  }
  async list(operator = false, auth?: string) {
    if (operator) this.authorize(auth);
    try {
      const result = await this.pool.query<Row>(
        `SELECT r.* FROM research_sources s JOIN research_source_revisions r ON r.source_id=s.id AND r.revision=s.revision ${operator ? '' : "WHERE r.data->>'published'='true' AND r.data->>'rightsStatus'='approved'"} ORDER BY r.recorded_at DESC,s.id`,
      );
      return SourceListSchema.parse(result.rows.map(record));
    } catch {
      throw new ServiceUnavailableException(
        'Source registry unavailable. Check PostgreSQL and apply migrations.',
      );
    }
  }
  async history(id: string, auth?: string) {
    this.authorize(auth);
    if (!z.uuid().safeParse(id).success)
      throw new BadRequestException('Invalid source ID.');
    try {
      const rows = await this.pool.query<Row>(
        'SELECT * FROM research_source_revisions WHERE source_id=$1 ORDER BY revision DESC',
        [id],
      );
      if (!rows.rowCount) throw new NotFoundException('Source not found.');
      return SourceListSchema.parse(rows.rows.map(record));
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Source history unavailable.');
    }
  }
  async save(body: unknown, auth?: string, id?: string, origin?: string) {
    this.authorize(auth);
    checkOrigin(origin, this.config.WEB_ORIGIN);
    let data: SourceInput;
    let expected: number | undefined;
    if (id) {
      if (!z.uuid().safeParse(id).success)
        throw new BadRequestException('Invalid source ID.');
      const parsed = SourceUpdateSchema.safeParse(body);
      if (!parsed.success)
        throw new BadRequestException(
          'Invalid source revision: reviewed sources need evidence and only approved metadata can be published.',
        );
      data = parsed.data.data;
      expected = parsed.data.expectedRevision;
    } else {
      const parsed = SourceInputSchema.safeParse(body);
      if (!parsed.success)
        throw new BadRequestException(
          'Invalid source metadata: supply HTTPS source/terms URLs, constraints and review evidence.',
        );
      data = parsed.data;
    }
    let client: pg.PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const sourceId = id ?? randomUUID();
      let revision = 1;
      if (id) {
        const current = await client.query<{ revision: number }>(
          'SELECT revision FROM research_sources WHERE id=$1 FOR UPDATE',
          [id],
        );
        if (!current.rows[0]) throw new NotFoundException('Source not found.');
        if (current.rows[0].revision !== expected)
          throw new ConflictException('Source changed. Reload before editing.');
        revision = current.rows[0].revision + 1;
        await client.query(
          'UPDATE research_sources SET revision=$2 WHERE id=$1',
          [id, revision],
        );
      } else
        await client.query(
          'INSERT INTO research_sources(id,revision) VALUES ($1,1)',
          [sourceId],
        );
      const result = await client.query<Row>(
        'INSERT INTO research_source_revisions(source_id,revision,data) VALUES ($1,$2,$3::jsonb) RETURNING *',
        [sourceId, revision, JSON.stringify(data)],
      );
      const saved = record(result.rows[0]!);
      await client.query('COMMIT');
      return saved;
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {});
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Source registry unavailable. Check PostgreSQL and apply migrations.',
      );
    } finally {
      client?.release();
    }
  }
}
@Controller('sources')
export class SourcesController {
  constructor(@Inject(STORE) private readonly store: SourcesStore) {}
  @Get() list() {
    return this.store.list();
  }
  @Get('operator') operator(@Headers('authorization') auth?: string) {
    return this.store.list(true, auth);
  }
  @Get(':id/history') history(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ) {
    return this.store.history(id, auth);
  }
  @Post() create(
    @Body() body: unknown,
    @Headers('authorization') auth?: string,
    @Headers('origin') origin?: string,
  ) {
    return this.store.save(body, auth, undefined, origin);
  }
  @Put(':id') update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('authorization') auth?: string,
    @Headers('origin') origin?: string,
  ) {
    return this.store.save(body, auth, id, origin);
  }
}
export function sourcesProvider(config: AppConfig) {
  return { provide: STORE, useValue: new SourcesStore(config) };
}
