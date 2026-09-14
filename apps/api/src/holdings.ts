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
  HoldingsReconciliationSchema,
  storedHoldingsPreview,
  reconcileHoldings,
  HoldingsImportRequestSchema,
  HoldingsImportSchema,
  holdingsWorkbookTemplate,
  workbookBase64,
  workbookBytes,
  HoldingsTemplateSchema,
  HoldingsConfirmSchema,
  HoldingsPreviewSchema,
  HoldingsSnapshotSchema,
  HoldingsHistorySchema,
  holdingsTotal,
  parseHoldingsCsv,
  parseMappedHoldings,
} from '@fingent360/contracts';
import { parseWorkbook } from './workbook.js';
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
  @Get('template') async template(@Headers('cookie') cookie?: string) {
    await this.store.transaction((c) => this.store.require(c, cookie));
    return HoldingsTemplateSchema.parse({
      filename: 'fingent360-holdings-template.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: workbookBase64(holdingsWorkbookTemplate()),
      synthetic: false,
    });
  }
  @Get('sample') async sample(@Headers('cookie') cookie?: string) {
    await this.store.transaction((c) => this.store.require(c, cookie));
    return HoldingsTemplateSchema.parse({
      filename: 'SYNTHETIC-fingent360-holdings-sample.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: workbookBase64(holdingsWorkbookTemplate(true)),
      synthetic: true,
    });
  }
  @Post('preview') async preview(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const input = parse(HoldingsImportRequestSchema, body);
    await this.store.transaction((c) => this.store.require(c, cookie));
    let holdings;
    let imported: z.infer<typeof HoldingsImportSchema> = {
      parserVersion: 'standard-holdings-csv-v1',
    };
    try {
      if (
        'format' in input &&
        (input.format === 'mapped-csv' || input.format === 'supplemented-csv')
      ) {
        const parsed = parseMappedHoldings({
          format: input.format,
          csv: input.csv,
          mapping: input.mapping,
          declaredRowCount: input.declaredRowCount,
          declaredTotal: input.declaredTotal,
          ...(input.format === 'supplemented-csv'
            ? { supplement: input.supplement }
            : {}),
        });
        holdings = parsed.holdings;
        imported = parsed.import;
      } else if ('format' in input) {
        const parsed = await parseWorkbook(workbookBytes(input.workbookBase64));
        holdings = parsed.holdings;
        imported = {
          parserVersion: 'standard-holdings-xlsx-v1',
          declaredRowCount: parsed.declaredRowCount,
          declaredTotalMinor: parsed.declaredTotalMinor,
        };
      } else holdings = parseHoldingsCsv(input.csv);
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
      // Recovery may have revoked this session while the account lock waited.
      await this.store.require(c, cookie);
      const current = await c.query(
        'SELECT version FROM app_holdings WHERE user_id=$1',
        [account.id],
      );
      if ((current.rows[0]?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'Holdings changed. Reload before previewing.',
        );
      await c.query(
        'DELETE FROM app_holdings_previews WHERE user_id=$1 AND confirmed_version IS NULL AND expires_at < now()',
        [account.id],
      );
      // Retention can hold an expired preview row while this DELETE waits.
      await this.store.require(c, cookie);
      const pending = await c.query(
        'SELECT count(*)::integer AS count FROM app_holdings_previews WHERE user_id=$1 AND confirmed_version IS NULL',
        [account.id],
      );
      if (pending.rows[0].count >= 20)
        throw new BadRequestException(
          'Too many previews. Retry after existing previews expire in 30 minutes.',
        );
      const baselineRows = await c.query(
        'SELECT payload FROM app_holdings_revisions WHERE user_id=$1 AND version=$2',
        [account.id, input.expectedVersion],
      );
      if (input.expectedVersion > 0 && !baselineRows.rows[0])
        throw new ConflictException(
          'Saved baseline unavailable. Reload your holdings.',
        );
      const baseline = HoldingsSnapshotSchema.parse(
        baselineRows.rows[0]?.payload ?? empty(),
      );
      const allocation = await c.query(
        "SELECT jsonb_array_length(r.payload->'rows') AS count FROM app_goal_allocations a JOIN app_goal_allocation_revisions r ON r.user_id=a.user_id AND r.version=a.version WHERE a.user_id=$1",
        [account.id],
      );
      const connections = await c.query(
        "SELECT count(*)::int AS count FROM app_research_connections h JOIN app_research_connection_revisions r ON r.connection_id=h.id AND r.version=h.version WHERE h.user_id=$1 AND NOT h.removed AND r.payload->'target'->'binding'->>'kind'='holding'",
        [account.id],
      );
      const reconciliation = reconcileHoldings(baseline, holdings, {
        allocationRows: allocation.rows[0]?.count ?? 0,
        holdingConnections: connections.rows[0].count,
        checkedAt: new Date().toISOString(),
      });
      const previewId = randomUUID();
      const expiresAt = new Date(Date.now() + 1800000).toISOString();
      await c.query(
        'INSERT INTO app_holdings_previews(id,user_id,expected_version,payload,expires_at) VALUES($1,$2,$3,$4,$5)',
        [
          previewId,
          account.id,
          input.expectedVersion,
          JSON.stringify({ holdings, import: imported, reconciliation }),
          expiresAt,
        ],
      );
      return HoldingsPreviewSchema.parse({
        previewId,
        expiresAt,
        expectedVersion: input.expectedVersion,
        holdings,
        totalCostMinor: holdingsTotal(holdings),
        reconciliation,
        parserVersion: imported.parserVersion,
        import: imported,
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
      await this.store.require(c, cookie);
      const previews = await c.query(
        'SELECT * FROM app_holdings_previews WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [input.previewId, account.id],
      );
      await this.store.require(c, cookie);
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
      await this.store.require(c, cookie);
      if (current.rows[0].version !== input.expectedVersion)
        throw new ConflictException(
          'Holdings changed. Reload and preview again.',
        );
      let decoded: ReturnType<typeof storedHoldingsPreview>;
      try {
        decoded = storedHoldingsPreview(preview.payload);
      } catch {
        throw new ConflictException(
          'This preview is unreadable. Create a fresh preview.',
        );
      }
      const holdings = decoded.holdings,
        imported = decoded.import;
      const review = HoldingsReconciliationSchema.safeParse(
        Array.isArray(preview.payload)
          ? undefined
          : preview.payload.reconciliation,
      );
      if (!review.success)
        throw new ConflictException(
          'This preview has no readable change review. Create a fresh preview.',
        );
      if (preview.expires_at.getTime() <= Date.now())
        throw new ConflictException('Preview expired. Create a fresh preview.');
      const baselineRows = await c.query(
        'SELECT payload FROM app_holdings_revisions WHERE user_id=$1 AND version=$2',
        [account.id, input.expectedVersion],
      );
      const baseline = HoldingsSnapshotSchema.parse(
        baselineRows.rows[0]?.payload ?? empty(),
      );
      let reconciles: boolean;
      try {
        reconciles =
          JSON.stringify(baseline) === JSON.stringify(review.data.baseline) &&
          JSON.stringify(
            reconcileHoldings(baseline, holdings, review.data.dependencies),
          ) === JSON.stringify(review.data);
      } catch {
        reconciles = false;
      }
      if (!reconciles)
        throw new ConflictException(
          'Preview change review no longer reconciles. Create a fresh preview.',
        );
      if (
        review.data.changes.some((change) => change.status === 'removed') &&
        !input.acknowledgeRemovals
      )
        throw new BadRequestException(
          'Acknowledge removal of the listed holdings before confirming.',
        );
      const version = input.expectedVersion + 1;
      const result = HoldingsSnapshotSchema.parse({
        version,
        holdings,
        totalCostMinor: holdingsTotal(holdings),
        currency: 'INR',
        scale: 2,
        provenance: 'user-entered-unverified',
        import: imported,
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
