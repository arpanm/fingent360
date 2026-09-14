import {
  IDENTITY_SELECTION_STORE,
  IdentitySelectionStore,
} from './identity-selection.js';
import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Headers,
  Inject,
  Param,
  Query,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import type pg from 'pg';
import {
  PublicationProposalInputSchema,
  PublicationProposalSchema,
  PublicationProposalPageSchema,
  PublicationDecisionSchema,
  OperatorPageQuerySchema,
} from '@fingent360/contracts';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { requireNamed, operatorCookieHash } from './named-operator-store.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { DiscoveryStore, DISCOVERY_STORE } from './discovery.js';
import { MediaStore, MEDIA_STORE } from './media.js';
import { EventStore, EVENT_STORE } from './events.js';
import { EcbRateStore, ECB_RATE_STORE } from './ecb-rates.js';
import { OilBenchmarkStore, OIL_BENCHMARK_STORE } from './oil-benchmarks.js';
import { EventLineageStore, EVENT_LINEAGE_STORE } from './event-lineage.js';
import { EcbFxStore, ECB_FX_STORE } from './ecb-fx.js';
import { SourcesStore, SOURCE_STORE } from './sources.js';
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException('Invalid publication proposal fields.');
  return result.data;
}
function proposal(row: Record<string, unknown>) {
  return PublicationProposalSchema.parse({
    id: row.id,
    sequence: String(row.sequence),
    input: row.input,
    proposer: row.proposer,
    createdAt: (row.created_at as Date).toISOString(),
    state: row.state,
    reviewer: row.reviewer,
    actionResult: row.action_result ?? null,
    reviewedAt: row.reviewed_at
      ? (row.reviewed_at as Date).toISOString()
      : null,
    note: row.note,
  });
}
@OperatorRead()
@Controller('ops/proposals')
export class PublicationProposalsController {
  constructor(
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(DISCOVERY_STORE) private readonly discovery: DiscoveryStore,
    @Inject(MEDIA_STORE) private readonly media: MediaStore,
    @Inject(EVENT_STORE) private readonly events: EventStore,
    @Inject(ECB_RATE_STORE) private readonly ecb: EcbRateStore,
    @Inject(OIL_BENCHMARK_STORE) private readonly oil: OilBenchmarkStore,
    @Inject(IDENTITY_SELECTION_STORE)
    private readonly selection: IdentitySelectionStore,
    @Inject(EVENT_LINEAGE_STORE) private readonly lineage: EventLineageStore,
    @Inject(ECB_FX_STORE) private readonly fx: EcbFxStore,
    @Inject(SOURCE_STORE) private readonly sources: SourcesStore,
  ) {}
  private enabled() {
    if (!this.ops.namedMode)
      throw new ForbiddenException(
        'Publication proposals require explicitly configured named mode.',
      );
  }
  @Get()
  list(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    this.enabled();
    const input = parse(OperatorPageQuerySchema, query);
    return this.ops.named.transaction(async (c) => {
      await requireNamed(c, operatorCookieHash(cookie));
      const rows = await c.query(
        'SELECT * FROM publication_proposals WHERE ($1::bigint IS NULL OR sequence<$1) ORDER BY sequence DESC LIMIT 51',
        [input.after ?? null],
      );
      await requireNamed(c, operatorCookieHash(cookie));
      return PublicationProposalPageSchema.parse({
        proposals: rows.rows.slice(0, 50).map(proposal),
        next: rows.rows.length > 50 ? String(rows.rows[49].sequence) : null,
      });
    });
  }
  @Get(':id')
  detail(@Param('id') raw: string, @Headers('cookie') cookie?: string) {
    this.enabled();
    const id = parse(z.uuid(), raw).toLowerCase();
    return this.ops.named.transaction(async (c) => {
      await requireNamed(c, operatorCookieHash(cookie));
      const row = await c.query(
        'SELECT * FROM publication_proposals WHERE id=$1',
        [id],
      );
      await requireNamed(c, operatorCookieHash(cookie));
      if (!row.rows[0]) throw new NotFoundException('Proposal not found.');
      return proposal(row.rows[0]);
    });
  }
  @OperatorAction('prepare')
  @Put(':id')
  create(
    @Param('id') raw: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.enabled();
    this.ops.origin(origin);
    const id = parse(z.uuid(), raw).toLowerCase(),
      input = parse(PublicationProposalInputSchema, body);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    return this.ops.named.transaction(async (c) => {
      await c.query('SELECT id FROM named_operator_gate WHERE id=1 FOR UPDATE');
      const actor = await requireNamed(
        c,
        operatorCookieHash(cookie),
        'prepare',
      );
      const old = await c.query(
        'SELECT * FROM publication_proposals WHERE id=$1',
        [id],
      );
      if (old.rows[0]) {
        if (
          old.rows[0].proposer_id !== actor.identity.id ||
          old.rows[0].fingerprint !== fingerprint
        )
          throw new ConflictException('Proposal request already used.');
        await requireNamed(c, operatorCookieHash(cookie), 'prepare');
        return proposal(old.rows[0]);
      }
      const count = await c.query(
        "SELECT count(*)::integer AS n FROM publication_proposals WHERE state='pending'",
      );
      if (count.rows[0].n >= 100)
        throw new ConflictException(
          '100 proposals awaiting review. Review or reject existing proposals first.',
        );
      if (input.kind === 'identity-selection') {
        const plan = await c.query(
          'SELECT fingerprint,payload FROM identity_selection_plans WHERE id=$1 FOR SHARE',
          [input.target],
        );
        const used = await c.query(
          'SELECT 1 FROM identity_selection_revisions WHERE plan_id=$1',
          [input.target],
        );
        if (
          plan.rows[0]?.fingerprint !== input.body.fingerprint ||
          used.rowCount ||
          input.body.status !==
            (plan.rows[0]?.payload.input.action === 'select'
              ? 'approved'
              : 'withdrawn')
        )
          throw new ConflictException(
            'Selection plan changed, was consumed, or does not match this decision.',
          );
      } else if (input.kind === 'ecb-fx') {
        const head = await c.query(
          'SELECT version,edition FROM ecb_fx_head WHERE id=$1 FOR SHARE',
          [input.target],
        );
        const consumed = await c.query(
          'SELECT 1 FROM ecb_fx_reviews WHERE request_id=$1',
          [input.body.requestId],
        );
        if (
          head.rows[0]?.version !== input.body.expectedVersion ||
          head.rows[0]?.edition == null ||
          consumed.rowCount
        )
          throw new ConflictException(
            'FX edition changed, is unavailable, or review request was already used.',
          );
      } else if (input.kind === 'event-lineage') {
        const plan = await c.query(
          'SELECT fingerprint FROM event_lineage_plans WHERE id=$1 FOR SHARE',
          [input.target],
        );
        const applied = await c.query(
          'SELECT 1 FROM event_lineage_receipts WHERE id=$1',
          [input.target],
        );
        if (
          plan.rows[0]?.fingerprint !== input.body.fingerprint ||
          applied.rowCount
        )
          throw new ConflictException(
            'Lineage plan is unavailable, changed or already applied.',
          );
      } else if (input.kind === 'discovery') {
        const head = await c.query(
          'SELECT version FROM discovery_items WHERE id=$1 FOR SHARE',
          [input.target],
        );
        if (head.rows[0]?.version !== input.body.expectedVersion)
          throw new ConflictException(
            'Source head changed or is unavailable. Reload before proposing.',
          );
      } else if (input.kind === 'media') {
        const asset = await c.query(
          'SELECT m.id FROM discovery_items i JOIN discovery_media m ON m.item_id=i.id AND m.item_version=i.version WHERE i.id=$1 AND m.id=$2 FOR SHARE OF i,m',
          [input.target, input.body.assetId],
        );
        if (!asset.rows[0])
          throw new ConflictException(
            'Media no longer matches the source edition.',
          );
      } else if (input.kind === 'event') {
        const head = await c.query(
          'SELECT head_version FROM reviewed_events WHERE id=$1 FOR SHARE',
          [input.target],
        );
        const consumed = await c.query(
          'SELECT 1 FROM reviewed_event_reviews WHERE request_id=$1',
          [input.body.requestId],
        );
        if (
          head.rows[0]?.head_version !== input.body.expectedVersion ||
          consumed.rowCount
        )
          throw new ConflictException(
            'Event changed or review request already consumed.',
          );
      } else if (input.kind === 'ecb-rates') {
        const head = await c.query(
          'SELECT version,edition FROM ecb_rate_head WHERE id=$1 FOR SHARE',
          [input.target],
        );
        const consumed = await c.query(
          'SELECT 1 FROM ecb_rate_reviews WHERE request_id=$1',
          [input.body.requestId],
        );
        if (
          head.rows[0]?.version !== input.body.expectedVersion ||
          head.rows[0]?.edition == null ||
          consumed.rowCount
        )
          throw new ConflictException(
            'Rate edition changed, is unavailable, or review request was already used.',
          );
      } else if (input.kind === 'oil-benchmarks') {
        const head = await c.query(
          'SELECT version,edition FROM oil_benchmark_head WHERE id=$1 FOR SHARE',
          [input.target],
        );
        const consumed = await c.query(
          'SELECT 1 FROM oil_benchmark_reviews WHERE request_id=$1',
          [input.body.requestId],
        );
        if (
          head.rows[0]?.version !== input.body.expectedVersion ||
          head.rows[0]?.edition == null ||
          consumed.rowCount
        )
          throw new ConflictException(
            'Oil benchmark edition changed, is unavailable, or review request was already used.',
          );
      } else if (input.kind === 'source-update') {
        const source = await c.query(
          'SELECT revision FROM research_sources WHERE id=$1 FOR SHARE',
          [input.target],
        );
        if (source.rows[0]?.revision !== input.body.expectedRevision)
          throw new ConflictException(
            'Registry source changed or is unavailable.',
          );
      }
      await requireNamed(c, operatorCookieHash(cookie), 'prepare', true);
      const saved = await c.query(
        'INSERT INTO publication_proposals(id,fingerprint,proposer_id,input,proposer) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [id, fingerprint, actor.identity.id, input, actor.identity],
      );
      return proposal(saved.rows[0]);
    });
  }
  private async finish(
    c: pg.PoolClient,
    id: string,
    note: string,
    cookie: string | undefined,
    state: 'approved' | 'rejected',
    actionResult: { sourceId: string; revision: number } | null = null,
  ) {
    const found = await c.query(
      'SELECT * FROM publication_proposals WHERE id=$1 FOR UPDATE',
      [id],
    );
    const actor = await requireNamed(
      c,
      operatorCookieHash(cookie),
      'approve',
      true,
    );
    const row = found.rows[0];
    if (!row) throw new NotFoundException('Proposal not found.');
    if (row.proposer_id === actor.identity.id)
      throw new ForbiddenException(
        'A different named operator must review this proposal.',
      );
    if (row.state !== 'pending') {
      if (
        state === 'rejected' &&
        row.state === 'rejected' &&
        row.reviewer_id === actor.identity.id &&
        row.note === note
      )
        return proposal(row);
      throw new ConflictException(
        'Proposal already decided. Reload its historical receipt.',
      );
    }
    const result = await c.query(
      'UPDATE publication_proposals SET state=$2,reviewer_id=$3,reviewer=$4,reviewed_at=clock_timestamp(),note=$5,action_result=$6 WHERE id=$1 RETURNING *',
      [id, state, actor.identity.id, actor.identity, note, actionResult],
    );
    return proposal(result.rows[0]);
  }
  @OperatorAction('approve')
  @Post(':id/reject')
  reject(
    @Param('id') raw: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.enabled();
    this.ops.origin(origin);
    const id = parse(z.uuid(), raw).toLowerCase(),
      input = parse(PublicationDecisionSchema, body);
    return this.ops.named.transaction((c) =>
      this.finish(c, id, input.note, cookie, 'rejected'),
    );
  }
  @OperatorAction('approve')
  @Post(':id/approve')
  async approve(
    @Param('id') raw: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.enabled();
    this.ops.origin(origin);
    const id = parse(z.uuid(), raw).toLowerCase(),
      decision = parse(PublicationDecisionSchema, body);
    const actor = await this.ops.named.require(cookie, 'approve'),
      original = await this.detail(id, cookie);
    if (original.proposer.id === actor.identity.id)
      throw new ForbiddenException(
        'A different named operator must approve this proposal.',
      );
    if (original.state !== 'pending') {
      if (
        original.state === 'approved' &&
        original.reviewer?.id === actor.identity.id &&
        original.note === decision.note
      )
        return original;
      throw new ConflictException('Proposal has already been decided.');
    }
    let receipt: ReturnType<typeof proposal> | undefined;
    const complete = async (c: pg.PoolClient) => {
      receipt = await this.finish(c, id, decision.note, cookie, 'approved');
    };
    const authorize = (client?: pg.PoolClient) =>
      this.ops.named.require(cookie, 'approve', client);
    const input = original.input;
    if (input.kind === 'identity-selection')
      await this.selection.review(
        input.target,
        input.body,
        authorize,
        complete,
      );
    else if (input.kind === 'ecb-fx')
      await this.fx.review(input.target, input.body, authorize, complete);
    else if (input.kind === 'event-lineage')
      await this.lineage.approve(input.target, input.body, authorize, complete);
    else if (input.kind === 'discovery')
      await this.discovery.review(
        input.target,
        input.body,
        authorize,
        complete,
      );
    else if (input.kind === 'media')
      await this.media.review(
        input.target,
        input.body,
        operatorCookieHash(cookie)!,
        authorize,
        complete,
      );
    else if (input.kind === 'event')
      await this.events.review(input.target, input.body, authorize, complete);
    else if (input.kind === 'ecb-rates')
      await this.ecb.review(input.target, input.body, authorize, complete);
    else if (input.kind === 'oil-benchmarks')
      await this.oil.review(input.target, input.body, authorize, complete);
    else
      await this.sources.save(
        input.body,
        this.ops.serverAuthorization(),
        input.kind === 'source-update' ? input.target : undefined,
        origin,
        authorize,
        async (c, saved) => {
          receipt = await this.finish(
            c,
            id,
            decision.note,
            cookie,
            'approved',
            input.kind === 'source-create'
              ? { sourceId: saved.id, revision: saved.revision }
              : null,
          );
        },
      );
    if (!receipt)
      throw new ConflictException(
        'No publication receipt was committed. Reload the proposal.',
      );
    return receipt;
  }
}
