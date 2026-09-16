import { createHash } from 'node:crypto';
import type pg from 'pg';
import { z } from 'zod';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Headers,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  IntelligenceBriefInputSchema,
  IntelligenceBriefReceiptSchema,
  IntelligenceBriefReviewSchema,
  IntelligenceBriefListSchema,
  IntelligenceBriefQueueSchema,
  IntelligenceBriefHistorySchema,
  IntelligenceBriefSnapshotSchema,
  projectIntelligenceBrief,
  EventRevisionSchema,
  EventListSchema,
  type EventPublicSchema,
} from '@fingent360/contracts';
import { STORE, AccountStore } from './accounts.js';
import { EVENT_STORE, EventStore } from './events.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { admitPublications } from './publication.js';
import { canonicalSourceJson } from './canonical-source-json.js';
const SERVICE = Symbol('INTELLIGENCE_BRIEFS'),
  digest = (value: unknown) =>
    createHash('sha256').update(canonicalSourceJson(value)).digest('hex');
function parse<T>(schema: z.ZodType<T>, input: unknown) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException('Review valid brief selections and fields.');
  return result.data;
}
export class IntelligenceBriefStore {
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
    const value = await this.ops.permission(cookie, permission, c);
    return typeof value === 'string' ? value : value.identity.id;
  }
  private async admitted(c: pg.PoolClient, ids: string[]) {
    const heads = await c.query(
      'SELECT e.*,v.payload FROM reviewed_events e LEFT JOIN reviewed_event_versions v ON v.event_id=e.id AND v.version=e.published_version WHERE e.id=ANY($1::uuid[]) ORDER BY e.id FOR SHARE OF e',
      [[...new Set(ids)].sort()],
    );
    const retained = heads.rows.flatMap((row) =>
      row.payload ? [EventRevisionSchema.parse(row.payload)] : [],
    );
    await admitPublications(
      c,
      retained.flatMap((event) => event.sources.map((s) => s.id)),
    );
    await c.query(
      'SELECT isin FROM security_identities WHERE isin=ANY($1::text[]) ORDER BY isin FOR SHARE',
      [
        retained.flatMap((event) =>
          event.identities.map((identity) => identity.isin),
        ),
      ],
    );
    const result: z.infer<typeof EventPublicSchema>[] = [];
    for (const head of heads.rows) {
      const lineage = await c.query(
        "SELECT 1 FROM event_lineage_members WHERE event_id=$1 AND direction='input'",
        [head.id],
      );
      if (!lineage.rows.length)
        result.push(await this.events.publicOne(c, head));
    }
    return result;
  }
  private async one(c: pg.PoolClient, head: Record<string, unknown>) {
    if (!head.published_version)
      throw new NotFoundException('Issued brief unavailable.');
    const row = await c.query(
        'SELECT payload FROM intelligence_brief_versions WHERE brief_id=$1 AND version=$2',
        [head.id, head.published_version],
      ),
      receipt = IntelligenceBriefReceiptSchema.parse(row.rows[0]?.payload),
      issue = await c.query(
        "SELECT reviewed_at FROM intelligence_brief_reviews WHERE brief_id=$1 AND version=$2 AND payload->>'decision'='publish' ORDER BY seq DESC LIMIT 1",
        [head.id, head.published_version],
      );
    if (!issue.rows[0])
      throw new ConflictException('Brief issue record unavailable.');
    return projectIntelligenceBrief(
      receipt,
      head.state === 'withdrawn'
        ? []
        : await this.admitted(
            c,
            receipt.input.events.map((e) => e.id),
          ),
      issue.rows[0].reviewed_at.toISOString(),
      new Date().toISOString(),
      head.state === 'withdrawn' ? 'withdrawn' : 'published',
    );
  }
  list(raw: unknown) {
    const query = parse(z.strictObject({ after: z.uuid().optional() }), raw);
    return this.account.transaction(async (c) => {
      const rows = await c.query(
          'SELECT * FROM intelligence_briefs WHERE published_version IS NOT NULL AND ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 51 FOR SHARE',
          [query.after ?? null],
        ),
        items = [];
      for (const row of rows.rows.slice(0, 50))
        items.push(await this.one(c, row));
      return IntelligenceBriefListSchema.parse({
        items,
        next: rows.rows.length > 50 ? rows.rows[49].id : null,
      });
    });
  }
  read(raw: string) {
    const id = parse(z.uuid(), raw);
    return this.account.transaction(async (c) => {
      const rows = await c.query(
        'SELECT * FROM intelligence_briefs WHERE id=$1 FOR SHARE',
        [id],
      );
      if (!rows.rows[0]) throw new NotFoundException('Brief unavailable.');
      return this.one(c, rows.rows[0]);
    });
  }
  private async historyIn(c: pg.PoolClient, id: string, before: number | null) {
    const rows = await c.query(
      "SELECT version,min(reviewed_at) AS issued_at FROM intelligence_brief_reviews WHERE brief_id=$1 AND payload->>'decision'='publish' AND ($2::integer IS NULL OR version<$2) GROUP BY version ORDER BY version DESC LIMIT 51",
      [id, before],
    );
    return IntelligenceBriefHistorySchema.parse({
      versions: rows.rows.slice(0, 50).map((row) => ({
        version: row.version,
        issuedAt: row.issued_at.toISOString(),
      })),
      nextBefore: rows.rows.length > 50 ? rows.rows[49].version : null,
    });
  }
  history(raw: string, rawQuery: unknown) {
    const id = parse(z.uuid(), raw),
      query = parse(
        z.strictObject({
          before: z.coerce.number().int().positive().optional(),
        }),
        rawQuery,
      );
    return this.account.transaction(async (c) => {
      const head = await c.query(
        'SELECT published_version FROM intelligence_briefs WHERE id=$1 FOR SHARE',
        [id],
      );
      if (!head.rows[0]?.published_version)
        throw new NotFoundException('Issued brief unavailable.');
      return this.historyIn(c, id, query.before ?? null);
    });
  }
  snapshot() {
    return this.account.transaction(async (c) => {
      const rows = await c.query(
        'SELECT * FROM intelligence_briefs WHERE published_version IS NOT NULL ORDER BY id LIMIT 101 FOR SHARE',
      );
      if (rows.rows.length > 100)
        throw new ServiceUnavailableException(
          'Brief snapshot exceeds100 editions. Scope the bundle explicitly.',
        );
      const items = [],
        histories: Record<
          string,
          z.infer<typeof IntelligenceBriefHistorySchema>
        > = {};
      for (const row of rows.rows) {
        items.push(await this.one(c, row));
        histories[row.id] = await this.historyIn(c, row.id, null);
      }
      const value = IntelligenceBriefSnapshotSchema.parse({
        capturedAt: new Date().toISOString(),
        items,
        histories,
      });
      if (Buffer.byteLength(JSON.stringify(value)) > 4 * 1024 * 1024)
        throw new ServiceUnavailableException(
          'Brief snapshot exceeds4MiB. Scope it explicitly.',
        );
      return value;
    });
  }
  candidates(raw: unknown, cookie?: string) {
    const query = parse(z.strictObject({ after: z.uuid().optional() }), raw);
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'read');
      const rows = await c.query(
          "SELECT id FROM reviewed_events WHERE status='published' AND ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 51",
          [query.after ?? null],
        ),
        items = (
          await this.admitted(
            c,
            rows.rows.slice(0, 50).map((row) => row.id),
          )
        ).filter(
          (e) =>
            e.status === 'published' && e.event?.editorial.claimKind === 'fact',
        );
      await this.actor(c, cookie, 'read');
      return EventListSchema.parse({
        items,
        next: rows.rows.length > 50 ? rows.rows[49].id : null,
        evaluatedAt: new Date().toISOString(),
      });
    });
  }
  queue(raw: unknown, cookie?: string) {
    const query = parse(z.strictObject({ after: z.uuid().optional() }), raw);
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'read');
      const rows = await c.query(
        'SELECT h.*,v.payload FROM intelligence_briefs h JOIN intelligence_brief_versions v ON v.brief_id=h.id AND v.version=h.head_version WHERE ($1::uuid IS NULL OR h.id>$1) ORDER BY h.id LIMIT 51',
        [query.after ?? null],
      );
      await this.actor(c, cookie, 'read');
      return IntelligenceBriefQueueSchema.parse({
        items: rows.rows.slice(0, 50).map((row) => ({
          receipt: row.payload,
          state: row.state,
          publishedVersion: row.published_version,
        })),
        next: rows.rows.length > 50 ? rows.rows[49].id : null,
      });
    });
  }
  save(raw: string, body: unknown, cookie?: string) {
    const id = parse(z.uuid(), raw),
      input = parse(IntelligenceBriefInputSchema, body),
      fingerprint = digest({ id, input });
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'prepare');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'brief-write',
      ]);
      const actor = await this.actor(c, cookie, 'prepare'),
        old = await c.query(
          'SELECT fingerprint,payload FROM intelligence_brief_versions WHERE request_id=$1',
          [input.requestId],
        );
      if (old.rows[0]) {
        if (old.rows[0].fingerprint !== fingerprint)
          throw new ConflictException('Brief preparation ID already used.');
        return IntelligenceBriefReceiptSchema.parse(old.rows[0].payload);
      }
      const head = await c.query(
        'SELECT * FROM intelligence_briefs WHERE id=$1 FOR UPDATE',
        [id],
      );
      if ((head.rows[0]?.head_version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'Brief changed. Reload before preparing another version.',
        );
      const actual = await this.admitted(
        c,
        input.events.map((e) => e.id),
      );
      let receipt;
      try {
        receipt = IntelligenceBriefReceiptSchema.parse({
          id,
          version: input.expectedVersion + 1,
          preparedAt: new Date().toISOString(),
          input,
          events: input.events.map((e) => actual.find((a) => a.id === e.id)),
        });
      } catch {
        throw new ConflictException(
          'Choose five/six distinct current reviewed fact events with real sector and company links.',
        );
      }
      if (!head.rows.length)
        await c.query(
          "INSERT INTO intelligence_briefs(id,head_version,state) VALUES($1,$2,'draft')",
          [id, receipt.version],
        );
      else
        await c.query(
          'UPDATE intelligence_briefs SET head_version=$2 WHERE id=$1',
          [id, receipt.version],
        );
      await c.query(
        'INSERT INTO intelligence_brief_versions(brief_id,version,request_id,actor_id,fingerprint,payload) VALUES($1,$2,$3,$4,$5,$6)',
        [id, receipt.version, input.requestId, actor, fingerprint, receipt],
      );
      await this.actor(c, cookie, 'prepare');
      return receipt;
    });
  }
  review(raw: string, body: unknown, cookie?: string) {
    const id = parse(z.uuid(), raw),
      input = parse(IntelligenceBriefReviewSchema, body);
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'approve');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'brief-write',
      ]);
      const actor = await this.actor(c, cookie, 'approve'),
        old = await c.query(
          'SELECT brief_id,payload,actor_id FROM intelligence_brief_reviews WHERE request_id=$1',
          [input.requestId],
        );
      if (old.rows[0]) {
        if (
          old.rows[0].brief_id !== id ||
          old.rows[0].actor_id !== actor ||
          digest(old.rows[0].payload) !== digest(input)
        )
          throw new ConflictException('Brief review ID already used.');
        return input;
      }
      const head = await c.query(
        'SELECT * FROM intelligence_briefs WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (head.rows[0]?.head_version !== input.expectedVersion)
        throw new ConflictException(
          'Review the current prepared brief version.',
        );
      const row = await c.query(
          'SELECT payload,actor_id FROM intelligence_brief_versions WHERE brief_id=$1 AND version=$2',
          [id, input.expectedVersion],
        ),
        receipt = IntelligenceBriefReceiptSchema.parse(row.rows[0].payload);
      if (input.decision === 'publish') {
        if (!this.ops.namedMode || row.rows[0].actor_id === actor)
          throw new ForbiddenException(
            'A different named reviewer must issue the brief.',
          );
        const view = projectIntelligenceBrief(
          receipt,
          await this.admitted(
            c,
            receipt.input.events.map((e) => e.id),
          ),
          new Date().toISOString(),
          new Date().toISOString(),
        );
        if (view.points.some((p) => p.status !== 'current'))
          throw new ConflictException(
            'A point changed or lost source admission. Prepare a corrected brief.',
          );
      }
      await c.query(
        'INSERT INTO intelligence_brief_reviews(brief_id,version,request_id,actor_id,payload) VALUES($1,$2,$3,$4,$5)',
        [id, input.expectedVersion, input.requestId, actor, input],
      );
      await c.query(
        "UPDATE intelligence_briefs SET state=$2,published_version=CASE WHEN $2='published' THEN head_version ELSE published_version END,reviewed_at=clock_timestamp() WHERE id=$1",
        [id, input.decision === 'publish' ? 'published' : 'withdrawn'],
      );
      await this.actor(c, cookie, 'approve');
      return input;
    });
  }
  origin(origin?: string) {
    this.ops.origin(origin);
  }
}
export const intelligenceBriefProvider = {
  provide: SERVICE,
  useFactory: (account: AccountStore, events: EventStore, ops: OperatorStore) =>
    new IntelligenceBriefStore(account, events, ops),
  inject: [STORE, EVENT_STORE, OPERATOR_STORE],
};
@Controller('intelligence-briefs')
export class IntelligenceBriefController {
  constructor(
    @Inject(SERVICE) private readonly store: IntelligenceBriefStore,
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
@Controller('ops/intelligence-briefs')
export class IntelligenceBriefOperationsController {
  constructor(
    @Inject(SERVICE) private readonly store: IntelligenceBriefStore,
  ) {}
  @Get() queue(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    return this.store.queue(query, cookie);
  }
  @Get('candidates') candidates(
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.candidates(query, cookie);
  }
  @Put(':id') @OperatorAction('prepare') save(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    return this.store.save(id, body, cookie);
  }
  @Post(':id/review') @OperatorAction('approve') review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    return this.store.review(id, body, cookie);
  }
}
