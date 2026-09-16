import {
  decryptAllocationRows,
  encryptAllocation,
} from './private-allocations.js';
import { decryptHoldingsRows } from './private-holdings.js';
import { decryptGoalRows } from './private-goals.js';
import type { PrivateDataKeys } from './private-data-crypto.js';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Put,
} from '@nestjs/common';
import type pg from 'pg';
import {
  AllocationWriteSchema,
  AllocationSnapshotSchema,
  AllocationHistorySchema,
  HoldingsSnapshotSchema,
  SavedGoalSchema,
  allocationState,
  emptyAllocation,
  makeAllocation,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
async function context(
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
  const saved = await c.query(
    'SELECT r.user_id,r.version,r.payload,r.encrypted_payload FROM app_goal_allocations a JOIN app_goal_allocation_revisions r ON r.user_id=a.user_id AND r.version=a.version WHERE a.user_id=$1',
    [userId],
  );
  await decryptAllocationRows(c, userId, saved.rows, keys);
  return {
    holdings: HoldingsSnapshotSchema.parse(
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
    goals: goals.rows.map((row) => SavedGoalSchema.parse(row.payload)),
    snapshot: saved.rows[0]
      ? AllocationSnapshotSchema.parse(saved.rows[0].payload)
      : emptyAllocation(),
  };
}
@Controller('account/allocations')
export class AllocationsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() current(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR SHARE', [
        user.id,
      ]);
      await this.store.require(c, cookie);
      const data = await context(c, user.id, this.store.privateDataKeys);
      return allocationState(data.snapshot, data.holdings, data.goals);
    });
  }
  @Get('history') history(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      const rows = await c.query(
        'SELECT user_id,version,payload,encrypted_payload FROM app_goal_allocation_revisions WHERE user_id=$1 ORDER BY version DESC',
        [user.id],
      );
      await decryptAllocationRows(
        c,
        user.id,
        rows.rows,
        this.store.privateDataKeys,
      );
      return AllocationHistorySchema.parse({
        revisions: rows.rows.map((row) => row.payload),
      });
    });
  }
  @Put() save(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const parsed = AllocationWriteSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues.map((i) => i.message).join('; '),
      );
    const input = parsed.data;
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      await this.store.require(c, cookie);
      const data = await context(c, user.id, this.store.privateDataKeys);
      if (
        data.snapshot.version !== input.expectedVersion ||
        data.holdings.version !== input.expectedHoldingsVersion
      )
        throw new ConflictException(
          'Your allocation plan or holdings changed. Reload and review before saving.',
        );
      if (
        input.rows.some((row) => {
          const goal = data.goals.find((g) => g.id === row.goalId);
          return goal && goal.version !== row.goalVersion;
        })
      )
        throw new ConflictException(
          'A goal changed. Reload and review before saving.',
        );
      let saved;
      try {
        saved = makeAllocation(
          input,
          data.holdings,
          data.goals,
          new Date().toISOString(),
        );
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid allocation.',
        );
      }
      await c.query(
        'INSERT INTO app_goal_allocations(user_id,version) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET version=excluded.version',
        [user.id, saved.version],
      );
      await c.query(
        'INSERT INTO app_goal_allocation_revisions(user_id,version,encrypted_payload) VALUES($1,$2,$3)',
        [
          user.id,
          saved.version,
          encryptAllocation(user.id, saved, this.store.privateDataKeys),
        ],
      );
      return allocationState(saved, data.holdings, data.goals);
    });
  }
}
