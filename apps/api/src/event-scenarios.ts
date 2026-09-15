import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  EventScenarioInputSchema,
  EventScenarioReviewSchema,
  EventScenarioReceiptSchema,
  EventScenarioPublicSchema,
  EventScenarioListSchema,
  EventScenarioQueueSchema,
  EventScenarioHistorySchema,
  EventScenarioSnapshotSchema,
  calculateEventScenario,
  type EventScenarioReceipt,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { EventStore, EVENT_STORE } from './events.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
export const EVENT_SCENARIO_STORE = Symbol('EVENT_SCENARIO_STORE');
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException(
      'Review valid family-specific scenario fields and source citations.',
    );
  return parsed.data;
}
export class EventScenarioStore {
  constructor(
    private readonly account: AccountStore,
    private readonly events: EventStore,
    private readonly ops: OperatorStore,
  ) {}
  private async actor(
    c: pg.PoolClient,
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
  ) {
    const actor = await this.ops.permission(cookie, permission, c);
    return hash(typeof actor === 'string' ? actor : actor.identity.id);
  }
  private async event(c: pg.PoolClient, id: string) {
    const heads = await c.query(
      'SELECT * FROM reviewed_events WHERE id=$1 FOR SHARE',
      [id],
    );
    const lineage = await c.query(
      "SELECT 1 FROM event_lineage_members WHERE event_id=$1 AND direction='input'",
      [id],
    );
    return heads.rows[0] && !lineage.rows.length
      ? this.events.publicOne(c, heads.rows[0])
      : null;
  }
  private async publicOne(c: pg.PoolClient, row: Record<string, unknown>) {
    const base = {
      id: row.id,
      reviewedAt: row.reviewed_at
        ? (row.reviewed_at as Date).toISOString()
        : null,
    };
    if (row.state !== 'published' || !row.published_version)
      return EventScenarioPublicSchema.parse({
        ...base,
        state: row.state === 'withdrawn' ? 'withdrawn' : 'unavailable',
        receipt: null,
      });
    const values = await c.query(
      'SELECT payload FROM event_scenario_versions WHERE scenario_id=$1 AND version=$2',
      [row.id, row.published_version],
    );
    const receipt = EventScenarioReceiptSchema.parse(values.rows[0]?.payload),
      event = await this.event(c, receipt.input.eventId);
    if (
      !event?.event ||
      event.event.version !== receipt.input.eventVersion ||
      JSON.stringify(event.event) !== JSON.stringify(receipt.event.event)
    )
      return EventScenarioPublicSchema.parse({
        ...base,
        state: 'unavailable',
        receipt: null,
      });
    return EventScenarioPublicSchema.parse({
      ...base,
      state: 'published',
      receipt,
      reviewReasons: receipt.event.event!.sources.some(
        (source) => Date.now() - Date.parse(source.publishedAt) > 30 * 86400000,
      )
        ? ['Historical evidence beyond the 30-day context window.']
        : [],
    });
  }
  list(raw: unknown, cookie?: string, operations = false) {
    const query = parse(
      z.strictObject({
        after: z.uuid().optional(),
        eventId: z.uuid().optional(),
      }),
      raw,
    );
    return this.account.transaction(async (c) => {
      if (operations) await this.actor(c, cookie, 'read');
      const rows = await c.query(
        `SELECT h.* FROM event_scenarios h JOIN event_scenario_versions v ON v.scenario_id=h.id AND v.version=${operations ? 'h.head_version' : 'h.published_version'} WHERE ($1::uuid IS NULL OR h.id>$1) AND ($2::uuid IS NULL OR v.payload->'input'->>'eventId'=$2::text) ORDER BY h.id LIMIT 51 FOR SHARE OF h`,
        [query.after ?? null, query.eventId ?? null],
      );
      const next = rows.rows.length > 50 ? rows.rows[49].id : null;
      if (operations) {
        const items = [];
        for (const row of rows.rows.slice(0, 50)) {
          const version = await c.query(
            'SELECT payload FROM event_scenario_versions WHERE scenario_id=$1 AND version=$2',
            [row.id, row.head_version],
          );
          items.push({
            receipt: EventScenarioReceiptSchema.parse(version.rows[0].payload),
            state:
              row.state === 'withdrawn'
                ? 'withdrawn'
                : row.head_version === row.published_version
                  ? 'published'
                  : 'draft',
            publishedVersion: row.published_version,
          });
        }
        await this.actor(c, cookie, 'read');
        return EventScenarioQueueSchema.parse({ items, next });
      }
      const items = [];
      for (const row of rows.rows.slice(0, 50))
        items.push(await this.publicOne(c, row));
      return EventScenarioListSchema.parse({ items, next });
    });
  }
  read(raw: string) {
    const id = parse(z.uuid(), raw);
    return this.account.transaction(async (c) => {
      const rows = await c.query(
        'SELECT * FROM event_scenarios WHERE id=$1 FOR SHARE',
        [id],
      );
      if (!rows.rows[0] || !rows.rows[0].published_version)
        throw new NotFoundException('Published scenario not found.');
      return this.publicOne(c, rows.rows[0]);
    });
  }
  history(raw: string, query: unknown) {
    const id = parse(z.uuid(), raw),
      cursor = parse(
        z.strictObject({
          before: z.coerce.number().int().positive().optional(),
        }),
        query,
      );
    return this.account.transaction(async (c) => {
      const head = await c.query(
        'SELECT * FROM event_scenarios WHERE id=$1 FOR SHARE',
        [id],
      );
      if (!head.rows[0]?.published_version)
        throw new NotFoundException('Published scenario not found.');
      const rows = await c.query(
        "SELECT v.version,v.payload->>'createdAt' AS created_at FROM event_scenario_versions v WHERE v.scenario_id=$1 AND ($2::int IS NULL OR v.version<$2) AND EXISTS(SELECT 1 FROM event_scenario_reviews r WHERE r.scenario_id=v.scenario_id AND r.version=v.version AND r.decision='publish') ORDER BY v.version DESC LIMIT 51",
        [id, cursor.before ?? null],
      );
      return EventScenarioHistorySchema.parse({
        versions: rows.rows
          .slice(0, 50)
          .map((row) => ({ version: row.version, createdAt: row.created_at })),
        nextBefore: rows.rows.length > 50 ? rows.rows[49].version : null,
      });
    });
  }
  snapshot() {
    return this.account.transaction(async (c) => {
      const rows = await c.query(
        'SELECT * FROM event_scenarios WHERE published_version IS NOT NULL ORDER BY id LIMIT 1001 FOR SHARE',
      );
      if (rows.rows.length > 1000)
        throw new ServiceUnavailableException(
          'Scenario bundle exceeds its explicit 1000-item limit. Add a scoped bundle policy.',
        );
      const items = [];
      const histories: Record<
        string,
        z.infer<typeof EventScenarioHistorySchema>
      > = {};
      for (const row of rows.rows) {
        items.push(await this.publicOne(c, row));
        const versions = await c.query(
          "SELECT v.version,v.payload->>'createdAt' AS at FROM event_scenario_versions v WHERE v.scenario_id=$1 AND EXISTS(SELECT 1 FROM event_scenario_reviews r WHERE r.scenario_id=v.scenario_id AND r.version=v.version AND r.decision='publish') ORDER BY v.version DESC LIMIT 51",
          [row.id],
        );
        histories[row.id] = {
          versions: versions.rows
            .slice(0, 50)
            .map((v) => ({ version: v.version, createdAt: v.at })),
          nextBefore:
            versions.rows.length > 50 ? versions.rows[49].version : null,
        };
      }
      const snapshot = {
        capturedAt: new Date().toISOString(),
        items,
        histories,
      };
      if (Buffer.byteLength(JSON.stringify(snapshot)) > 4 * 1024 * 1024)
        throw new ServiceUnavailableException(
          'Scenario snapshot exceeds its explicit 4 MiB share of the app bundle. Scope the snapshot before rebuilding.',
        );
      return EventScenarioSnapshotSchema.parse(snapshot);
    });
  }
  save(raw: string, body: unknown, cookie?: string) {
    const id = parse(z.uuid(), raw),
      input = parse(EventScenarioInputSchema, body),
      fingerprint = hash({ id, input });
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'prepare');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'scenario-save-request:' + input.requestId,
      ]);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'scenario:' + id,
      ]);
      const prior = await c.query(
        'SELECT fingerprint,payload FROM event_scenario_versions WHERE request_id=$1',
        [input.requestId],
      );
      const actor = await this.actor(c, cookie, 'prepare');
      if (prior.rows[0]) {
        if (prior.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Request ID reused with different scenario content.',
          );
        return EventScenarioReceiptSchema.parse(prior.rows[0].payload);
      }
      const head = await c.query(
        'SELECT head_version FROM event_scenarios WHERE id=$1 FOR UPDATE',
        [id],
      );
      if ((head.rows[0]?.head_version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'Scenario changed. Reload its current edition.',
        );
      const event = await this.event(c, input.eventId);
      if (!event?.event)
        throw new ConflictException(
          'Event is unavailable, withdrawn or superseded.',
        );
      const now = new Date().toISOString();
      let receipt: EventScenarioReceipt;
      try {
        receipt = EventScenarioReceiptSchema.parse({
          id,
          version: input.expectedVersion + 1,
          createdAt: now,
          policy: 'source-bound-event-delta-v1',
          input,
          event,
          result: calculateEventScenario(input, event, now),
        });
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error
            ? e.message
            : 'Source does not support this model.',
        );
      }
      await this.actor(c, cookie, 'prepare');
      if (!head.rows.length)
        await c.query(
          "INSERT INTO event_scenarios(id,head_version,state) VALUES($1,$2,'draft')",
          [id, receipt.version],
        );
      else
        await c.query(
          'UPDATE event_scenarios SET head_version=$2 WHERE id=$1',
          [id, receipt.version],
        );
      await c.query(
        'INSERT INTO event_scenario_versions(scenario_id,version,request_id,fingerprint,actor_hash,payload) VALUES($1,$2,$3,$4,$5,$6)',
        [id, receipt.version, input.requestId, fingerprint, actor, receipt],
      );
      return receipt;
    });
  }
  review(raw: string, body: unknown, cookie?: string) {
    const id = parse(z.uuid(), raw),
      input = parse(EventScenarioReviewSchema, body);
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'approve');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'scenario-review-request:' + input.requestId,
      ]);
      const head = await c.query(
        'SELECT * FROM event_scenarios WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!head.rows[0]) throw new NotFoundException('Scenario not found.');
      const old = await c.query(
        'SELECT scenario_id,version,decision,reason FROM event_scenario_reviews WHERE request_id=$1',
        [input.requestId],
      );
      const actor = await this.actor(c, cookie, 'approve');
      if (old.rows[0]) {
        const row = old.rows[0];
        if (
          row.scenario_id !== id ||
          row.version !== input.expectedVersion ||
          row.decision !== input.decision ||
          row.reason !== input.reason
        )
          throw new ConflictException('Review request ID was reused.');
        return input;
      }
      if (head.rows[0].head_version !== input.expectedVersion)
        throw new ConflictException('Review the latest scenario edition.');
      const versions = await c.query(
        'SELECT payload,actor_hash FROM event_scenario_versions WHERE scenario_id=$1 AND version=$2',
        [id, input.expectedVersion],
      );
      const receipt = EventScenarioReceiptSchema.parse(
        versions.rows[0].payload,
      );
      if (input.decision === 'publish') {
        if (this.ops.namedMode && versions.rows[0].actor_hash === actor)
          throw new ForbiddenException(
            'A different named reviewer must publish this scenario.',
          );
        const event = await this.event(c, receipt.input.eventId);
        if (
          !event?.event ||
          event.event.version !== receipt.input.eventVersion ||
          JSON.stringify(event.event) !== JSON.stringify(receipt.event.event)
        )
          throw new ConflictException(
            'Underlying reviewed event changed. Prepare a new scenario.',
          );
      }
      await this.actor(c, cookie, 'approve');
      await c.query(
        'INSERT INTO event_scenario_reviews(request_id,scenario_id,version,decision,reason,actor_hash) VALUES($1,$2,$3,$4,$5,$6)',
        [
          input.requestId,
          id,
          input.expectedVersion,
          input.decision,
          input.reason,
          actor,
        ],
      );
      await c.query(
        "UPDATE event_scenarios SET state=$2,published_version=CASE WHEN $2='published' THEN $3 ELSE published_version END,reviewed_at=clock_timestamp() WHERE id=$1",
        [
          id,
          input.decision === 'publish' ? 'published' : 'withdrawn',
          input.expectedVersion,
        ],
      );
      return input;
    });
  }
}
@Controller('event-scenarios')
export class EventScenariosController {
  constructor(
    @Inject(EVENT_SCENARIO_STORE) private readonly store: EventScenarioStore,
  ) {}
  @Get() list(@Query() query: unknown) {
    return this.store.list(query);
  }
  @Get('snapshot') snapshot() {
    return this.store.snapshot();
  }
  @Get(':id/history') history(
    @Param('id') id: string,
    @Query() query: unknown,
  ) {
    return this.store.history(id, query);
  }
  @Get(':id') read(@Param('id') id: string) {
    return this.store.read(id);
  }
}
@OperatorRead()
@Controller('ops/event-scenarios')
export class OpsEventScenariosController {
  constructor(
    @Inject(EVENT_SCENARIO_STORE) private readonly store: EventScenarioStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() list(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    return this.store.list(query, cookie, true);
  }
  @OperatorAction('prepare') @Put(':id') save(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.store.save(id, body, cookie);
  }
  @OperatorAction('approve') @Post(':id/review') review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.store.review(id, body, cookie);
  }
}
export const eventScenarioProvider = {
  provide: EVENT_SCENARIO_STORE,
  inject: [STORE, EVENT_STORE, OPERATOR_STORE],
  useFactory: (account: AccountStore, events: EventStore, ops: OperatorStore) =>
    new EventScenarioStore(account, events, ops),
};
