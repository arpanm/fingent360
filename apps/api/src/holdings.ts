import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import {
  HoldingsCsvSchema,
  HoldingsConfirmSchema,
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  HoldingsHistorySchema,
  HoldingRowsSchema,
  holdingsTotal,
  parseHoldingsCsv,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((v) => v.message).join('; '),
    );
  return result.data;
}
const empty = () =>
  HoldingsSnapshotSchema.parse({
    version: 0,
    holdings: [],
    totalCostMinor: '0',
    currency: 'INR',
    scale: 2,
    provenance: 'user-entered-unverified',
    updatedAt: null,
  });
@Controller('account/holdings')
export class HoldingsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() current(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const account = await this.store.require(c, cookie);
      const rows = await c.query(
        'SELECT r.payload FROM app_holdings h JOIN app_holdings_revisions r ON r.user_id=h.user_id AND r.version=h.version WHERE h.user_id=$1',
        [account.id],
      );
      return rows.rows[0]
        ? HoldingsSnapshotSchema.parse(rows.rows[0].payload)
        : empty();
    });
  }
  @Get('history') history(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const account = await this.store.require(c, cookie);
      const rows = await c.query(
        'SELECT payload FROM app_holdings_revisions WHERE user_id=$1 ORDER BY version DESC',
        [account.id],
      );
      return HoldingsHistorySchema.parse({
        revisions: rows.rows.map((r) => r.payload),
      });
    });
  }
  @Post('preview') preview(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const input = parse(HoldingsCsvSchema, body);
    let holdings;
    try {
      holdings = parseHoldingsCsv(input.csv);
    } catch (e) {
      throw new BadRequestException(
        e instanceof z.ZodError
          ? e.issues.map((v) => v.message).join('; ')
          : e instanceof Error
            ? e.message
            : 'Invalid CSV.',
      );
    }
    return this.store.transaction(async (c) => {
      const account = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        account.id,
      ]);
      const current = await c.query(
        'SELECT version FROM app_holdings WHERE user_id=$1',
        [account.id],
      );
      if ((current.rows[0]?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'Holdings changed. Reload before previewing.',
        );
      await c.query(
        'DELETE FROM app_holdings_previews WHERE user_id=$1 AND expires_at < now()',
        [account.id],
      );
      const pending = await c.query(
        'SELECT count(*)::integer AS count FROM app_holdings_previews WHERE user_id=$1',
        [account.id],
      );
      if (pending.rows[0].count >= 20)
        throw new BadRequestException(
          'Too many previews. Retry after existing previews expire in 30 minutes.',
        );
      const previewId = randomUUID();
      const expiresAt = new Date(Date.now() + 1800000).toISOString();
      await c.query(
        'INSERT INTO app_holdings_previews(id,user_id,expected_version,payload,expires_at) VALUES($1,$2,$3,$4,$5)',
        [
          previewId,
          account.id,
          input.expectedVersion,
          JSON.stringify(holdings),
          expiresAt,
        ],
      );
      return HoldingsPreviewSchema.parse({
        previewId,
        expiresAt,
        expectedVersion: input.expectedVersion,
        holdings,
        totalCostMinor: holdingsTotal(holdings),
        parserVersion: 'standard-holdings-csv-v1',
      });
    });
  }
  @Post('confirm') confirm(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const input = parse(HoldingsConfirmSchema, body);
    return this.store.transaction(async (c) => {
      const account = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        account.id,
      ]);
      const previews = await c.query(
        'SELECT * FROM app_holdings_previews WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [input.previewId, account.id],
      );
      const preview = previews.rows[0];
      if (!preview) throw new NotFoundException('Preview not found.');
      if (preview.expected_version !== input.expectedVersion)
        throw new ConflictException('Preview version does not match.');
      if (preview.confirmed_version !== null) {
        const old = await c.query(
          'SELECT payload FROM app_holdings_revisions WHERE user_id=$1 AND version=$2',
          [account.id, preview.confirmed_version],
        );
        return HoldingsSnapshotSchema.parse(old.rows[0].payload);
      }
      if (preview.expires_at.getTime() <= Date.now())
        throw new ConflictException('Preview expired. Create a fresh preview.');
      await c.query(
        'INSERT INTO app_holdings(user_id) VALUES($1) ON CONFLICT DO NOTHING',
        [account.id],
      );
      const current = await c.query(
        'SELECT version FROM app_holdings WHERE user_id=$1 FOR UPDATE',
        [account.id],
      );
      if (current.rows[0].version !== input.expectedVersion)
        throw new ConflictException(
          'Holdings changed. Reload and preview again.',
        );
      const holdings = HoldingRowsSchema.parse(preview.payload);
      const version = input.expectedVersion + 1;
      const result = HoldingsSnapshotSchema.parse({
        version,
        holdings,
        totalCostMinor: holdingsTotal(holdings),
        currency: 'INR',
        scale: 2,
        provenance: 'user-entered-unverified',
        updatedAt: new Date().toISOString(),
      });
      await c.query(
        'INSERT INTO app_holdings_revisions(user_id,version,payload) VALUES($1,$2,$3)',
        [account.id, version, result],
      );
      await c.query('UPDATE app_holdings SET version=$2 WHERE user_id=$1', [
        account.id,
        version,
      ]);
      await c.query(
        'UPDATE app_holdings_previews SET confirmed_version=$2 WHERE id=$1',
        [input.previewId, version],
      );
      return result;
    });
  }
}
