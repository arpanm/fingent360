import { decryptHoldingsRows } from './private-holdings.js';
import { decryptGoalRows } from './private-goals.js';
import { Controller, Get, Headers, Inject } from '@nestjs/common';
import { OverviewSchema } from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';

@Controller('account/overview')
export class OverviewController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}

  @Get() get(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const user = await this.store.require(client, cookie);
      const goals = await client.query(
        'SELECT r.goal_id,r.version,r.payload,r.encrypted_payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.created_at,g.id',
        [user.id],
      );
      await decryptGoalRows(
        client,
        user.id,
        goals.rows,
        this.store.privateDataKeys,
      );
      const holdings = await client.query(
        'SELECT r.user_id,r.version,r.payload,r.encrypted_payload FROM app_holdings h JOIN app_holdings_revisions r ON r.user_id=h.user_id AND r.version=h.version WHERE h.user_id=$1',
        [user.id],
      );
      await decryptHoldingsRows(
        client,
        user.id,
        holdings.rows,
        this.store.privateDataKeys,
      );
      const watchlist = await client.query(
        'SELECT indicators FROM app_watchlists WHERE user_id=$1',
        [user.id],
      );
      return OverviewSchema.parse({
        user: {
          id: user.id,
          username: user.username,
          consentVersion: user.consent_version,
          createdAt: user.created_at.toISOString(),
        },
        goals: goals.rows.map((row) => row.payload),
        holdings: holdings.rows[0]?.payload ?? {
          version: 0,
          holdings: [],
          totalCostMinor: '0',
          currency: 'INR',
          scale: 2,
          provenance: 'user-entered-unverified',
          updatedAt: null,
        },
        watchlist: { indicators: watchlist.rows[0]?.indicators ?? [] },
        inbox: await this.store.inboxFor(client, user.id),
        evaluatedAt: new Date().toISOString(),
      });
    });
  }
}
