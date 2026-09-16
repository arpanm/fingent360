import {
  decryptConnectionRows,
  sealConnection,
} from './private-connections.js';
import { decryptHoldingsRows } from './private-holdings.js';
import { decryptGoalRows } from './private-goals.js';
import type { PrivateDataKeys } from './private-data-crypto.js';
import { admitPublications } from './publication.js';
import { createHash } from 'node:crypto';
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
  Put,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import type pg from 'pg';
import {
  HoldingsSnapshotSchema,
  SavedGoalSchema,
  ResearchConnectionsSchema,
  ResearchConnectionRevisionSchema,
  ResearchConnectionWriteSchema,
  ResearchConnectionHistorySchema,
  ResearchConnectionQuerySchema,
  connectionSource,
  connectionTargets,
  connectionView,
  reviseConnection,
  ConnectionError,
  type ConnectionSourceReceipt,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';

async function targets(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
) {
  const holdings = await c.query(
    'SELECT r.user_id,r.version,r.payload,r.encrypted_payload FROM app_holdings h JOIN app_holdings_revisions r ON r.user_id=h.user_id AND r.version=h.version WHERE h.user_id=$1',
    [userId],
  );
  await decryptHoldingsRows(c, userId, holdings.rows, keys);
  const goals = await c.query(
    'SELECT r.goal_id,r.version,r.payload,r.encrypted_payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.created_at,g.id',
    [userId],
  );
  await decryptGoalRows(c, userId, goals.rows, keys);
  return connectionTargets(
    HoldingsSnapshotSchema.parse(
      holdings.rows[0]?.payload ?? {
        version: 0,
        holdings: [],
        totalCostMinor: '0',
        currency: 'INR',
        scale: 2,
        provenance: 'user-entered-unverified',
        updatedAt: null,
      },
    ),
    goals.rows.map((r) => SavedGoalSchema.parse(r.payload)),
  );
}
async function sources(
  c: pg.PoolClient,
  ids: string[],
): Promise<ConnectionSourceReceipt[]> {
  if (!ids.length) return [];
  const result = await admitPublications(c, ids);
  return result.flatMap((item) => {
    const source = connectionSource(item);
    return source ? [source] : [];
  });
}
function validId(id: string) {
  if (!z.uuid().safeParse(id).success)
    throw new BadRequestException('Invalid connection ID.');
}
export async function exportResearchConnections(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
) {
  const rows = await c.query(
    'SELECT * FROM app_research_connection_revisions WHERE user_id=$1 ORDER BY created_at,connection_id,version',
    [userId],
  );
  await decryptConnectionRows(
    c,
    'connection-revision',
    userId,
    rows.rows,
    keys,
  );
  return ResearchConnectionHistorySchema.parse({
    revisions: rows.rows.map((r) => r.payload),
  });
}
@Controller('account/research-connections')
export class ResearchConnectionsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() list(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    const parsed = ResearchConnectionQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException('Invalid connection query.');
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.store.require(c, cookie);
      const rows = await c.query(
        'SELECT r.* FROM app_research_connections h JOIN app_research_connection_revisions r ON r.connection_id=h.id AND r.version=h.version WHERE h.user_id=$1 AND NOT h.removed ORDER BY r.created_at DESC,h.id',
        [user.id],
      );
      await decryptConnectionRows(
        c,
        'connection-revision',
        user.id,
        rows.rows,
        this.store.privateDataKeys,
      );
      const revisions = rows.rows.map((r) =>
        ResearchConnectionRevisionSchema.parse(r.payload),
      );
      const choices = await targets(c, user.id, this.store.privateDataKeys);
      const current = await sources(c, [
        ...new Set([
          ...revisions.map((r) => r.source.itemId),
          ...(parsed.data.itemId ? [parsed.data.itemId] : []),
        ]),
      ]);
      await this.store.require(c, cookie);
      return ResearchConnectionsSchema.parse({
        connections: revisions.map((r) => connectionView(r, current, choices)),
        targets: choices,
        selectedSource:
          current.find((s) => s.itemId === parsed.data.itemId) ?? null,
        evaluatedAt: new Date().toISOString(),
        bundleGeneratedAt: null,
      });
    });
  }
  @Get('history') history(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.store.require(c, cookie);
      return exportResearchConnections(c, user.id, this.store.privateDataKeys);
    });
  }
  @Get(':id/history') detailHistory(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    validId(id);
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.store.require(c, cookie);
      const rows = await c.query(
        'SELECT * FROM app_research_connection_revisions WHERE user_id=$1 AND connection_id=$2 ORDER BY version DESC',
        [user.id, id],
      );
      if (!rows.rows.length)
        throw new NotFoundException('Connection not found.');
      await decryptConnectionRows(
        c,
        'connection-revision',
        user.id,
        rows.rows,
        this.store.privateDataKeys,
      );
      return ResearchConnectionHistorySchema.parse({
        revisions: rows.rows.map((r) => r.payload),
      });
    });
  }
  @Put(':id') save(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    validId(id);
    const parsed = ResearchConnectionWriteSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    const input = parsed.data;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ id, input }))
      .digest('hex');
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      // All financial/private mutations lock the account before their records.
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      // A recovery/reset or account deletion can revoke the admitted session
      // while this request waits for the account row. Recheck before any receipt
      // replay, private read or write, using this transaction's fresh snapshot.
      await this.store.require(c, cookie);
      const priorRequest = await c.query(
        'SELECT q.fingerprint,r.* FROM app_research_connection_requests q JOIN app_research_connection_revisions r ON r.connection_id=q.connection_id AND r.version=q.version WHERE q.user_id=$1 AND q.request_id=$2',
        [user.id, input.requestId],
      );
      if (priorRequest.rows[0]) {
        if (priorRequest.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'This request ID was already used for different changes. Start a new review.',
          );
        await decryptConnectionRows(
          c,
          'connection-revision',
          user.id,
          priorRequest.rows,
          this.store.privateDataKeys,
        );
        return ResearchConnectionRevisionSchema.parse(
          priorRequest.rows[0].payload,
        );
      }
      const head = await c.query(
        'SELECT r.* FROM app_research_connections h JOIN app_research_connection_revisions r ON r.connection_id=h.id AND r.version=h.version WHERE h.id=$1 FOR UPDATE OF h',
        [id],
      );
      if (head.rows[0] && head.rows[0].user_id !== user.id)
        throw new NotFoundException('Connection not found.');
      await decryptConnectionRows(
        c,
        'connection-revision',
        user.id,
        head.rows,
        this.store.privateDataKeys,
      );
      const previous = head.rows[0]
        ? ResearchConnectionRevisionSchema.parse(head.rows[0].payload)
        : null;
      if (input.action === 'create' && !previous) {
        const count = await c.query(
          'SELECT count(*)::integer AS count FROM app_research_connections WHERE user_id=$1 AND NOT removed',
          [user.id],
        );
        if (count.rows[0].count >= 200)
          throw new BadRequestException(
            'Keep at most 200 active connections. Remove one before adding another.',
          );
      }
      const sourceId =
        input.action === 'create' || input.action === 'reaffirm'
          ? input.source.itemId
          : previous?.source.itemId;
      const currentSources = await sources(c, sourceId ? [sourceId] : []);
      // Publication locking can also wait past natural session expiry.
      // AccountStore.find must use clock_timestamp (AUTH-WAIT integration).
      await this.store.require(c, cookie);
      let revision;
      try {
        revision = reviseConnection(
          id,
          input,
          previous,
          currentSources,
          await targets(c, user.id, this.store.privateDataKeys),
          new Date().toISOString(),
        );
      } catch (e) {
        if (e instanceof ConnectionError)
          throw new HttpException(e.message, e.status);
        throw e;
      }
      if (!previous)
        await c.query(
          'INSERT INTO app_research_connections(id,user_id,version,removed) VALUES($1,$2,$3,$4)',
          [id, user.id, revision.version, revision.removed],
        );
      else
        await c.query(
          'UPDATE app_research_connections SET version=$2,removed=$3 WHERE id=$1',
          [id, revision.version, revision.removed],
        );
      const encrypted = sealConnection(
        'connection-revision',
        user.id,
        `${id}:${revision.version}`,
        revision,
        this.store.privateDataKeys,
      );
      await c.query(
        'INSERT INTO app_research_connection_revisions(connection_id,user_id,version,encrypted_payload,content_hash,target_kind) VALUES($1,$2,$3,$4,$5,$6)',
        [
          id,
          user.id,
          revision.version,
          encrypted.envelope,
          encrypted.hash,
          revision.target.binding.kind,
        ],
      );
      await c.query(
        'INSERT INTO app_research_connection_requests(user_id,request_id,connection_id,version,fingerprint) VALUES($1,$2,$3,$4,$5)',
        [user.id, input.requestId, id, revision.version, fingerprint],
      );
      return revision;
    });
  }
}
