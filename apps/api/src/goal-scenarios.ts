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
export async function exportGoalScenarios(c: pg.PoolClient, userId: string) {
  const comparisons = await c.query(
    'SELECT payload FROM app_goal_comparisons WHERE user_id=$1 ORDER BY created_at,id',
    [userId],
  );
  const adoptions = await c.query(
    'SELECT payload FROM app_goal_adoptions WHERE user_id=$1 ORDER BY created_at,request_id',
    [userId],
  );
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
      const values = await exportGoalScenarios(c, user.id);
      const goals = await c.query(
        'SELECT r.payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.created_at,g.id',
        [user.id],
      );
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
        'SELECT user_id,fingerprint,payload FROM app_goal_comparisons WHERE id=$1',
        [id],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].user_id !== user.id)
          throw new NotFoundException('Comparison not found.');
        if (existing.rows[0].fingerprint !== hash)
          throw new ConflictException(
            'Comparison ID already used. Start a new comparison.',
          );
        return GoalComparisonSchema.parse(existing.rows[0].payload);
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
        'SELECT r.payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.id=$1 AND g.user_id=$2 AND g.deleted_at IS NULL',
        [input.goalId, user.id],
      );
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
      await c.query(
        'INSERT INTO app_goal_comparisons(id,user_id,fingerprint,payload) VALUES($1,$2,$3,$4)',
        [id, user.id, hash, saved],
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
        'SELECT fingerprint,payload FROM app_goal_adoptions WHERE user_id=$1 AND request_id=$2',
        [user.id, input.requestId],
      );
      if (replay.rows[0]) {
        if (replay.rows[0].fingerprint !== hash)
          throw new ConflictException(
            'Request ID already used for a different adoption.',
          );
        return GoalAdoptionSchema.parse(replay.rows[0].payload);
      }
      const found = await c.query(
        'SELECT payload FROM app_goal_comparisons WHERE id=$1 AND user_id=$2',
        [id, user.id],
      );
      if (!found.rows[0]) throw new NotFoundException('Comparison not found.');
      const comparison = GoalComparisonSchema.parse(found.rows[0].payload);
      const goal = await c.query(
        'SELECT r.payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.id=$1 AND g.user_id=$2 AND g.deleted_at IS NULL FOR UPDATE OF g',
        [comparison.baseline.id, user.id],
      );
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
        'INSERT INTO app_goal_revisions(goal_id,version,payload) VALUES($1,$2,$3)',
        [receipt.goal.id, receipt.goal.version, receipt.goal],
      );
      await c.query(
        'UPDATE app_goals SET version=$2,updated_at=$3 WHERE id=$1',
        [receipt.goal.id, receipt.goal.version, receipt.adoptedAt],
      );
      await c.query(
        'INSERT INTO app_goal_adoptions(user_id,request_id,comparison_id,fingerprint,payload) VALUES($1,$2,$3,$4,$5)',
        [user.id, input.requestId, id, hash, receipt],
      );
      return receipt;
    });
  }
}
