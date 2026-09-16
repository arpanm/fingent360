import { decryptGoalRows, encryptGoal } from './private-goals.js';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { z } from 'zod';
import {
  SavedGoalInputSchema,
  SavedGoalSchema,
  SavedGoalsSchema,
  SavedGoalUpdateSchema,
  SavedGoalDeleteSchema,
  SavedGoalHistorySchema,
  goalProjection,
  type SavedGoalInput,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((v) => v.message).join('; '),
    );
  return result.data;
}
function identifier(value: string) {
  return parse(z.uuid(), value);
}
@Controller('account/goals')
export class GoalsController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() list(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const account = await this.store.require(c, cookie);
      const result = await c.query(
        'SELECT r.goal_id,r.version,r.payload,r.encrypted_payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.created_at,g.id',
        [account.id],
      );
      await decryptGoalRows(
        c,
        account.id,
        result.rows,
        this.store.privateDataKeys,
      );
      return SavedGoalsSchema.parse({
        goals: result.rows.map((r) => r.payload),
      });
    });
  }
  @Post() create(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const input = parse(SavedGoalInputSchema, body);
    return this.store.transaction(async (c) => {
      const account = await this.store.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        account.id,
      ]);
      await this.store.require(c, cookie);
      const count = await c.query(
        'SELECT count(*)::integer AS count FROM app_goals WHERE user_id=$1 AND deleted_at IS NULL',
        [account.id],
      );
      if (count.rows[0].count >= 100)
        throw new BadRequestException('Keep at most 100 active goals.');
      const id = randomUUID();
      const now = new Date().toISOString();
      const result = SavedGoalSchema.parse({
        ...input,
        ...goalProjection(input),
        id,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      await c.query(
        'INSERT INTO app_goals(id,user_id,created_at,updated_at) VALUES($1,$2,$3,$3)',
        [id, account.id, now],
      );
      await c.query(
        'INSERT INTO app_goal_revisions(goal_id,version,encrypted_payload) VALUES($1,1,$2)',
        [id, encryptGoal(account.id, result, this.store.privateDataKeys)],
      );
      return result;
    });
  }
  @Get(':id/history') history(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    identifier(id);
    return this.store.transaction(async (c) => {
      const account = await this.store.require(c, cookie);
      const found = await c.query(
        'SELECT id FROM app_goals WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
        [id, account.id],
      );
      if (!found.rowCount) throw new NotFoundException('Goal not found.');
      const rows = await c.query(
        'SELECT goal_id,version,payload,encrypted_payload FROM app_goal_revisions WHERE goal_id=$1 ORDER BY version DESC',
        [id],
      );
      await decryptGoalRows(
        c,
        account.id,
        rows.rows,
        this.store.privateDataKeys,
      );
      return SavedGoalHistorySchema.parse({
        revisions: rows.rows.map((r) => r.payload),
      });
    });
  }
  private change(
    id: string,
    version: number,
    cookie: string | undefined,
    input?: SavedGoalInput,
  ) {
    identifier(id);
    return this.store.transaction(async (c) => {
      const account = await this.store.require(c, cookie);
      // Match holdings/allocation lock order so a plan cannot save against a
      // goal that is concurrently being revised or removed.
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        account.id,
      ]);
      await this.store.require(c, cookie);
      const rows = await c.query(
        'SELECT * FROM app_goals WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [id, account.id],
      );
      await this.store.require(c, cookie);
      const row = rows.rows[0];
      if (!row) throw new NotFoundException('Goal not found.');
      if (row.version !== version)
        throw new ConflictException(
          'Goal changed in another session. Reload goals before editing.',
        );
      if (!input) {
        await c.query('UPDATE app_goals SET deleted_at=now() WHERE id=$1', [
          id,
        ]);
        return { ok: true as const };
      }
      const now = new Date().toISOString();
      const result = SavedGoalSchema.parse({
        ...input,
        ...goalProjection(input),
        id,
        version: version + 1,
        createdAt: row.created_at.toISOString(),
        updatedAt: now,
      });
      await c.query(
        'INSERT INTO app_goal_revisions(goal_id,version,encrypted_payload) VALUES($1,$2,$3)',
        [
          id,
          version + 1,
          encryptGoal(account.id, result, this.store.privateDataKeys),
        ],
      );
      await c.query(
        'UPDATE app_goals SET version=$2,updated_at=$3 WHERE id=$1',
        [id, version + 1, now],
      );
      return result;
    });
  }
  @Put(':id') update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const input = parse(SavedGoalUpdateSchema, body);
    return this.change(id, input.expectedVersion, cookie, input.goal);
  }
  @Delete(':id') remove(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const input = parse(SavedGoalDeleteSchema, body);
    return this.change(id, input.expectedVersion, cookie);
  }
}
