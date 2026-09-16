import { openGoalRecord, sealGoalRecord } from './private-goal-records.js';
import type { PrivateDataKeys } from './private-data-crypto.js';
import { decryptGoalRows, encryptGoal } from './private-goals.js';
import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Put,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  GoalComparisonInputSchema,
  GoalComparisonSchema,
  GoalAdoptionInputSchema,
  GoalAdoptionSchema,
  GoalComparisonsSchema,
  GoalScenarioExportSchema,
  SavedGoalSchema,
  compareGoal,
  adoptGoal,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((i) => i.message).join('; '),
    );
  return result.data;
}
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function exportGoalScenarios(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
) {
  const comparisons = await c.query(
    'SELECT id,payload,encrypted_payload,content_hash FROM app_goal_comparisons WHERE user_id=$1 ORDER BY created_at,id',
    [userId],
  );
  const adoptions = await c.query(
    'SELECT request_id,payload,encrypted_payload,content_hash FROM app_goal_adoptions WHERE user_id=$1 ORDER BY created_at,request_id',
    [userId],
  );
  for (const row of comparisons.rows)
    await openGoalRecord(c, 'goal-comparison', userId, row.id, row, keys);
  for (const row of adoptions.rows)
    await openGoalRecord(c, 'goal-adoption', userId, row.request_id, row, keys);
  return GoalScenarioExportSchema.parse({
    comparisons: comparisons.rows.map((r) => r.payload),
    adoptions: adoptions.rows.map((r) => r.payload),
  });
}
@Controller('account/goal-comparisons')
export class GoalScenariosController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  private async owner(c: pg.PoolClient, cookie: string | undefined) {
    const account = await this.store.require(c, cookie);
    await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
      account.id,
    ]);
    return this.store.require(c, cookie);
  }
  @Get() list(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const values = await exportGoalScenarios(
        c,
        user.id,
        this.store.privateDataKeys,
      );
      const goals = await c.query(
        'SELECT r.goal_id,r.version,r.payload,r.encrypted_payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.created_at,g.id',
        [user.id],
      );
      await decryptGoalRows(c, user.id, goals.rows, this.store.privateDataKeys);
      return GoalComparisonsSchema.parse({
        ...values,
        goals: goals.rows.map((r) => r.payload),
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
    parse(z.uuid(), id);
    const input = parse(GoalComparisonInputSchema, body),
      hash = fingerprint(input);
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const existing = await c.query(
        'SELECT user_id,fingerprint,payload,encrypted_payload,content_hash FROM app_goal_comparisons WHERE id=$1',
        [id],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].user_id !== user.id)
          throw new NotFoundException('Comparison not found.');
        if (existing.rows[0].fingerprint !== hash)
          throw new ConflictException(
            'Comparison ID already used. Start a new comparison.',
          );
        return GoalComparisonSchema.parse(
          await openGoalRecord(
            c,
            'goal-comparison',
            user.id,
            id,
            existing.rows[0],
            this.store.privateDataKeys,
          ),
        );
      }
      const count = await c.query(
        'SELECT count(*)::integer AS count FROM app_goal_comparisons WHERE user_id=$1',
        [user.id],
      );
      if (count.rows[0].count >= 100)
        throw new BadRequestException(
          'Keep at most 100 saved comparisons. Export your records; no comparisons were removed.',
        );
      const goals = await c.query(
        'SELECT r.goal_id,r.version,r.payload,r.encrypted_payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.id=$1 AND g.user_id=$2 AND g.deleted_at IS NULL',
        [input.goalId, user.id],
      );
      await decryptGoalRows(c, user.id, goals.rows, this.store.privateDataKeys);
      if (!goals.rows[0]) throw new NotFoundException('Goal not found.');
      let saved;
      try {
        saved = compareGoal(
          id,
          SavedGoalSchema.parse(goals.rows[0].payload),
          input,
          new Date().toISOString(),
        );
      } catch (e) {
        throw new ConflictException(
          e instanceof Error ? e.message : 'Goal changed.',
        );
      }
      const encrypted = sealGoalRecord(
        'goal-comparison',
        user.id,
        id,
        saved,
        this.store.privateDataKeys,
      );
      await c.query(
        'INSERT INTO app_goal_comparisons(id,user_id,fingerprint,encrypted_payload,content_hash) VALUES($1,$2,$3,$4,$5)',
        [id, user.id, hash, encrypted.envelope, encrypted.hash],
      );
      return saved;
    });
  }
  @Put(':id/adopt') adopt(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    parse(z.uuid(), id);
    const input = parse(GoalAdoptionInputSchema, body),
      hash = fingerprint({ id, input });
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const replay = await c.query(
        'SELECT fingerprint,payload,encrypted_payload,content_hash FROM app_goal_adoptions WHERE user_id=$1 AND request_id=$2',
        [user.id, input.requestId],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].fingerprint !== hash)
          throw new ConflictException(
            'Request ID already used for a different adoption.',
          );
        return GoalAdoptionSchema.parse(
          await openGoalRecord(
            c,
            'goal-adoption',
            user.id,
            input.requestId,
            replay.rows[0],
            this.store.privateDataKeys,
          ),
        );
      }
      const found = await c.query(
        'SELECT id,payload,encrypted_payload,content_hash FROM app_goal_comparisons WHERE id=$1 AND user_id=$2',
        [id, user.id],
      );
      if (!found.rows[0]) throw new NotFoundException('Comparison not found.');
      const comparison = GoalComparisonSchema.parse(
        await openGoalRecord(
          c,
          'goal-comparison',
          user.id,
          id,
          found.rows[0],
          this.store.privateDataKeys,
        ),
      );
      const goal = await c.query(
        'SELECT r.goal_id,r.version,r.payload,r.encrypted_payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.id=$1 AND g.user_id=$2 AND g.deleted_at IS NULL FOR UPDATE OF g',
        [comparison.baseline.id, user.id],
      );
      await decryptGoalRows(c, user.id, goal.rows, this.store.privateDataKeys);
      await this.store.require(c, cookie);
      if (!goal.rows[0])
        throw new NotFoundException(
          'Goal was removed. This comparison remains historical.',
        );
      let receipt;
      try {
        receipt = adoptGoal(
          comparison,
          SavedGoalSchema.parse(goal.rows[0].payload),
          input,
          new Date().toISOString(),
        );
      } catch (e) {
        throw new ConflictException(
          e instanceof Error ? e.message : 'Goal changed.',
        );
      }
      await c.query(
        'INSERT INTO app_goal_revisions(goal_id,version,encrypted_payload) VALUES($1,$2,$3)',
        [
          receipt.goal.id,
          receipt.goal.version,
          encryptGoal(user.id, receipt.goal, this.store.privateDataKeys),
        ],
      );
      await c.query(
        'UPDATE app_goals SET version=$2,updated_at=$3 WHERE id=$1',
        [receipt.goal.id, receipt.goal.version, receipt.adoptedAt],
      );
      const encrypted = sealGoalRecord(
        'goal-adoption',
        user.id,
        input.requestId,
        receipt,
        this.store.privateDataKeys,
      );
      await c.query(
        'INSERT INTO app_goal_adoptions(user_id,request_id,comparison_id,fingerprint,encrypted_payload,content_hash) VALUES($1,$2,$3,$4,$5,$6)',
        [
          user.id,
          input.requestId,
          id,
          hash,
          encrypted.envelope,
          encrypted.hash,
        ],
      );
      return receipt;
    });
  }
}
