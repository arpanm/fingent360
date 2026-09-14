import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Put,
  Delete,
  Headers,
  Inject,
  Param,
  BadRequestException,
  ConflictException,
  NotFoundException,
  GoneException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  GoalFeasibilitiesSchema,
  GoalFeasibilityInputSchema,
  GoalFeasibilitySchema,
  GoalFeasibilityExportSchema,
  SavedGoalSchema,
  calculateGoalFeasibility,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException('Invalid downside assessment input.');
  return parsed.data;
}
export async function exportGoalFeasibility(c: pg.PoolClient, userId: string) {
  const rows = await c.query(
    'SELECT payload FROM app_goal_feasibility WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 100',
    [userId],
  );
  const deleted = await c.query(
    'SELECT count(*)::integer AS count FROM app_goal_feasibility WHERE user_id=$1 AND deleted_at IS NOT NULL',
    [userId],
  );
  return GoalFeasibilityExportSchema.parse({
    assessments: rows.rows.map((row) => row.payload),
    deletedRequestCount: deleted.rows[0].count,
  });
}
@Controller('account/goal-feasibility')
export class GoalFeasibilityController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}

  private async owner(c: pg.PoolClient, cookie: string | undefined) {
    const user = await this.store.require(c, cookie);
    await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [user.id]);
    return this.store.require(c, cookie);
  }

  @Get()
  list(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const rows = await c.query(
        'SELECT payload FROM app_goal_feasibility WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC,id LIMIT 100',
        [user.id],
      );
      await this.store.require(c, cookie);
      return GoalFeasibilitiesSchema.parse({
        assessments: rows.rows.map((row) => row.payload),
      });
    });
  }

  @Put(':id')
  save(
    @Param('id') raw: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const id = parse(z.uuid(), raw).toLowerCase();
    const input = parse(GoalFeasibilityInputSchema, body);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const old = await c.query(
        'SELECT fingerprint,payload,deleted_at FROM app_goal_feasibility WHERE user_id=$1 AND id=$2',
        [user.id, id],
      );
      if (old.rows[0]) {
        await this.store.require(c, cookie);
        if (old.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Request ID already used for different assumptions.',
          );
        if (old.rows[0].deleted_at)
          throw new GoneException(
            'This assessment was deleted. Start a new assessment.',
          );
        return GoalFeasibilitySchema.parse(old.rows[0].payload);
      }
      const goals = await c.query(
        'SELECT r.payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.id=$2 AND g.deleted_at IS NULL FOR SHARE OF g',
        [user.id, input.goalId],
      );
      await this.store.require(c, cookie);
      if (!goals.rows[0])
        throw new NotFoundException('Saved goal unavailable.');
      const goal = SavedGoalSchema.parse(goals.rows[0].payload);
      if (goal.version !== input.expectedVersion)
        throw new ConflictException(
          'Goal changed. Reload goals and review a new assessment.',
        );
      const count = await c.query(
        'SELECT count(*)::integer AS n FROM app_goal_feasibility WHERE user_id=$1 AND deleted_at IS NULL',
        [user.id],
      );
      if (count.rows[0].n >= 100)
        throw new ConflictException(
          '100 assessments retained. Remove a saved assessment to make room.',
        );
      let result;
      try {
        result = calculateGoalFeasibility(goal, input);
      } catch {
        throw new BadRequestException(
          'Interruption cannot exceed the goal horizon.',
        );
      }
      const value = GoalFeasibilitySchema.parse({
        id,
        createdAt: new Date().toISOString(),
        policy: 'downside-capacity-v1',
        currency: 'INR',
        scale: 2,
        goal,
        input,
        result,
      });
      await this.store.require(c, cookie);
      await c.query(
        'INSERT INTO app_goal_feasibility(user_id,id,fingerprint,payload) VALUES($1,$2,$3,$4)',
        [user.id, id, fingerprint, value],
      );
      return value;
    });
  }

  @Delete(':id')
  remove(
    @Param('id') raw: string,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const id = parse(z.uuid(), raw).toLowerCase();
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const old = await c.query(
        'SELECT deleted_at FROM app_goal_feasibility WHERE user_id=$1 AND id=$2 FOR UPDATE',
        [user.id, id],
      );
      await this.store.require(c, cookie);
      if (!old.rows[0]) throw new NotFoundException('Assessment unavailable.');
      if (!old.rows[0].deleted_at)
        await c.query(
          'UPDATE app_goal_feasibility SET payload=NULL,deleted_at=clock_timestamp() WHERE user_id=$1 AND id=$2',
          [user.id, id],
        );
      return { ok: true };
    });
  }
}
