import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  ResearchGovernanceSnapshotSchema,
  ResearchGovernanceDraftSchema,
  ResearchGovernanceRevisionSchema,
  ResearchGovernanceListSchema,
  ResearchGovernanceViewSchema,
  ResearchGovernanceHistorySchema,
  ResearchSimulationSchema,
  ResearchReviewSchema,
  ResearchPolicyBindingSchema,
  governanceChecks,
  type ResearchGovernanceRevision,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { EventStore, EVENT_STORE } from './events.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const p = schema.safeParse(value);
  if (!p.success)
    throw new BadRequestException(
      'Review valid governance fields, evidence and versions.',
    );
  return p.data;
}
async function admittedEvent(c: pg.PoolClient, events: EventStore, id: string) {
  const rows = await c.query(
    'SELECT * FROM reviewed_events WHERE id=$1 FOR SHARE',
    [id],
  );
  const lineage = await c.query(
    "SELECT 1 FROM event_lineage_members WHERE event_id=$1 AND direction='input'",
    [id],
  );
  const event =
    rows.rows[0] && !lineage.rowCount
      ? await events.publicOne(c, rows.rows[0])
      : null;
  if (!event?.event)
    throw new ConflictException(
      'Reviewed event is unavailable, changed or superseded.',
    );
  return event;
}
async function current(
  c: pg.PoolClient,
  events: EventStore,
  revision: ResearchGovernanceRevision,
) {
  if (revision.input.reviewBy < new Date().toISOString().slice(0, 10))
    throw new ConflictException(
      'Policy/context review date has elapsed. Prepare and review a new revision.',
    );
  const actual = await admittedEvent(c, events, revision.input.eventId);
  if (
    actual.event!.version !== revision.input.eventVersion ||
    JSON.stringify(actual.event) !== JSON.stringify(revision.event.event)
  )
    throw new ConflictException(
      'Source evidence changed. Prepare and review a new revision.',
    );
}
/** Caller must authenticate its account owner; this admits an exact public policy/source edition. */
export async function admitResearchPolicy(
  c: pg.PoolClient,
  binding: unknown,
  events: EventStore,
  kind: 'educational-policy' | 'causal-context' = 'educational-policy',
): Promise<ResearchGovernanceRevision> {
  const value = parse(ResearchPolicyBindingSchema, binding);
  const head = (
    await c.query(
      'SELECT * FROM research_governance_heads WHERE id=$1 FOR SHARE',
      [value.id],
    )
  ).rows[0];
  if (
    !head ||
    head.state !== 'released' ||
    head.published_version !== value.version
  )
    throw new ConflictException(
      'Policy release is no longer current. Choose a currently released policy.',
    );
  const revision = ResearchGovernanceRevisionSchema.parse(
    (
      await c.query(
        'SELECT payload FROM research_governance_versions WHERE id=$1 AND version=$2',
        [value.id, value.version],
      )
    ).rows[0]?.payload,
  );
  if (revision.input.content.kind !== kind)
    throw new BadRequestException('Choose the matching research release kind.');
  await current(c, events, revision);
  return revision;
}
export async function releasedResearchPolicies(
  c: pg.PoolClient,
  events: EventStore,
  kind: 'educational-policy' | 'causal-context' = 'educational-policy',
  source?: { id: string; version: number; sourceHash: string | null },
): Promise<ResearchGovernanceRevision[]> {
  if (source && source.sourceHash === null) return [];
  const heads = await c.query(
    "SELECT h.id,h.published_version FROM research_governance_heads h JOIN research_governance_versions v ON v.id=h.id AND v.version=h.published_version WHERE h.state='released' AND v.payload->'input'->'content'->>'kind'=$1 AND ($2::jsonb IS NULL OR v.payload->'event'->'event'->'sources' @> $2::jsonb) ORDER BY h.id LIMIT $3",
    [
      kind,
      source
        ? JSON.stringify([
            {
              id: source.id,
              version: source.version,
              sourceHash: source.sourceHash,
            },
          ])
        : null,
      source ? 101 : 100,
    ],
  );
  if (source && heads.rows.length > 100)
    throw new ServiceUnavailableException(
      'Too many released contexts reference this edition. Use a scoped research review before opening this explanation.',
    );
  const result: ResearchGovernanceRevision[] = [];
  for (const head of heads.rows) {
    try {
      result.push(
        await admitResearchPolicy(
          c,
          { id: head.id, version: head.published_version },
          events,
          kind,
        ),
      );
    } catch (error) {
      if (!(
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ))
        throw error;
    }
  }
  return result;
}
@Injectable()
export class ResearchGovernanceStore {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(EVENT_STORE) private readonly events: EventStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  private async actor(
    c: pg.PoolClient,
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
  ) {
    const value = await this.ops.permission(cookie, permission, c);
    return fingerprint(typeof value === 'string' ? value : value.identity.id);
  }
  async snapshot() {
    return this.account.transaction(async (c) =>
      ResearchGovernanceSnapshotSchema.parse({
        capturedAt: new Date().toISOString(),
        policies: await releasedResearchPolicies(c, this.events),
        contexts: await releasedResearchPolicies(
          c,
          this.events,
          'causal-context',
        ),
      }),
    );
  }
  async save(idValue: string, body: unknown, cookie?: string) {
    const id = parse(z.uuid(), idValue),
      input = parse(ResearchGovernanceDraftSchema, body),
      hash = fingerprint({ id, input });
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'prepare');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'governance-request:' + input.requestId,
      ]);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'governance:' + id,
      ]);
      const prior = (
        await c.query(
          'SELECT fingerprint,payload FROM research_governance_versions WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (prior) {
        if (prior.fingerprint !== hash)
          throw new ConflictException(
            'Request ID was reused with different governance input.',
          );
        await this.actor(c, cookie, 'prepare');
        return ResearchGovernanceRevisionSchema.parse(prior.payload);
      }
      const head = (
        await c.query(
          'SELECT * FROM research_governance_heads WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if ((head?.head_version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'Governance draft changed. Reload its latest version.',
        );
      const event = await admittedEvent(c, this.events, input.eventId);
      if (event.event!.version !== input.eventVersion)
        throw new ConflictException('Reviewed event version changed.');
      const revision = ResearchGovernanceRevisionSchema.parse({
        id,
        version: input.expectedVersion + 1,
        recordedAt: new Date().toISOString(),
        input,
        event,
      });
      if (governanceChecks(revision).some((check) => !check.passed))
        throw new BadRequestException(
          'Citations or causal mappings do not match the actual reviewed event.',
        );
      const actor = await this.actor(c, cookie, 'prepare');
      if (!head)
        await c.query(
          "INSERT INTO research_governance_heads(id,head_version,state) VALUES($1,$2,'draft')",
          [id, revision.version],
        );
      else
        await c.query(
          'UPDATE research_governance_heads SET head_version=$2 WHERE id=$1',
          [id, revision.version],
        );
      await c.query(
        'INSERT INTO research_governance_versions(id,version,request_id,fingerprint,actor_hash,payload) VALUES($1,$2,$3,$4,$5,$6)',
        [id, revision.version, input.requestId, hash, actor, revision],
      );
      return revision;
    });
  }
  async simulate(idValue: string, body: unknown, cookie?: string) {
    const id = parse(z.uuid(), idValue),
      input = parse(
        z.strictObject({
          requestId: z.uuid(),
          expectedVersion: z.number().int().positive(),
        }),
        body,
      );
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'prepare');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'governance-simulation:' + input.requestId,
      ]);
      const head = (
        await c.query(
          'SELECT * FROM research_governance_heads WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!head || head.head_version !== input.expectedVersion)
        throw new ConflictException('Simulate the latest governance revision.');
      const old = (
        await c.query(
          'SELECT payload FROM research_governance_simulations WHERE id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (old) {
        const receipt = ResearchSimulationSchema.parse(old.payload);
        if (
          receipt.releaseId !== id ||
          receipt.version !== input.expectedVersion
        )
          throw new ConflictException('Simulation request ID reused.');
        await this.actor(c, cookie, 'prepare');
        return receipt;
      }
      const revision = ResearchGovernanceRevisionSchema.parse(
        (
          await c.query(
            'SELECT payload FROM research_governance_versions WHERE id=$1 AND version=$2',
            [id, input.expectedVersion],
          )
        ).rows[0]?.payload,
      );
      await current(c, this.events, revision);
      const checks = governanceChecks(revision),
        receipt = ResearchSimulationSchema.parse({
          id: input.requestId,
          releaseId: id,
          version: input.expectedVersion,
          recordedAt: new Date().toISOString(),
          basis: 'deterministic-governance-invariants-v1',
          passed: checks.every((check) => check.passed),
          checks,
        });
      await this.actor(c, cookie, 'prepare');
      await c.query(
        'INSERT INTO research_governance_simulations(id,release_id,version,payload) VALUES($1,$2,$3,$4)',
        [receipt.id, id, receipt.version, receipt],
      );
      return receipt;
    });
  }
  async review(idValue: string, body: unknown, cookie?: string) {
    const id = parse(z.uuid(), idValue),
      input = parse(ResearchReviewSchema, body);
    return this.account.transaction(async (c) => {
      const actor = await this.actor(c, cookie, 'approve');
      if (!this.ops.namedMode)
        throw new ForbiddenException(
          'A different named operator is required for material release review.',
        );
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'governance-review:' + input.requestId,
      ]);
      const head = (
        await c.query(
          'SELECT * FROM research_governance_heads WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!head) throw new NotFoundException('Governance draft not found.');
      const prior = (
        await c.query(
          'SELECT * FROM research_governance_reviews WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.release_id !== id ||
          prior.version !== input.expectedVersion ||
          prior.decision !== input.decision ||
          prior.reason !== input.reason ||
          prior.simulation_id !== input.simulationId
        )
          throw new ConflictException('Review request ID reused.');
        await this.actor(c, cookie, 'approve');
        return input;
      }
      if (head.head_version !== input.expectedVersion)
        throw new ConflictException('Review the latest governance revision.');
      const row = (
        await c.query(
          'SELECT actor_hash,payload FROM research_governance_versions WHERE id=$1 AND version=$2',
          [id, input.expectedVersion],
        )
      ).rows[0];
      const revision = ResearchGovernanceRevisionSchema.parse(row?.payload);
      if (row.actor_hash === actor)
        throw new ForbiddenException(
          'The author cannot approve their own material change.',
        );
      if (
        input.simulationId &&
        !(
          await c.query(
            'SELECT 1 FROM research_governance_simulations WHERE id=$1 AND release_id=$2 AND version=$3',
            [input.simulationId, id, input.expectedVersion],
          )
        ).rowCount
      )
        throw new ConflictException(
          'Simulation belongs to a different revision.',
        );
      if (input.decision === 'release') {
        await current(c, this.events, revision);
        const stored = (
          await c.query(
            'SELECT payload FROM research_governance_simulations WHERE id=$1 AND release_id=$2 AND version=$3',
            [input.simulationId, id, input.expectedVersion],
          )
        ).rows[0];
        const simulation = ResearchSimulationSchema.safeParse(stored?.payload);
        if (
          !simulation.success ||
          !simulation.data.passed ||
          JSON.stringify(simulation.data.checks) !==
            JSON.stringify(governanceChecks(revision))
        )
          throw new ConflictException(
            'Run and review a passing simulation for this exact draft.',
          );
      }
      await this.actor(c, cookie, 'approve');
      await c.query(
        'INSERT INTO research_governance_reviews(request_id,release_id,version,actor_hash,decision,reason,simulation_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          input.requestId,
          id,
          input.expectedVersion,
          actor,
          input.decision,
          input.reason,
          input.simulationId,
        ],
      );
      await c.query(
        "UPDATE research_governance_heads SET state=$2,published_version=CASE WHEN $2='released' THEN $3 ELSE published_version END,reviewed_at=clock_timestamp() WHERE id=$1",
        [
          id,
          input.decision === 'release' ? 'released' : 'withdrawn',
          input.expectedVersion,
        ],
      );
      return input;
    });
  }
  async list(query: unknown, cookie?: string) {
    const input = parse(z.strictObject({ after: z.uuid().optional() }), query);
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'read');
      const heads = await c.query(
        'SELECT * FROM research_governance_heads WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 51',
        [input.after ?? null],
      );
      const items = [];
      for (const head of heads.rows.slice(0, 50)) {
        const revision = ResearchGovernanceRevisionSchema.parse(
          (
            await c.query(
              'SELECT payload FROM research_governance_versions WHERE id=$1 AND version=$2',
              [head.id, head.head_version],
            )
          ).rows[0]?.payload,
        );
        const simulation =
          (
            await c.query(
              "SELECT payload FROM research_governance_simulations WHERE release_id=$1 AND version=$2 ORDER BY (payload->>'recordedAt') DESC LIMIT 1",
              [head.id, head.head_version],
            )
          ).rows[0]?.payload ?? null;
        const reviewReasons: string[] = [];
        let state =
          head.state === 'released' &&
          head.published_version !== head.head_version
            ? 'draft'
            : head.state;
        try {
          await current(c, this.events, revision);
        } catch (error) {
          if (!(error instanceof ConflictException)) throw error;
          state = 'unavailable';
          reviewReasons.push(
            'Current event/source admission no longer matches this revision.',
          );
        }
        items.push(
          ResearchGovernanceViewSchema.parse({
            revision,
            state,
            publishedVersion: head.published_version,
            reviewedAt: head.reviewed_at?.toISOString() ?? null,
            simulation,
            reviewReasons,
          }),
        );
      }
      await this.actor(c, cookie, 'read');
      return ResearchGovernanceListSchema.parse({
        items,
        next: heads.rows.length > 50 ? heads.rows[49].id : null,
      });
    });
  }
  async history(idValue: string, cookie?: string) {
    const id = parse(z.uuid(), idValue);
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'read');
      const versions = await c.query(
          'SELECT payload FROM research_governance_versions WHERE id=$1 ORDER BY version DESC LIMIT 100',
          [id],
        ),
        reviews = await c.query(
          'SELECT version,decision,reason,reviewed_at FROM research_governance_reviews WHERE release_id=$1 ORDER BY reviewed_at DESC LIMIT 100',
          [id],
        );
      await this.actor(c, cookie, 'read');
      return ResearchGovernanceHistorySchema.parse({
        versions: versions.rows.map((row) => row.payload),
        reviews: reviews.rows.map((row) => ({
          version: row.version,
          decision: row.decision,
          reason: row.reason,
          reviewedAt: row.reviewed_at.toISOString(),
        })),
      });
    });
  }
}
@OperatorRead()
@Controller('ops/research-governance')
export class ResearchGovernanceController {
  constructor(
    @Inject(ResearchGovernanceStore)
    private readonly store: ResearchGovernanceStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() list(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    return this.store.list(query, cookie);
  }
  @Get(':id/history') history(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.history(id, cookie);
  }
  @Put(':id') @OperatorAction('prepare') save(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    return this.store.save(id, body, cookie);
  }
  @Post(':id/simulations') @OperatorAction('prepare') simulate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    return this.store.simulate(id, body, cookie);
  }
  @Post(':id/reviews') @OperatorAction('approve') review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    return this.store.review(id, body, cookie);
  }
}

@Controller('research-governance')
export class ResearchGovernancePublicController {
  constructor(
    @Inject(ResearchGovernanceStore)
    private readonly store: ResearchGovernanceStore,
  ) {}
  @Get('snapshot') snapshot() {
    return this.store.snapshot();
  }
}
