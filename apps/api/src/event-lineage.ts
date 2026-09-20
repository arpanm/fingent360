import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Headers,
  Body,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { z } from 'zod';
import type pg from 'pg';
import {
  EventLineageInputSchema,
  EventLineagePlanSchema,
  EventLineageReviewSchema,
  EventLineageReceiptSchema,
  EventLineageOperationsSchema,
  EventLineageListSchema,
  EventLineagePublicSchema,
  EventRevisionSchema,
  buildEventRevision,
} from '@fingent360/contracts';
import { EventStore, EVENT_STORE } from './events.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
import { admitPublications } from './publication.js';
export const EVENT_LINEAGE_STORE = Symbol('EVENT_LINEAGE_STORE');
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestException(
      'Review valid merge/split membership, exact revisions and output editorials.',
    );
  return result.data;
}
export class EventLineageStore {
  constructor(
    private readonly ops: OperatorStore,
    private readonly events: EventStore,
  ) {}
  private async admit(
    c: pg.PoolClient,
    input: z.infer<typeof EventLineageInputSchema>,
  ) {
    const ids = [...input.inputs, ...input.outputs]
      .map((item) => item.id)
      .sort();
    for (const id of ids)
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'event:' + id,
      ]);
    const heads = (
      await c.query(
        'SELECT * FROM reviewed_events WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [ids],
      )
    ).rows;
    const originals = [];
    for (const item of input.inputs) {
      const head = heads.find((row) => row.id === item.id);
      if (
        !head ||
        head.head_version !== item.version ||
        head.published_version !== item.version ||
        head.status !== 'published'
      )
        throw new ConflictException(
          'An original changed or is not the exact published head. Reload and create a new plan.',
        );
      if (
        (
          await c.query(
            "SELECT 1 FROM event_lineage_members WHERE event_id=$1 AND direction='input'",
            [item.id],
          )
        ).rowCount
      )
        throw new ConflictException(
          'An original already has reviewed replacements.',
        );
      originals.push(
        EventRevisionSchema.parse(
          (
            await c.query(
              'SELECT payload FROM reviewed_event_versions WHERE event_id=$1 AND version=$2',
              [item.id, item.version],
            )
          ).rows[0]?.payload,
        ),
      );
    }
    if (input.outputs.some((item) => heads.some((row) => row.id === item.id)))
      throw new ConflictException('Output identities must be new events.');
    const editorials = [
      ...originals.map((item) => item.editorial),
      ...input.outputs.map((item) => item.editorial),
    ];
    await admitPublications(
      c,
      editorials.flatMap((item) =>
        item.citations.map((citation) => citation.sourceId),
      ),
    );
    const isins = [
      ...new Set(
        editorials.flatMap((item) =>
          item.links
            .filter((link) => link.kind === 'instrument')
            .map((link) => link.isin),
        ),
      ),
    ].sort();
    await c.query(
      'SELECT isin FROM security_identities WHERE isin=ANY($1::text[]) ORDER BY isin FOR SHARE',
      [isins],
    );
    for (const original of originals) {
      const actual = await this.events.evidence(c, original.editorial);
      if (
        JSON.stringify(actual.sources) !== JSON.stringify(original.sources) ||
        JSON.stringify(actual.identities) !==
          JSON.stringify(original.identities)
      )
        throw new ConflictException(
          'Original evidence no longer matches its reviewed edition.',
        );
    }
    const outputEvidence = [];
    for (const output of input.outputs)
      outputEvidence.push(await this.events.evidence(c, output.editorial));
    return { originals, outputEvidence };
  }
  save(
    raw: string,
    body: unknown,
    authorize: (client?: pg.PoolClient) => Promise<unknown>,
  ) {
    const id = parse(z.uuid(), raw).toLowerCase();
    const input = parse(EventLineageInputSchema, body);
    input.inputs = input.inputs.map((item) => ({
      ...item,
      id: item.id.toLowerCase(),
    }));
    input.outputs = input.outputs.map((item) => ({
      ...item,
      id: item.id.toLowerCase(),
    }));
    const fingerprint = hash(input);
    return this.ops.named.transaction(async (c) => {
      await authorize(c);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'lineage:' + id,
      ]);
      const old = (
        await c.query('SELECT payload FROM event_lineage_plans WHERE id=$1', [
          id,
        ])
      ).rows[0];
      if (old) {
        await authorize(c);
        const plan = EventLineagePlanSchema.parse(old.payload);
        if (plan.fingerprint !== fingerprint)
          throw new ConflictException(
            'Plan identity already used for different input.',
          );
        return plan;
      }
      const { originals, outputEvidence } = await this.admit(c, input);
      await authorize(c);
      const createdAt = new Date().toISOString();
      const outputs = input.outputs.map((output, index) =>
        buildEventRevision(
          output.id,
          1,
          createdAt,
          {
            requestId: id,
            expectedVersion: 0,
            revisionReason: input.reason,
            editorial: output.editorial,
          },
          outputEvidence[index]!.sources,
          outputEvidence[index]!.identities,
          randomUUID,
        ),
      );
      const plan = EventLineagePlanSchema.parse({
        id,
        fingerprint,
        createdAt,
        input,
        originals,
        outputs,
      });
      await c.query(
        'INSERT INTO event_lineage_plans(id,fingerprint,payload) VALUES($1,$2,$3)',
        [id, fingerprint, plan],
      );
      await authorize(c);
      return plan;
    });
  }
  async approve(
    raw: string,
    body: unknown,
    authorize: (client?: pg.PoolClient) => Promise<unknown>,
    complete?: (c: pg.PoolClient) => Promise<void>,
  ) {
    const id = parse(z.uuid(), raw).toLowerCase(),
      input = parse(EventLineageReviewSchema, body);
    return this.ops.named.transaction(async (c) => {
      await authorize(c);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'lineage:' + id,
      ]);
      const found = (
        await c.query('SELECT payload FROM event_lineage_plans WHERE id=$1', [
          id,
        ])
      ).rows[0];
      if (!found) throw new NotFoundException('Lineage plan not found.');
      const plan = EventLineagePlanSchema.parse(found.payload);
      if (
        [...plan.originals, ...plan.outputs].some(
          (output) => output.editorial.releaseGroup,
        ) &&
        (!this.ops.namedMode || !complete)
      )
        throw new ForbiddenException(
          'Release grouping requires independent named proposal approval.',
        );
      if (plan.fingerprint !== input.fingerprint)
        throw new ConflictException('Plan fingerprint does not match.');
      const prior = (
        await c.query(
          'SELECT payload FROM event_lineage_receipts WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (prior) {
        await authorize(c);
        if (complete)
          throw new ConflictException(
            'This lineage plan was already applied. Read its committed receipt.',
          );
        return EventLineageReceiptSchema.parse(prior.payload);
      }
      const admission = await this.admit(c, plan.input);
      for (const [index, output] of plan.outputs.entries()) {
        if (
          JSON.stringify(output.sources) !==
            JSON.stringify(admission.outputEvidence[index]!.sources) ||
          JSON.stringify(output.identities) !==
            JSON.stringify(admission.outputEvidence[index]!.identities)
        )
          throw new ConflictException(
            'Planned output evidence changed. Create a new plan.',
          );
      }
      await authorize(c);
      const reviewedAt = new Date().toISOString();
      for (const output of plan.outputs) {
        const event = structuredClone(output);
        event.graph.events[0]!.publicationState = 'published';
        for (const edge of event.graph.edges) edge.reviewState = 'reviewed';
        await c.query(
          "INSERT INTO reviewed_events(id,head_version,published_version,status,reviewed_at) VALUES($1,1,1,'published',$2)",
          [event.id, reviewedAt],
        );
        await c.query(
          'INSERT INTO reviewed_event_versions(event_id,version,payload) VALUES($1,1,$2)',
          [event.id, EventRevisionSchema.parse(event)],
        );
      }
      const receipt = EventLineageReceiptSchema.parse({
        id,
        fingerprint: plan.fingerprint,
        reviewedAt,
        kind: plan.input.kind,
        inputs: plan.input.inputs.map((item) => item.id),
        outputs: plan.input.outputs.map((item) => item.id),
        reason: plan.input.reason,
      });
      await c.query(
        'INSERT INTO event_lineage_receipts(id,payload) VALUES($1,$2)',
        [id, receipt],
      );
      for (const [direction, members] of [
        ['input', receipt.inputs],
        ['output', receipt.outputs],
      ] as const)
        for (const eventId of members)
          await c.query(
            'INSERT INTO event_lineage_members(plan_id,event_id,direction) VALUES($1,$2,$3)',
            [id, eventId, direction],
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
      const row = (
        await c.query(
          'SELECT p.payload AS plan,r.payload AS receipt FROM event_lineage_plans p LEFT JOIN event_lineage_receipts r ON r.id=p.id WHERE p.id=$1',
          [id],
        )
      ).rows[0];
      await authorize(c);
      if (!row) throw new NotFoundException('Lineage plan not found.');
      return EventLineageOperationsSchema.parse({
        plan: row.plan,
        receipt: row.receipt ?? null,
      });
    });
  }
  list(
    query: unknown,
    authorize: (client?: pg.PoolClient) => Promise<unknown>,
  ) {
    const input = parse(z.strictObject({ after: z.uuid().optional() }), query);
    return this.ops.named.transaction(async (c) => {
      await authorize(c);
      const rows = (
        await c.query(
          'SELECT p.id,p.payload AS plan,r.payload AS receipt FROM event_lineage_plans p LEFT JOIN event_lineage_receipts r ON r.id=p.id WHERE ($1::uuid IS NULL OR p.id>$1) ORDER BY p.id LIMIT 21',
          [input.after ?? null],
        )
      ).rows;
      await authorize(c);
      return EventLineageListSchema.parse({
        plans: rows
          .slice(0, 20)
          .map((row) => ({ plan: row.plan, receipt: row.receipt ?? null })),
        next: rows.length > 20 ? rows[19].id : null,
      });
    });
  }
  publicRelations(raw: string) {
    const eventId = parse(z.uuid(), raw).toLowerCase();
    return this.ops.named.transaction(async (c) => {
      const rows = (
        await c.query(
          'SELECT m.direction,r.payload FROM event_lineage_members m JOIN event_lineage_receipts r ON r.id=m.plan_id WHERE m.event_id=$1 ORDER BY m.plan_id',
          [eventId],
        )
      ).rows;
      const ids = [
        ...new Set(
          rows.flatMap((row) => {
            const receipt = EventLineageReceiptSchema.parse(row.payload);
            return [...receipt.inputs, ...receipt.outputs];
          }),
        ),
      ].sort();
      const heads = (
        await c.query(
          'SELECT * FROM reviewed_events WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',
          [ids],
        )
      ).rows;
      const sources = await c.query(
        'SELECT payload FROM reviewed_event_versions v JOIN reviewed_events e ON e.id=v.event_id AND e.published_version=v.version WHERE e.id=ANY($1::uuid[])',
        [ids],
      );
      const records = sources.rows.map((row) =>
        EventRevisionSchema.parse(row.payload),
      );
      await admitPublications(
        c,
        records.flatMap((record) =>
          record.editorial.citations.map((citation) => citation.sourceId),
        ),
      );
      await c.query(
        'SELECT isin FROM security_identities WHERE isin=ANY($1::text[]) ORDER BY isin FOR SHARE',
        [
          [
            ...new Set(
              records.flatMap((record) =>
                record.editorial.links
                  .filter((link) => link.kind === 'instrument')
                  .map((link) => link.isin),
              ),
            ),
          ].sort(),
        ],
      );
      const relations = [];
      for (const row of rows) {
        const receipt = EventLineageReceiptSchema.parse(row.payload),
          related = [];
        for (const id of row.direction === 'input'
          ? receipt.outputs
          : receipt.inputs) {
          const head = heads.find((item) => item.id === id);
          const admitted = head ? await this.events.publicOne(c, head) : null;
          related.push({
            id,
            available: admitted?.status === 'published',
            title: admitted?.event?.editorial.title ?? null,
          });
        }
        relations.push({
          id: receipt.id,
          kind: receipt.kind,
          direction: row.direction === 'input' ? 'replaced-by' : 'derived-from',
          reviewedAt: receipt.reviewedAt,
          reason: receipt.reason,
          related,
        });
      }
      return EventLineagePublicSchema.parse({
        eventId,
        relations,
        evaluatedAt: new Date().toISOString(),
      });
    });
  }
}
@OperatorRead()
@Controller('ops/event-lineage')
export class OpsEventLineageController {
  constructor(
    @Inject(EVENT_LINEAGE_STORE) private readonly store: EventLineageStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() list(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    return this.store.list(query, (c) =>
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
  @OperatorAction('blocked') @Post(':id/approve') approve(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    return this.store.approve(id, body, () => this.ops.require(cookie));
  }
}
@Controller('events')
export class EventLineageController {
  constructor(
    @Inject(EVENT_LINEAGE_STORE) private readonly store: EventLineageStore,
  ) {}
  @Get(':id/lineage') read(@Param('id') id: string) {
    return this.store.publicRelations(id);
  }
}
export const eventLineageProvider = {
  provide: EVENT_LINEAGE_STORE,
  inject: [OPERATOR_STORE, EVENT_STORE],
  useFactory: (ops: OperatorStore, events: EventStore) =>
    new EventLineageStore(ops, events),
};
