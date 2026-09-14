import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Headers,
  HttpException,
  Inject,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  PublishingFiltersSchema,
  PublishingPageSchema,
  PublishingPositionSchema,
  PublishingQuerySchema,
  FeedItemSchema,
  comparePublishingPosition,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';

const Cursor = z
  .strictObject({
    version: z.literal(1),
    filters: PublishingFiltersSchema,
    upper: PublishingPositionSchema,
    after: PublishingPositionSchema,
    openedAt: z.iso.datetime(),
  })
  .refine((v) => comparePublishingPosition(v.after, v.upper) <= 0);
const invalid = () =>
  new BadRequestException(
    'Invalid publishing filters or page. Reset the publishing queue.',
  );
const position = (entry: { item: { id: string }; changedAt: string }) => ({
  id: entry.item.id,
  changedAt: entry.changedAt,
});
@Controller('ops/discovery/queue')
export class PublishingQueueController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  private signature(body: string) {
    return createHmac('sha256', this.ops.serverAuthorization())
      .update(`publishing-queue-v1:${body}`)
      .digest();
  }
  private encode(value: z.infer<typeof Cursor>) {
    const body = Buffer.from(JSON.stringify(Cursor.parse(value))).toString(
      'base64url',
    );
    return `${body}.${this.signature(body).toString('base64url')}`;
  }
  private decode(value: string) {
    try {
      const [body, signature] = value.split('.');
      const bytes = Buffer.from(body!, 'base64url');
      const supplied = Buffer.from(signature!, 'base64url');
      const expected = this.signature(body!);
      if (
        bytes.toString('base64url') !== body ||
        supplied.toString('base64url') !== signature ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        throw invalid();
      return Cursor.parse(JSON.parse(bytes.toString('utf8')));
    } catch {
      throw invalid();
    }
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  async list(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    const actor = await this.ops.require(cookie);
    const input = PublishingQuerySchema.safeParse(query);
    if (!input.success) throw invalid();
    const { cursor: rawCursor, ...submitted } = input.data;
    const filters = PublishingFiltersSchema.parse(submitted);
    const cursor = rawCursor ? this.decode(rawCursor) : null;
    if (cursor && JSON.stringify(cursor.filters) !== JSON.stringify(filters))
      throw invalid();
    try {
      return await this.account.transaction(async (c) => {
        const rows = await c.query<{ data: unknown; changed_at: string }>(
          `SELECT v.data,to_char(v.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS changed_at
           FROM discovery_items i JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version
           WHERE ($1::text IS NULL OR v.data->>'status'=$1)
             AND ($2::text IS NULL OR
               CASE
                 WHEN i.id LIKE 'ecb-statistics-%' THEN 'ecb-statistics'
                 WHEN i.id LIKE 'ecb-press-%' THEN 'ecb-press'
                 WHEN i.id LIKE 'fed-%' THEN 'fed'
                 WHEN i.id LIKE 'pib-%' THEN 'pib'
                 WHEN i.id LIKE 'bea-%' THEN 'bea'
                 WHEN i.id LIKE 'annual-%' OR i.id LIKE 'wb-%' OR v.data->'source'->>'name'='World Bank' THEN 'world-bank'
                 WHEN v.data->>'kind'='term' THEN 'glossary'
                 ELSE 'other'
               END=$2)
             AND ($3::text IS NULL OR strpos(lower(concat(v.data->>'title',' ',v.data->>'summary')),lower($3))>0)
             AND ($4::timestamptz IS NULL OR (v.created_at,v.item_id COLLATE "C")<=($4::timestamptz,$5::text COLLATE "C"))
             AND ($6::timestamptz IS NULL OR (v.created_at,v.item_id COLLATE "C")<($6::timestamptz,$7::text COLLATE "C"))
           ORDER BY v.created_at DESC,v.item_id COLLATE "C" DESC LIMIT 21`,
          [
            filters.status ?? null,
            filters.source ?? null,
            filters.q ?? null,
            cursor?.upper.changedAt ?? null,
            cursor?.upper.id ?? null,
            cursor?.after.changedAt ?? null,
            cursor?.after.id ?? null,
          ],
        );
        const latest = await c.query<{
          id: string;
          started_at: Date;
          finished_at: Date | null;
          status: string;
          message: string;
          inserted: number;
        }>(
          'SELECT * FROM discovery_runs ORDER BY started_at DESC,id DESC LIMIT 1',
        );
        const items = rows.rows.slice(0, 20).map((row) => ({
          item: FeedItemSchema.parse(row.data),
          changedAt: row.changed_at,
        }));
        const upper = cursor?.upper ?? (items[0] ? position(items[0]) : null);
        const openedAt = cursor?.openedAt ?? new Date().toISOString();
        const last = latest.rows[0];
        const result = PublishingPageSchema.parse({
          items,
          filters,
          pageSize: 20,
          upper,
          openedAt,
          evaluatedAt: new Date().toISOString(),
          nextCursor:
            rows.rows.length > 20 && upper
              ? this.encode({
                  version: 1,
                  filters,
                  upper,
                  after: position(items.at(-1)!),
                  openedAt,
                })
              : null,
          latestRun: last
            ? {
                id: last.id,
                startedAt: last.started_at.toISOString(),
                finishedAt: last.finished_at?.toISOString() ?? null,
                status: last.status,
                message: last.message,
                inserted: last.inserted,
              }
            : null,
        });
        // Every storage wait precedes final admission. Keep it through commit.
        await c.query(
          'SELECT token_hash FROM operator_sessions WHERE token_hash=$1 FOR SHARE',
          [actor],
        );
        const active = await c.query(
          'SELECT 1 FROM operator_sessions WHERE token_hash=$1 AND expires_at>clock_timestamp()',
          [actor],
        );
        if (!active.rowCount)
          throw new UnauthorizedException('Sign in to operations.');
        return result;
      });
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() !== 503)
        throw error;
      throw new ServiceUnavailableException(
        'Publishing queue unavailable. Retry this page; no publications were changed.',
      );
    }
  }
}
