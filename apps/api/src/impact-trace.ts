import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Put,
  Query,
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  ImpactTraceInputSchema,
  ImpactTraceReceiptSchema,
  ImpactTraceChoicesSchema,
  ImpactTraceListSchema,
  HoldingsSnapshotSchema,
  SavedGoalSchema,
  buildImpactTrace,
  impactReviewReasons,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { EVENT_STORE, EventStore } from './events.js';
import { equityCompanyForTrace } from './equity-coverage.js';
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new BadRequestException('Invalid impact trace request.');
  return result.data;
}
export async function exportImpactTraces(c: pg.PoolClient, userId: string) {
  const rows = await c.query(
    'SELECT payload FROM app_impact_traces WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at,id LIMIT 100',
    [userId],
  );
  return {
    traces: rows.rows.map((row) => ImpactTraceReceiptSchema.parse(row.payload)),
  };
}
@Controller('account/impact-traces')
export class ImpactTraceController {
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
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
  private async current(c: pg.PoolClient, id: string) {
    const head = await c.query(
      'SELECT * FROM reviewed_events WHERE id=$1 FOR SHARE',
      [id],
    );
    if (!head.rows[0]) return null;
    const superseded = await c.query(
      "SELECT 1 FROM event_lineage_members WHERE event_id=$1 AND direction='input'",
      [id],
    );
    if (superseded.rows.length) return null;
    return this.events.publicOne(c, head.rows[0]);
  }
  @Get('choices') choices(
    @Query() raw: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    const query = parse(z.strictObject({ after: z.uuid().optional() }), raw);
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const rows = await c.query(
        "SELECT id FROM reviewed_events WHERE status='published' AND ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 51",
        [query.after ?? null],
      );
      const events = [];
      for (const row of rows.rows.slice(0, 50)) {
        const current = await this.current(c, row.id);
        if (current?.status === 'published') events.push(current);
      }
      const finances = await this.finances(c, user.id);
      await this.store.require(c, cookie);
      return ImpactTraceChoicesSchema.parse({
        events,
        next: rows.rows.length > 50 ? rows.rows[49].id : null,
        ...finances,
        bundleGeneratedAt: null,
      });
    });
  }
  @Get() list(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const saved = await exportImpactTraces(c, user.id);
      const finances = await this.finances(c, user.id);
      const traces = [];
      for (const receipt of saved.traces)
        traces.push({
          receipt,
          reviewReasons: impactReviewReasons(
            receipt,
            await this.current(c, receipt.input.eventId),
            finances.holdings,
            finances.goals,
            new Date().toISOString(),
            await this.equity(c, receipt.input.isin),
          ),
        });
      await this.store.require(c, cookie);
      return ImpactTraceListSchema.parse({ traces });
    });
  }
  @Put(':id') save(
    @Param('id') raw: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const id = parse(z.uuid(), raw).toLowerCase();
    const input = parse(ImpactTraceInputSchema, body);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie);
      const old = await c.query(
        'SELECT fingerprint,payload,deleted_at FROM app_impact_traces WHERE user_id=$1 AND id=$2',
        [user.id, id],
      );
      if (old.rows[0]) {
        if (old.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'This receipt ID already belongs to a different selection.',
          );
        if (old.rows[0].deleted_at)
          throw new GoneException('Receipt deleted. Start a new trace.');
        return ImpactTraceReceiptSchema.parse(old.rows[0].payload);
      }
      const count = await c.query(
        'SELECT count(*)::integer AS n FROM app_impact_traces WHERE user_id=$1 AND deleted_at IS NULL',
        [user.id],
      );
      if (count.rows[0].n >= 100)
        throw new ConflictException(
          'Remove a saved trace before exceeding 100 receipts.',
        );
      const current = await this.current(c, input.eventId);
      if (!current?.event)
        throw new ConflictException(
          'Event was withdrawn, superseded, or its evidence is unavailable.',
        );
      const finances = await this.finances(c, user.id);
      const equity = await this.equity(c, input.isin);
      let receipt;
      try {
        receipt = buildImpactTrace(
          id,
          input,
          current,
          finances.holdings,
          finances.goals,
          new Date().toISOString(),
          equity,
        );
      } catch (error) {
        throw new ConflictException(
          error instanceof Error
            ? error.message
            : 'Trace changed. Reload and review.',
        );
      }
      await this.store.require(c, cookie);
      await c.query(
        'INSERT INTO app_impact_traces(user_id,id,fingerprint,payload) VALUES($1,$2,$3,$4)',
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
        'UPDATE app_impact_traces SET payload=NULL,deleted_at=clock_timestamp() WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id',
        [user.id, id],
      );
      if (!result.rows.length) {
        const prior = await c.query(
          'SELECT id FROM app_impact_traces WHERE user_id=$1 AND id=$2',
          [user.id, id],
        );
        if (!prior.rows.length) throw new NotFoundException('Trace not found.');
      }
      return { deleted: true };
    });
  }
}
