import { namedSessionCondition } from './named-operator-store.js';
import { OperatorRead } from './operator-permissions.js';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
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
  AuditFiltersSchema,
  AuditPageSchema,
  AuditPositionSchema,
  AuditQuerySchema,
  auditEventInfo,
  auditEvents,
  projectAuditEvent,
  type AuditFilters,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';

const Cursor = z.strictObject({
  version: z.literal(1),
  filters: AuditFiltersSchema,
  upper: AuditPositionSchema,
  before: AuditPositionSchema,
});
const invalid = () =>
  new BadRequestException(
    'Invalid audit filters or page. Reset audit activity and try again.',
  );
const position = (row: { id: string; recordedAt: string }) => ({
  id: row.id,
  recordedAt: row.recordedAt,
});
@OperatorRead()
@Controller('ops/audit')
export class OperatorAuditController {
  private readonly namedCursorKey = randomBytes(32);
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  private signature(body: string) {
    const authorization = this.ops.serverAuthorization();
    const key =
      typeof authorization === 'string' ? authorization : this.namedCursorKey;
    return createHmac('sha256', key)
      .update(`operator-audit-v1:${body}`)
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
      const supplied = Buffer.from(signature!, 'base64url');
      const expected = this.signature(body!);
      if (
        supplied.toString('base64url') !== signature ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        throw invalid();
      return Cursor.parse(
        JSON.parse(Buffer.from(body!, 'base64url').toString('utf8')),
      );
    } catch {
      throw invalid();
    }
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  async list(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    const actor = await this.ops.require(cookie);
    const parsed = AuditQuerySchema.safeParse(query);
    if (!parsed.success) throw invalid();
    const cursor =
      'cursor' in parsed.data ? this.decode(parsed.data.cursor) : null;
    const filters: AuditFilters =
      cursor?.filters ?? (parsed.data as AuditFilters);
    try {
      return await this.account.transaction(async (c) => {
        // The allowlist is applied in SQL: private targets and actor hashes are
        // never selected. Unknown action strings cannot become display content.
        const known = auditEvents.filter((event) => event !== 'other');
        const events = filters.event
          ? [filters.event]
          : filters.module
            ? auditEvents.filter(
                (event) => auditEventInfo[event].module === filters.module,
              )
            : null;
        const rows = await c.query<{
          id: string;
          recorded_at: string;
          event: string;
        }>(
          `SELECT id,to_char(recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recorded_at,
             CASE WHEN action=ANY($1::text[]) THEN action ELSE 'other' END AS event
           FROM operator_audit
           WHERE ($2::text[] IS NULL OR (CASE WHEN action=ANY($1::text[]) THEN action ELSE 'other' END)=ANY($2::text[]))
             AND ($3::date IS NULL OR recorded_at >= $3::date::timestamp AT TIME ZONE 'UTC')
             AND ($4::date IS NULL OR recorded_at < ($4::date+1)::timestamp AT TIME ZONE 'UTC')
             AND ($5::timestamptz IS NULL OR (recorded_at,id)<=($5::timestamptz,$6::uuid))
             AND ($7::timestamptz IS NULL OR (recorded_at,id)<($7::timestamptz,$8::uuid))
           ORDER BY operator_audit.recorded_at DESC,id DESC LIMIT 51`,
          [
            known,
            events,
            filters.from ?? null,
            filters.through ?? null,
            cursor?.upper.recordedAt ?? null,
            cursor?.upper.id ?? null,
            cursor?.before.recordedAt ?? null,
            cursor?.before.id ?? null,
          ],
        );
        const items = rows.rows.slice(0, 50).map((row) => {
          const event = projectAuditEvent(row.event);
          return {
            id: row.id,
            recordedAt: row.recorded_at,
            event,
            module: auditEventInfo[event].module,
          };
        });
        const upper = cursor?.upper ?? (items[0] ? position(items[0]) : null);
        const result = AuditPageSchema.parse({
          items,
          filters,
          upper,
          pageSize: 50,
          nextCursor:
            rows.rows.length > 50 && upper
              ? this.encode({
                  version: 1,
                  filters,
                  upper,
                  before: position(items.at(-1)!),
                })
              : null,
        });
        // A table/query wait must not admit an already-revoked or expired read.
        // Hold final session admission through commit, and check the clock again
        // AFTER the row lock (including a concurrent sign-out/update wait).
        await c.query(
          'SELECT token_hash FROM operator_sessions WHERE token_hash=$1 FOR SHARE',
          [actor],
        );
        const active = await c.query(
          `SELECT 1 FROM operator_sessions WHERE token_hash=$1 AND expires_at>clock_timestamp() AND ${namedSessionCondition}`,
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
        'Audit activity is unavailable. Retry this page; no records were changed.',
      );
    }
  }
}
