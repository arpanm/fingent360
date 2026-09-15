import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  GoneException,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  ActionCentreInputSchema,
  ActionCentreReceiptSchema,
  ActionCentreListSchema,
  ActionCentreChoicesSchema,
  HoldingsSnapshotSchema,
  SavedGoalSchema,
  ImpactTraceReceiptSchema,
  impactReviewReasons,
  equityTraceWarnings,
  actionPriceBindingCurrent,
  calculateActionCentre,
  type ActionCentreInput,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { EVENT_STORE, EventStore } from './events.js';
import { equityCompanyForTrace } from './equity-coverage.js';
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const value = schema.safeParse(raw);
  if (!value.success)
    throw new BadRequestException('Review valid explicit comparison inputs.');
  return value.data;
}
export async function exportActionCentre(c: pg.PoolClient, userId: string) {
  const rows = await c.query(
    'SELECT payload FROM app_action_centre WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 100',
    [userId],
  );
  return {
    assessments: rows.rows.map((row) =>
      ActionCentreReceiptSchema.parse(row.payload),
    ),
  };
}
@Controller('account/action-centre')
export class ActionCentreController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(EVENT_STORE) private readonly events: EventStore,
  ) {}
  private async owner(c: pg.PoolClient, cookie?: string) {
    const user = await this.store.require(c, cookie);
    await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [user.id]);
    return this.store.require(c, cookie);
  }
  private async finances(c: pg.PoolClient, userId: string) {
    const holdings = await c.query(
      'SELECT r.payload FROM app_holdings h JOIN app_holdings_revisions r ON r.user_id=h.user_id AND r.version=h.version WHERE h.user_id=$1',
      [userId],
    );
    const goals = await c.query(
      'SELECT r.payload FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id AND r.version=g.version WHERE g.user_id=$1 AND g.deleted_at IS NULL ORDER BY g.id',
      [userId],
    );
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
    };
  }
  private async equity(c: pg.PoolClient, isin: string) {
    await c.query(
      'SELECT e.id FROM equity_editions e WHERE EXISTS(SELECT 1 FROM equity_observations o WHERE o.edition_id=e.id AND o.isin=$1) ORDER BY e.id FOR SHARE',
      [isin],
    );
    try {
      return await equityCompanyForTrace(c, isin);
    } catch (e) {
      if (e instanceof NotFoundException) return null;
      throw e;
    }
  }
  private async traceContext(
    c: pg.PoolClient,
    userId: string,
    input: ActionCentreInput,
    finances: Awaited<ReturnType<ActionCentreController['finances']>>,
  ) {
    if (!input.traceId) return { trace: null, warnings: [] as string[] };
    const rows = await c.query(
      'SELECT payload FROM app_impact_traces WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL',
      [userId, input.traceId],
    );
    if (!rows.rows[0])
      throw new ConflictException(
        'Selected private trace is unavailable. Choose current context.',
      );
    const trace = ImpactTraceReceiptSchema.parse(rows.rows[0].payload);
    if (trace.input.isin !== input.isin || trace.input.goalId !== input.goalId)
      throw new BadRequestException(
        'Trace must refer to the selected holding and goal.',
      );
    const heads = await c.query(
      'SELECT * FROM reviewed_events WHERE id=$1 FOR SHARE',
      [trace.input.eventId],
    );
    const lineage = await c.query(
      "SELECT 1 FROM event_lineage_members WHERE event_id=$1 AND direction='input'",
      [trace.input.eventId],
    );
    const current =
      heads.rows[0] && !lineage.rows.length
        ? await this.events.publicOne(c, heads.rows[0])
        : null;
    const equity = await this.equity(c, input.isin);
    return {
      trace,
      warnings: impactReviewReasons(
        trace,
        current,
        finances.holdings,
        finances.goals,
        new Date().toISOString(),
        equity,
      ),
    };
  }
  @Get('choices') choices(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const finances = await this.finances(c, user.id);
      const traces = await c.query(
        'SELECT payload FROM app_impact_traces WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC,id LIMIT 100',
        [user.id],
      );
      await this.store.require(c, cookie);
      return ActionCentreChoicesSchema.parse({
        ...finances,
        traces: traces.rows.map((row) =>
          ImpactTraceReceiptSchema.parse(row.payload),
        ),
        bundleGeneratedAt: null,
      });
    });
  }
  @Get() list(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie),
        saved = await exportActionCentre(c, user.id),
        finances = await this.finances(c, user.id),
        assessments = [];
      for (const receipt of saved.assessments) {
        const reasons: string[] = [];
        if (finances.holdings.version !== receipt.input.holdingsVersion)
          reasons.push('Your holdings changed. Review a new comparison.');
        if (
          !finances.goals.some(
            (goal) =>
              goal.id === receipt.goal.id &&
              goal.version === receipt.goal.version,
          )
        )
          reasons.push('Your goal changed or was removed.');
        let context;
        try {
          context = await this.traceContext(
            c,
            user.id,
            receipt.input,
            finances,
          );
        } catch (e) {
          if (e instanceof ConflictException)
            reasons.push('Linked trace was removed.');
          else throw e;
        }
        const equity = await this.equity(c, receipt.input.isin);
        if (!actionPriceBindingCurrent(receipt.input, equity))
          reasons.push(
            'The bound published price is withdrawn or unavailable.',
          );
        if (
          Date.now() - Date.parse(receipt.input.price.asOf + 'T00:00:00Z') >
          7 * 86400000
        )
          reasons.push('Price is beyond the seven-day review window.');
        reasons.push(
          ...(context?.warnings ?? []),
          ...equityTraceWarnings(equity),
        );
        assessments.push({ receipt, reviewReasons: [...new Set(reasons)] });
      }
      await this.store.require(c, cookie);
      return ActionCentreListSchema.parse({ assessments });
    });
  }
  @Put(':id') save(
    @Param('id') raw: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const id = parse(z.uuid(), raw).toLowerCase(),
      input = parse(ActionCentreInputSchema, body),
      fingerprint = createHash('sha256')
        .update(JSON.stringify(input))
        .digest('hex');
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie),
        previous = await c.query(
          'SELECT fingerprint,payload,deleted_at FROM app_action_centre WHERE user_id=$1 AND id=$2',
          [user.id, id],
        );
      if (previous.rows[0]) {
        if (previous.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Receipt ID already used for different assumptions.',
          );
        if (previous.rows[0].deleted_at)
          throw new GoneException('Comparison deleted. Start a new review.');
        return ActionCentreReceiptSchema.parse(previous.rows[0].payload);
      }
      const count = await c.query(
        'SELECT count(*)::integer AS n FROM app_action_centre WHERE user_id=$1 AND deleted_at IS NULL',
        [user.id],
      );
      if (count.rows[0].n >= 100)
        throw new ConflictException(
          'Remove a comparison before exceeding 100 saved receipts.',
        );
      const finances = await this.finances(c, user.id),
        goal = finances.goals.find((item) => item.id === input.goalId);
      if (!goal)
        throw new ConflictException(
          'Goal unavailable. Review your current goals.',
        );
      const context = await this.traceContext(c, user.id, input, finances),
        equity = await this.equity(c, input.isin);
      if (!actionPriceBindingCurrent(input, equity))
        throw new ConflictException(
          'Published price receipt changed or was withdrawn. Review a current price.',
        );
      const now = new Date().toISOString();
      let result;
      try {
        result = calculateActionCentre(input, finances.holdings, goal, now, [
          ...context.warnings,
          ...equityTraceWarnings(equity),
        ]);
      } catch (e) {
        throw new ConflictException(
          e instanceof Error
            ? e.message
            : 'Comparison changed. Review current inputs.',
        );
      }
      const receipt = ActionCentreReceiptSchema.parse({
        id,
        createdAt: now,
        policy: 'proposed-disposal-education-v1',
        input,
        holdings: finances.holdings,
        goal,
        trace: context.trace,
        equity,
        contextWarnings: [...context.warnings, ...equityTraceWarnings(equity)],
        result,
      });
      await this.store.require(c, cookie);
      await c.query(
        'INSERT INTO app_action_centre(user_id,id,fingerprint,payload) VALUES($1,$2,$3,$4)',
        [user.id, id, fingerprint, receipt],
      );
      return receipt;
    });
  }
  @Delete(':id') remove(
    @Param('id') raw: string,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const id = parse(z.uuid(), raw);
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const result = await c.query(
        'UPDATE app_action_centre SET payload=NULL,deleted_at=clock_timestamp() WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id',
        [user.id, id],
      );
      if (!result.rows.length) {
        const old = await c.query(
          'SELECT id FROM app_action_centre WHERE user_id=$1 AND id=$2',
          [user.id, id],
        );
        if (!old.rows.length)
          throw new NotFoundException('Comparison not found.');
      }
      return { deleted: true };
    });
  }
}
