import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  ConnectionReviewInboxSchema,
  ConnectionReviewExportSchema,
  ConnectionReviewReceiptSchema,
  CheckConnectionsSchema,
  AcknowledgeConnectionSchema,
  emptyReviewInbox,
  evaluateConnections,
  ResearchConnectionRevisionSchema,
  FeedItemSchema,
  HoldingsSnapshotSchema,
  SavedGoalSchema,
  connectionTargets,
  connectionSource,
  connectionView,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new BadRequestException('Invalid review request.');
  return r.data;
}
async function inbox(c: pg.PoolClient, userId: string) {
  const r = await c.query(
    'SELECT payload FROM app_connection_review_inboxes WHERE user_id=$1',
    [userId],
  );
  return ConnectionReviewInboxSchema.parse(
    r.rows[0]?.payload ?? emptyReviewInbox(),
  );
}
export async function exportConnectionReviews(
  c: pg.PoolClient,
  userId: string,
) {
  const value = await inbox(c, userId);
  const rows = await c.query(
    "SELECT payload FROM app_connection_review_requests WHERE user_id=$1 AND created_at>clock_timestamp()-interval '30 days' ORDER BY created_at DESC",
    [userId],
  );
  return ConnectionReviewExportSchema.parse({
    ...value,
    receipts: rows.rows.map((r) => r.payload),
  });
}
@Controller('account/connection-reviews')
export class ConnectionReviewsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  private async owner(c: pg.PoolClient, cookie: string | undefined) {
    const user = await this.store.require(c, cookie);
    await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [user.id]);
    return this.store.require(c, cookie);
  }
  @Get() list(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      return inbox(c, user.id);
    });
  }
  private mutate(
    action: 'check' | 'acknowledge',
    connectionId: string | null,
    body: unknown,
    origin: string | undefined,
    cookie: string | undefined,
  ) {
    this.store.origin(origin);
    const input =
      action === 'check'
        ? parse(CheckConnectionsSchema, body)
        : parse(AcknowledgeConnectionSchema, body);
    if (connectionId) parse(z.uuid(), connectionId);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ action, connectionId, input }))
      .digest('hex');
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      await c.query(
        "DELETE FROM app_connection_review_requests WHERE user_id=$1 AND created_at<=clock_timestamp()-interval '30 days'",
        [user.id],
      );
      const prior = await c.query(
        'SELECT fingerprint,payload FROM app_connection_review_requests WHERE user_id=$1 AND request_id=$2',
        [user.id, input.requestId],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Request ID was already used for a different operation.',
          );
        return ConnectionReviewReceiptSchema.parse(prior.rows[0].payload);
      }
      const count = await c.query(
        'SELECT count(*)::integer AS count FROM app_connection_review_requests WHERE user_id=$1',
        [user.id],
      );
      if (count.rows[0].count >= 1000)
        throw new BadRequestException(
          'Review request limit reached. Retry after older30-day receipts expire.',
        );
      let current = await inbox(c, user.id);
      const now = new Date().toISOString();
      let receipt;
      if (action === 'check') {
        const heads = await c.query(
          'SELECT r.payload FROM app_research_connections h JOIN app_research_connection_revisions r ON r.connection_id=h.id AND r.version=h.version WHERE h.user_id=$1 AND (NOT h.removed OR h.id=ANY($2::uuid[])) ORDER BY h.id LIMIT 401',
          [
            user.id,
            current.notices
              .filter((n) => n.status !== 'resolved')
              .map((n) => n.connectionId),
          ],
        );
        if (heads.rows.length > 400)
          throw new BadRequestException(
            'Too many current notices to evaluate safely.',
          );
        const revisions = heads.rows.map((r) =>
          ResearchConnectionRevisionSchema.parse(r.payload),
        );
        const ids = [
          ...new Set(
            revisions.filter((r) => !r.removed).map((r) => r.source.itemId),
          ),
        ].sort();
        if (ids.length)
          await c.query(
            'SELECT id FROM discovery_items WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
            [ids],
          );
        await this.store.require(c, cookie);
        const sourceRows = await c.query(
          "SELECT v.data FROM discovery_items i JOIN LATERAL(SELECT data FROM discovery_versions WHERE item_id=i.id AND data->>'status'<>'draft' ORDER BY version DESC LIMIT 1)v ON true WHERE i.id=ANY($1::text[])",
          [ids],
        );
        const sources = sourceRows.rows.flatMap((r) => {
          const source = connectionSource(FeedItemSchema.parse(r.data));
          return source ? [source] : [];
        });
        const h = await c.query(
          'SELECT r.payload FROM app_holdings h JOIN app_holdings_revisions r ON r.user_id=h.user_id AND r.version=h.version WHERE h.user_id=$1',
          [user.id],
        );
        const g = await c.query(
          'SELECT r.payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL',
          [user.id],
        );
        const holdings = HoldingsSnapshotSchema.parse(
          h.rows[0]?.payload ?? {
            version: 0,
            holdings: [],
            totalCostMinor: '0',
            currency: 'INR',
            scale: 2,
            provenance: 'user-entered-unverified',
            updatedAt: null,
          },
        );
        const targets = connectionTargets(
          holdings,
          g.rows.map((r) => SavedGoalSchema.parse(r.payload)),
        );
        const result = evaluateConnections(
          current,
          revisions,
          revisions
            .filter((r) => !r.removed)
            .map((r) => connectionView(r, sources, targets)),
          input.requestId,
          new Date().toISOString(),
          null,
        );
        current = result.inbox;
        receipt = result.receipt;
      } else {
        const notice = current.notices.find(
          (n) => n.connectionId === connectionId,
        );
        if (!notice) throw new NotFoundException('Review notice not found.');
        if (
          !('expectedVersion' in input) ||
          notice.version !== input.expectedVersion
        )
          throw new ConflictException(
            'Notice changed. Reload before acknowledging.',
          );
        if (notice.status !== 'open')
          throw new ConflictException(
            'Only an open notice can be acknowledged.',
          );
        const updated = {
          ...notice,
          status: 'acknowledged' as const,
          version: notice.version + 1,
          acknowledgedAt: now,
        };
        current = {
          ...current,
          notices: current.notices.map((n) =>
            n.connectionId === connectionId ? updated : n,
          ),
        };
        receipt = ConnectionReviewReceiptSchema.parse({
          requestId: input.requestId,
          action,
          recordedAt: now,
          connectionId,
          noticeVersion: updated.version,
          evaluation: null,
        });
      }
      await c.query(
        'INSERT INTO app_connection_review_inboxes(user_id,payload) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET payload=EXCLUDED.payload',
        [user.id, current],
      );
      await c.query(
        'INSERT INTO app_connection_review_requests(user_id,request_id,fingerprint,payload) VALUES($1,$2,$3,$4)',
        [user.id, input.requestId, fingerprint, receipt],
      );
      return receipt;
    });
  }
  @Post('check') check(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.mutate('check', null, body, origin, cookie);
  }
  @Post(':id/acknowledge') acknowledge(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.mutate('acknowledge', id, body, origin, cookie);
  }
}
