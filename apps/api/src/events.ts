import { admitIdentitySelection } from './identity-selection.js';
import { createHash, randomUUID } from 'node:crypto';
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
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { z } from 'zod';
import type pg from 'pg';
import {
  EventSaveSchema,
  EventReviewSchema,
  EventRevisionSchema,
  EventStateSchema,
  EventOperationsSchema,
  EventReceiptSchema,
  EventPublicSchema,
  EventListSchema,
  EventQuerySchema,
  EventHistorySchema,
  SecurityIdentitySchema,
  buildEventRevision,
  publicEdition,
  EventOperationsListSchema,
  ReleaseGroupQuerySchema,
  ReleaseGroupsSchema,
  projectReleaseGroups,
} from '@fingent360/contracts';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
import { admitPublications } from './publication.js';
export const EVENT_STORE = Symbol('EVENT_STORE');
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException('Invalid event fields or continuation.');
  return result.data;
}
function state(row: Record<string, unknown>) {
  return EventStateSchema.parse({
    id: row.id,
    title: EventRevisionSchema.parse(row.payload).editorial.title,
    headVersion: row.head_version,
    publishedVersion: row.published_version,
    status: row.status,
    reviewedAt: row.reviewed_at
      ? (row.reviewed_at as Date).toISOString()
      : null,
  });
}
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class EventStore {
  constructor(private readonly ops: OperatorStore) {}
  async evidence(
    c: pg.PoolClient,
    editorial: z.infer<typeof EventSaveSchema>['editorial'],
  ) {
    const sources = await admitPublications(
      c,
      editorial.citations.map((value) => value.sourceId),
    );
    for (const citation of editorial.citations) {
      const actual = sources.find((row) => row.id === citation.sourceId);
      if (
        !actual ||
        actual.status !== 'published' ||
        actual.version !== citation.version ||
        actual.sourceHash !== citation.hash ||
        !publicEdition(actual)[citation.field].includes(citation.quote)
      )
        throw new ConflictException(
          'A cited public source changed, was withdrawn, or does not contain the exact excerpt.',
        );
    }
    const links = editorial.links.filter((link) => link.kind === 'instrument');
    const isins = [...new Set(links.map((link) => link.isin))].sort();
    const locked = await c.query(
      'SELECT isin,version FROM security_identities WHERE isin=ANY($1::text[]) ORDER BY isin FOR SHARE',
      [isins],
    );
    const identities = [];
    for (const head of locked.rows) {
      const row = await c.query(
        'SELECT payload FROM security_identity_revisions WHERE isin=$1 AND version=$2',
        [head.isin, head.version],
      );
      const identity = SecurityIdentitySchema.parse(row.rows[0]?.payload);
      if (
        links.some(
          (link) =>
            link.isin === identity.isin &&
            (link.identityVersion !== identity.version ||
              (!link.selection &&
                (identity.resolution !== 'matched' ||
                  identity.candidates.length !== 1))),
        )
      )
        throw new ConflictException(
          'An instrument identity changed or is not uniquely resolved.',
        );
      for (const link of links.filter((item) => item.isin === identity.isin))
        if (link.selection)
          await admitIdentitySelection(c, link.selection, identity);
      identities.push(identity);
    }
    if (identities.length !== isins.length)
      throw new ConflictException(
        'Every instrument needs an actual retained matched identity.',
      );
    return {
      sources: sources.map((source) => publicEdition(source)),
      identities,
    };
  }
  save(
    raw: string,
    body: unknown,
    authorize: (client?: pg.PoolClient) => Promise<unknown>,
  ) {
    return this.ops.named.transaction((c) =>
      this.saveIn(c, raw, body, authorize),
    );
  }
  /** Compose a normal draft write into a caller-owned transaction; never publishes. */
  async saveIn(
    c: pg.PoolClient,
    raw: string,
    body: unknown,
    authorize: (client?: pg.PoolClient) => Promise<unknown>,
  ) {
    const id = parse(z.uuid(), raw).toLowerCase(),
      input = parse(EventSaveSchema, body),
      hash = fingerprint({ id, input });
    await authorize(c);
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      'event:' + id,
    ]);
    const old = await c.query(
      'SELECT fingerprint,payload FROM reviewed_event_requests WHERE request_id=$1',
      [input.requestId],
    );
    if (old.rows[0]) {
      await authorize(c);
      if (old.rows[0].fingerprint !== hash)
        throw new ConflictException('Event request identity already used.');
      return EventOperationsSchema.parse(old.rows[0].payload);
    }
    const head = await c.query(
      'SELECT * FROM reviewed_events WHERE id=$1 FOR UPDATE',
      [id],
    );
    if (
      (
        await c.query(
          "SELECT 1 FROM event_lineage_members WHERE event_id=$1 AND direction='input'",
          [id],
        )
      ).rowCount
    )
      throw new ConflictException(
        'This event has reviewed replacements. Edit a replacement instead.',
      );
    if ((head.rows[0]?.head_version ?? 0) !== input.expectedVersion)
      throw new ConflictException('Event changed. Reload before editing.');
    const evidence = await this.evidence(c, input.editorial);
    await authorize(c);
    const version = input.expectedVersion + 1;
    const event = buildEventRevision(
      id,
      version,
      new Date().toISOString(),
      input,
      evidence.sources,
      evidence.identities,
      randomUUID,
    );
    const saved = await c.query(
      'INSERT INTO reviewed_events(id,head_version) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET head_version=EXCLUDED.head_version RETURNING *',
      [id, version],
    );
    await c.query(
      'INSERT INTO reviewed_event_versions(event_id,version,payload) VALUES($1,$2,$3)',
      [id, version, event],
    );
    const result = EventOperationsSchema.parse({
      state: state({ ...saved.rows[0], payload: event }),
      latest: event,
    });
    await c.query(
      'INSERT INTO reviewed_event_requests(request_id,event_id,fingerprint,payload) VALUES($1,$2,$3,$4)',
      [input.requestId, id, hash, result],
    );
    await authorize(c);
    return result;
  }
  async review(
    raw: string,
    body: unknown,
    authorize: (client?: pg.PoolClient) => Promise<unknown>,
    complete?: (c: pg.PoolClient) => Promise<void>,
  ) {
    const id = parse(z.uuid(), raw).toLowerCase(),
      input = parse(EventReviewSchema, body),
      hash = fingerprint({ id, input });
    return this.ops.named.transaction(async (c) => {
      await authorize(c);
      const head = await c.query(
        'SELECT * FROM reviewed_events WHERE id=$1 FOR UPDATE',
        [id],
      );
      await authorize(c);
      const old = await c.query(
        'SELECT fingerprint,payload FROM reviewed_event_reviews WHERE request_id=$1',
        [input.requestId],
      );
      if (old.rows[0]) {
        if (complete || old.rows[0].fingerprint !== hash)
          throw new ConflictException('Event review request already consumed.');
        return EventReceiptSchema.parse(old.rows[0].payload);
      }
      if (head.rows[0]?.head_version !== input.expectedVersion)
        throw new ConflictException('Event head changed or is unavailable.');
      if (
        input.status === 'published' &&
        (
          await c.query(
            "SELECT 1 FROM event_lineage_members WHERE event_id=$1 AND direction='input'",
            [id],
          )
        ).rowCount
      )
        throw new ConflictException(
          'A superseded event cannot be republished. Review its replacements.',
        );
      const row = await c.query(
        'SELECT payload FROM reviewed_event_versions WHERE event_id=$1 AND version=$2',
        [id, input.expectedVersion],
      );
      const event = EventRevisionSchema.parse(row.rows[0].payload);
      const previousGroup = head.rows[0]?.published_version
        ? (
            await c.query(
              'SELECT payload FROM reviewed_event_versions WHERE event_id=$1 AND version=$2',
              [id, head.rows[0].published_version],
            )
          ).rows[0]?.payload?.editorial?.releaseGroup
        : undefined;
      if (
        input.status === 'published' &&
        (event.editorial.releaseGroup || previousGroup) &&
        (!this.ops.namedMode || !complete)
      )
        throw new ForbiddenException(
          'Release grouping requires independent named proposal approval.',
        );
      if (input.status === 'published') await this.evidence(c, event.editorial);
      await authorize(c);
      const reviewedAt = new Date().toISOString(),
        version = input.expectedVersion + 1;
      const revision = buildEventRevision(
        id,
        version,
        reviewedAt,
        {
          requestId: input.requestId,
          expectedVersion: input.expectedVersion,
          revisionReason: input.note,
          editorial: event.editorial,
        },
        event.sources,
        event.identities,
        randomUUID,
      );
      revision.graph.events[0]!.publicationState = input.status;
      for (const edge of revision.graph.edges)
        edge.reviewState =
          input.status === 'published' ? 'reviewed' : 'withdrawn';
      await c.query(
        'INSERT INTO reviewed_event_versions(event_id,version,payload) VALUES($1,$2,$3)',
        [id, version, EventRevisionSchema.parse(revision)],
      );
      await c.query(
        "UPDATE reviewed_events SET head_version=$4,status=$2,published_version=CASE WHEN $2='published' THEN $4 ELSE published_version END,reviewed_at=$3 WHERE id=$1",
        [id, input.status, reviewedAt, version],
      );
      const receipt = EventReceiptSchema.parse({
        requestId: input.requestId,
        id,
        version,
        status: input.status,
        note: input.note,
        reviewedAt,
      });
      await c.query(
        'INSERT INTO reviewed_event_reviews(request_id,event_id,fingerprint,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, id, hash, receipt],
      );
      await authorize(c);
      if (complete) await complete(c);
      return receipt;
    });
  }
  operations(
    raw: string,
    authorize: (client?: pg.PoolClient) => Promise<unknown>,
  ) {
    const id = parse(z.uuid(), raw).toLowerCase();
    return this.ops.named.transaction(async (c) => {
      await authorize(c);
      const row = await c.query(
        'SELECT e.*,v.payload FROM reviewed_events e JOIN reviewed_event_versions v ON v.event_id=e.id AND v.version=e.head_version WHERE e.id=$1',
        [id],
      );
      await authorize(c);
      if (!row.rows[0]) throw new NotFoundException('Event not found.');
      return EventOperationsSchema.parse({
        state: state(row.rows[0]),
        latest: row.rows[0].payload,
      });
    });
  }
  async publicOne(c: pg.PoolClient, row: Record<string, unknown>) {
    const base = {
      id: row.id,
      evaluatedAt: new Date().toISOString(),
      reviewedAt: row.reviewed_at
        ? (row.reviewed_at as Date).toISOString()
        : null,
    };
    if (row.status !== 'published' || !row.published_version)
      return EventPublicSchema.parse({
        ...base,
        status: row.status === 'withdrawn' ? 'withdrawn' : 'unavailable',
        event: null,
      });
    const stored = await c.query(
      'SELECT payload FROM reviewed_event_versions WHERE event_id=$1 AND version=$2',
      [row.id, row.published_version],
    );
    const event = EventRevisionSchema.parse(stored.rows[0]?.payload);
    try {
      const admitted = await this.evidence(c, event.editorial);
      if (
        JSON.stringify(admitted.sources) !== JSON.stringify(event.sources) ||
        JSON.stringify(admitted.identities) !== JSON.stringify(event.identities)
      )
        throw new ConflictException(
          'Retained event context no longer matches admitted records.',
        );
    } catch (error) {
      if (error instanceof ConflictException)
        return EventPublicSchema.parse({
          ...base,
          status: 'unavailable',
          event: null,
        });
      throw error;
    }
    return EventPublicSchema.parse({ ...base, status: 'published', event });
  }
  list(
    query: unknown,
    authorize?: (client?: pg.PoolClient) => Promise<unknown>,
  ) {
    const input = parse(EventQuerySchema, query);
    return this.ops.named.transaction(async (c) => {
      if (authorize) await authorize(c);
      const result = await c.query(
        `SELECT e.*,v.payload FROM reviewed_events e JOIN reviewed_event_versions v ON v.event_id=e.id AND v.version=${authorize ? 'e.head_version' : 'e.published_version'}
        WHERE ($1::uuid IS NULL OR e.id>$1) AND ($2::text IS NULL OR v.payload->'editorial'->>'family'=$2)
        AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(v.payload->'editorial'->'links') l WHERE l->>'kind'='sector' AND l->>'label'=$3))
        AND ($4::text IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(v.payload->'editorial'->'links') l WHERE l->>'isin'=$4)) ORDER BY e.id LIMIT 51 FOR SHARE OF e`,
        [
          input.after ?? null,
          authorize ? (input.family ?? null) : null,
          authorize ? (input.sector ?? null) : null,
          authorize ? (input.isin ?? null) : null,
        ],
      );
      if (authorize) {
        await authorize(c);
        return EventOperationsListSchema.parse({
          items: result.rows.slice(0, 50).map(state),
          next: result.rows.length > 50 ? result.rows[49].id : null,
        });
      }
      const records = result.rows
        .slice(0, 50)
        .map((row) => EventRevisionSchema.parse(row.payload));
      await admitPublications(
        c,
        records.flatMap((record) =>
          record.editorial.citations.map((citation) => citation.sourceId),
        ),
      );
      await c.query(
        'SELECT isin FROM security_identities WHERE isin=ANY($1::text[]) ORDER BY isin FOR SHARE',
        [
          records.flatMap((record) =>
            record.identities.map((identity) => identity.isin),
          ),
        ],
      );
      const items = [];
      for (const row of result.rows.slice(0, 50))
        items.push(await this.publicOne(c, row));
      const filtered = items.filter(
        (row) =>
          (!input.family || row.event?.editorial.family === input.family) &&
          (!input.sector ||
            row.event?.editorial.links.some(
              (link) => link.kind === 'sector' && link.label === input.sector,
            )) &&
          (!input.isin ||
            row.event?.editorial.links.some(
              (link) => link.kind === 'instrument' && link.isin === input.isin,
            )),
      );
      return EventListSchema.parse({
        items: filtered,
        next: result.rows.length > 50 ? result.rows[49].id : null,
        evaluatedAt: new Date().toISOString(),
      });
    });
  }
  releaseGroups(query: unknown) {
    const input = parse(ReleaseGroupQuerySchema, query);
    return this.ops.named.transaction(async (c) => {
      // Inspect the complete bounded group population so an overlapping claim
      // outside the reader's current page cannot silently choose a winner.
      const rows = await c.query(
        "SELECT e.*,v.payload FROM reviewed_events e JOIN reviewed_event_versions v ON v.event_id=e.id AND v.version=e.published_version WHERE e.status='published' AND (v.payload->'editorial' ? 'releaseGroup') AND NOT EXISTS(SELECT 1 FROM event_lineage_members m WHERE m.event_id=e.id AND m.direction='input') ORDER BY e.id LIMIT 1001 FOR SHARE OF e",
      );
      const evaluatedAt = new Date().toISOString();
      if (rows.rows.length > 1000)
        return ReleaseGroupsSchema.parse({
          groups: [],
          evaluatedAt,
          limited: true,
          conflicted: false,
        });
      const revisions = rows.rows.map((row) =>
        EventRevisionSchema.parse(row.payload),
      );
      const relevantMembers = new Set(
        revisions
          .filter((event) =>
            event.editorial.releaseGroup!.sourceIds.some((id) =>
              input.sources.includes(id),
            ),
          )
          .flatMap((event) => event.editorial.releaseGroup!.sourceIds),
      );
      // Admit only requested groups and their possible overlaps. Membership on
      // another page is still considered, without re-reading unrelated evidence.
      const candidates = revisions.filter((event) =>
        event.editorial.releaseGroup!.sourceIds.some((id) =>
          relevantMembers.has(id),
        ),
      );
      const candidateIds = new Set(candidates.map((event) => event.id));
      await admitPublications(
        c,
        candidates.flatMap((event) => event.sources.map((source) => source.id)),
      );
      await c.query(
        'SELECT isin FROM security_identities WHERE isin=ANY($1::text[]) ORDER BY isin FOR SHARE',
        [
          candidates.flatMap((event) =>
            event.identities.map((identity) => identity.isin),
          ),
        ],
      );
      const admitted = [];
      for (const row of rows.rows)
        if (candidateIds.has(row.id))
          admitted.push(await this.publicOne(c, row));
      return projectReleaseGroups(admitted, input.sources, evaluatedAt);
    });
  }
  read(raw: string) {
    const id = parse(z.uuid(), raw).toLowerCase();
    return this.ops.named.transaction(async (c) => {
      const row = await c.query(
        'SELECT * FROM reviewed_events WHERE id=$1 FOR SHARE',
        [id],
      );
      if (!row.rows[0] || !row.rows[0].published_version)
        throw new NotFoundException('Published event not found.');
      return this.publicOne(c, row.rows[0]);
    });
  }
  history(
    raw: string,
    query: unknown,
    authorize?: (client?: pg.PoolClient) => Promise<unknown>,
  ) {
    const id = parse(z.uuid(), raw).toLowerCase();
    const input = parse(
      z.strictObject({
        before: z.coerce.number().int().positive().max(2147483647).optional(),
      }),
      query,
    );
    return this.ops.named.transaction(async (c) => {
      if (authorize) await authorize(c);
      const head = await c.query(
        'SELECT published_version,head_version FROM reviewed_events WHERE id=$1',
        [id],
      );
      if (!head.rows[0] || (!authorize && !head.rows[0].published_version))
        throw new NotFoundException('Published event not found.');
      const rows = await c.query(
        "SELECT version,payload->>'recordedAt' AS recorded_at FROM reviewed_event_versions WHERE event_id=$1 AND version<=$2 AND ($3::int IS NULL OR version<$3) AND ($4::boolean OR payload->'graph'->'events'->0->>'publicationState' IN ('published','withdrawn')) ORDER BY version DESC LIMIT 51",
        [id, head.rows[0].head_version, input.before ?? null, !!authorize],
      );
      if (authorize) await authorize(c);
      return EventHistorySchema.parse({
        revisions: rows.rows.slice(0, 50).map((row) => ({
          version: row.version,
          recordedAt: row.recorded_at,
        })),
        nextBefore: rows.rows.length > 50 ? rows.rows[49].version : null,
      });
    });
  }
}
@Controller('events')
export class EventsController {
  constructor(@Inject(EVENT_STORE) private readonly store: EventStore) {}
  @Get() list(@Query() query: unknown) {
    return this.store.list(query);
  }
  @Get('release-groups') releaseGroups(@Query() query: unknown) {
    return this.store.releaseGroups(query);
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
@Controller('ops/events')
export class OpsEventsController {
  constructor(
    @Inject(EVENT_STORE) private readonly store: EventStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() list(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    return this.store.list(query, (c) =>
      this.ops.permission(cookie, 'read', c),
    );
  }
  @Get(':id/history') history(
    @Param('id') id: string,
    @Query() query: unknown,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.history(id, query, (c) =>
      this.ops.permission(cookie, 'read', c),
    );
  }
  @Get(':id') read(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.operations(id, (c) =>
      this.ops.permission(cookie, 'read', c),
    );
  }
  @OperatorAction('prepare') @Put(':id') save(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.store.save(id, body, (c) =>
      this.ops.permission(cookie, 'prepare', c),
    );
  }
  @OperatorAction('blocked') @Post(':id/review') review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.store.review(id, body, () => this.ops.require(cookie));
  }
}
export const eventProvider = {
  provide: EVENT_STORE,
  inject: [OPERATOR_STORE],
  useFactory: (ops: OperatorStore) => new EventStore(ops),
};
