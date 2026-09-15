import { MongoClient } from 'mongodb';
import { sourceHash } from './discovery-provider.js';
import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import {
  AutoPublicationInputSchema,
  AutoPublicationPolicySchema,
  AutoPublicationPoliciesSchema,
  AutoPublicationSourceSchema,
  FeedItemSchema,
} from '@fingent360/contracts';
import type { AppConfig } from './config.js';
import { researchSources } from './research-providers.js';
import { DiscoveryStore } from './discovery.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { requireNamed, operatorCookieHash } from './named-operator-store.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
export const RESEARCH_AUTO_POLICY = Symbol('RESEARCH_AUTO_POLICY');
export function automaticRightsFingerprint(sourceId: string) {
  const source = researchSources.find(
    (s) => s.id === sourceId && s.access === 'enabled',
  );
  if (!source || !AutoPublicationSourceSchema.safeParse(sourceId).success)
    throw new BadRequestException(
      'This adapter is not eligible for automatic news publication.',
    );
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 'fixed-official-news-v1',
        id: source.id,
        url: source.feedUrl,
        terms: source.termsUrl,
        rights: source.rights,
      }),
    )
    .digest('hex');
}
export class ResearchAutoPolicyStore {
  private readonly pool: pg.Pool;
  private readonly mongo: MongoClient;
  constructor(
    private readonly config: AppConfig,
    private readonly discovery: DiscoveryStore,
  ) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {});
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await Promise.allSettled([this.pool.end(), this.mongo.close()]);
  }
  private async transaction<T>(fn: (c: pg.PoolClient) => Promise<T>) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const value = await fn(c);
      await c.query('COMMIT');
      return value;
    } catch (error) {
      await c.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      c.release();
    }
  }
  async list() {
    const rows = await this.pool.query<{
      payload: unknown;
      approval: unknown | null;
      active: boolean;
    }>(
      `SELECT p.payload,a.payload AS approval,(h.plan_id=p.id) AS active FROM research_publication_plans p LEFT JOIN research_publication_approvals a ON a.plan_id=p.id LEFT JOIN research_publication_heads h ON h.source_id=p.source_id ORDER BY p.payload->>'createdAt' DESC LIMIT 100`,
    );
    return AutoPublicationPoliciesSchema.parse({
      policies: rows.rows.map((r) => ({
        ...AutoPublicationPolicySchema.parse(r.approval ?? r.payload),
        state: r.approval ? (r.active ? 'active' : 'superseded') : 'pending',
      })),
      eligibleSources: researchSources
        .filter(
          (s) =>
            s.access === 'enabled' &&
            AutoPublicationSourceSchema.safeParse(s.id).success,
        )
        .map((s) => ({
          id: s.id,
          name: s.name,
          termsUrl: s.termsUrl,
          rights: s.rights,
        })),
    });
  }
  private async authority(
    c: pg.PoolClient,
    ops: OperatorStore,
    cookie: string | undefined,
    permission: 'prepare' | 'approve',
  ) {
    if (this.config.OPS_AUTH_MODE === 'named') {
      const actor = await requireNamed(
        c,
        operatorCookieHash(cookie),
        permission,
        true,
      );
      return { id: actor.identity.id, version: actor.identity.version };
    }
    await ops.permission(cookie, permission);
    return null;
  }
  async prepare(body: unknown, ops: OperatorStore, cookie?: string) {
    const parsed = AutoPublicationInputSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Review source rights, version, expiry and a policy note.',
      );
    const input = parsed.data;
    if (
      Date.parse(input.expiresAt) <= Date.now() ||
      Date.parse(input.expiresAt) > Date.now() + 30 * 86400000
    )
      throw new BadRequestException(
        'Policy expiry must be within the next30 days.',
      );
    return this.transaction(async (c) => {
      const proposer = await this.authority(c, ops, cookie, 'prepare');
      await c.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,360955))',
        [input.sourceId],
      );
      const old = (
        await c.query<{ payload: unknown }>(
          'SELECT payload FROM research_publication_plans WHERE id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (old) {
        const value = AutoPublicationPolicySchema.parse(old.payload);
        if (
          value.sourceId !== input.sourceId ||
          value.version !== input.expectedVersion + 1 ||
          value.enabled !== input.enabled ||
          value.expiresAt !== input.expiresAt ||
          value.note !== input.note ||
          value.proposer?.id !== proposer?.id
        )
          throw new ConflictException('Policy request ID already used.');
        return value;
      }
      const head = (
        await c.query<{ version: number }>(
          'SELECT version FROM research_publication_heads WHERE source_id=$1 FOR UPDATE',
          [input.sourceId],
        )
      ).rows[0];
      if ((head?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException('Policy changed; reload before proposing.');
      const value = AutoPublicationPolicySchema.parse({
        id: input.requestId,
        sourceId: input.sourceId,
        version: input.expectedVersion + 1,
        enabled: input.enabled,
        expiresAt: input.expiresAt,
        rightsFingerprint: automaticRightsFingerprint(input.sourceId),
        note: input.note,
        proposer,
        approver: null,
        createdAt: new Date().toISOString(),
        approvedAt: null,
        state: 'pending',
      });
      await c.query(
        'INSERT INTO research_publication_plans(id,source_id,payload) VALUES($1,$2,$3::jsonb)',
        [value.id, value.sourceId, JSON.stringify(value)],
      );
      await this.authority(c, ops, cookie, 'prepare');
      return value;
    });
  }
  async approve(id: string, ops: OperatorStore, cookie?: string) {
    if (!/^[a-f0-9-]{36}$/.test(id))
      throw new BadRequestException('Invalid policy ID.');
    return this.transaction(async (c) => {
      const approver = await this.authority(c, ops, cookie, 'approve');
      const row = (
        await c.query<{ payload: unknown }>(
          'SELECT payload FROM research_publication_plans WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (!row) throw new BadRequestException('Policy unavailable.');
      const plan = AutoPublicationPolicySchema.parse(row.payload);
      if (approver && approver.id === plan.proposer?.id)
        throw new ConflictException(
          'A different named publisher must approve this policy.',
        );
      await c.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,360955))',
        [plan.sourceId],
      );
      const previous = (
        await c.query<{ payload: unknown }>(
          'SELECT payload FROM research_publication_approvals WHERE plan_id=$1',
          [id],
        )
      ).rows[0];
      if (previous) return AutoPublicationPolicySchema.parse(previous.payload);
      const head = (
        await c.query<{ version: number }>(
          'SELECT version FROM research_publication_heads WHERE source_id=$1 FOR UPDATE',
          [plan.sourceId],
        )
      ).rows[0];
      if (
        (head?.version ?? 0) !== plan.version - 1 ||
        plan.rightsFingerprint !== automaticRightsFingerprint(plan.sourceId) ||
        Date.parse(plan.expiresAt) <= Date.now()
      )
        throw new ConflictException(
          'Policy basis changed or expired. Prepare a fresh version.',
        );
      if (plan.proposer) {
        const author = (
          await c.query(
            "SELECT id FROM named_operators WHERE id=$1 AND version=$2 AND enabled AND role IN ('researcher','admin') FOR SHARE",
            [plan.proposer.id, plan.proposer.version],
          )
        ).rows[0];
        if (!author)
          throw new ConflictException('Policy author authority changed.');
      }
      const value = AutoPublicationPolicySchema.parse({
        ...plan,
        approver,
        approvedAt: new Date().toISOString(),
        state: 'active',
      });
      await c.query(
        'INSERT INTO research_publication_approvals(plan_id,payload) VALUES($1,$2::jsonb)',
        [id, JSON.stringify(value)],
      );
      await c.query(
        'INSERT INTO research_publication_heads(source_id,version,plan_id,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(source_id) DO UPDATE SET version=excluded.version,plan_id=excluded.plan_id,payload=excluded.payload',
        [value.sourceId, value.version, id, JSON.stringify(value)],
      );
      await this.authority(c, ops, cookie, 'approve');
      return value;
    });
  }
  async admitted(c: pg.PoolClient, sourceId: string) {
    const row = (
      await c.query<{ payload: unknown }>(
        'SELECT payload FROM research_publication_heads WHERE source_id=$1 FOR SHARE',
        [sourceId],
      )
    ).rows[0];
    if (!row) return null;
    const policy = AutoPublicationPolicySchema.parse(row.payload);
    if (
      !policy.enabled ||
      Date.parse(policy.expiresAt) <= Date.now() ||
      policy.rightsFingerprint !== automaticRightsFingerprint(sourceId)
    )
      return null;
    if (this.config.OPS_AUTH_MODE === 'named') {
      if (
        !policy.proposer ||
        !policy.approver ||
        policy.proposer.id === policy.approver.id
      )
        return null;
      for (const [authority, roles] of [
        [policy.proposer, ['researcher', 'admin']],
        [policy.approver, ['publisher', 'admin']],
      ] as const) {
        const permitted = await c.query(
          'SELECT id FROM named_operators WHERE id=$1 AND version=$2 AND enabled AND role=ANY($3::text[]) FOR SHARE',
          [authority.id, authority.version, roles],
        );
        if (!permitted.rowCount) return null;
      }
    }
    return policy;
  }
  async publish(sourceId: string, runId: string) {
    if (!AutoPublicationSourceSchema.safeParse(sourceId).success)
      return {
        published: 0,
        excluded: 0,
        message: 'Source requires ordinary publication review.',
      };
    const policy = await this.transaction((c) => this.admitted(c, sourceId));
    if (!policy)
      return {
        published: 0,
        excluded: 0,
        message: 'No active approved publication policy. Drafts await review.',
      };
    const candidates = await this.pool.query<{
      item_id: string;
      version: number;
      data: unknown;
    }>(
      `SELECT v.item_id,v.version,v.data FROM discovery_items i JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version LEFT JOIN LATERAL (SELECT created_at FROM research_publication_receipts r WHERE r.plan_id=$2 AND r.item_id=v.item_id AND r.item_version=v.version ORDER BY created_at DESC,id DESC LIMIT 1) attempted ON true WHERE i.id LIKE $1 AND v.data->>'status'='draft' ORDER BY attempted.created_at ASC NULLS FIRST,i.id COLLATE "C" ASC LIMIT 50`,
      [sourceId + '-%', policy.id],
    );
    let published = 0,
      excluded = 0;
    const reasons: string[] = [];
    const exclude = async (
      itemId: string,
      version: number,
      message: string,
    ) => {
      excluded++;
      reasons.push(message);
      await this.pool.query(
        "INSERT INTO research_publication_receipts(id,run_id,plan_id,item_id,item_version,status,message) VALUES($1,$2,$3,$4,$5,'excluded',$6) ON CONFLICT DO NOTHING",
        [randomUUID(), runId, policy.id, itemId, version, message],
      );
    };
    for (const candidate of candidates.rows) {
      const parsed = FeedItemSchema.safeParse(candidate.data);
      if (
        !parsed.success ||
        parsed.data.id !== candidate.item_id ||
        parsed.data.version !== candidate.version
      ) {
        await exclude(
          candidate.item_id,
          candidate.version,
          'Stored source draft fails its current schema or version binding.',
        );
        continue;
      }
      const item = parsed.data;
      if (
        item.kind !== 'news' ||
        !item.sourceHash ||
        !item.source.url.startsWith('https://')
      ) {
        await exclude(
          item.id,
          item.version,
          'Missing official news identity or source hash.',
        );
        continue;
      }
      try {
        const raw = await this.mongo
          .db()
          .collection<{ _id: string; url: string; body: string }>(
            'discovery_raw',
          )
          .findOne({ _id: item.sourceHash });
        const descriptor = researchSources.find((s) => s.id === sourceId)!;
        const allowed =
          raw &&
          new URL(item.source.url).hostname ===
            new URL(descriptor.homeUrl).hostname &&
          (raw.url === descriptor.feedUrl ||
            (sourceId === 'pib' &&
              new URL(raw.url).origin === 'https://www.pib.gov.in' &&
              new URL(raw.url).pathname === '/PressReleasePage.aspx'));
        if (
          !raw ||
          !allowed ||
          sourceHash(raw.url, raw.body) !== item.sourceHash
        ) {
          await exclude(
            item.id,
            item.version,
            'Retained official source bytes or hash could not be verified.',
          );
          continue;
        }
        await this.discovery.review(
          item.id,
          {
            expectedVersion: item.version,
            status: 'published',
            correctionNote: `Automatic official-source publication under policy ${policy.id}, version ${policy.version}. ${policy.note}`,
          },
          async () => undefined,
          async (c) => {
            const latest = await this.admitted(c, sourceId);
            if (!latest || latest.id !== policy.id)
              throw new ConflictException(
                'Publication policy changed during review.',
              );
            await c.query(
              "INSERT INTO research_publication_receipts(id,run_id,plan_id,item_id,item_version,status,message) VALUES($1,$2,$3,$4,$5,'published','Fixed-source draft admitted under reviewed policy.')",
              [randomUUID(), runId, policy.id, item.id, item.version + 1],
            );
          },
        );
        published++;
      } catch {
        await exclude(
          item.id,
          item.version,
          'Source version, policy authority or storage changed before publication.',
        );
      }
    }
    return {
      published,
      excluded,
      message: `${published} official stories published; ${excluded} drafts excluded or changed. ${[...new Set(reasons)].join(' ')} At most50 source drafts per run; untried drafts first, then least-recently attempted retries.`,
    };
  }
}
@OperatorRead()
@Controller('ops/research-auto/policies')
export class ResearchAutoPolicyController {
  constructor(
    @Inject(RESEARCH_AUTO_POLICY)
    private readonly store: ResearchAutoPolicyStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() async list(@Headers('cookie') cookie?: string) {
    await this.ops.require(cookie);
    const value = await this.store.list();
    await this.ops.require(cookie);
    return value;
  }
  @Post() @OperatorAction('prepare') async prepare(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const value = await this.store.prepare(body, this.ops, cookie);
    await this.ops.record(
      'research.publication.policy.proposed',
      value.id,
      cookie,
    );
    return value;
  }
  @Post(':id/approve') @OperatorAction('approve') async approve(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const value = await this.store.approve(id, this.ops, cookie);
    await this.ops.record(
      'research.publication.policy.approved',
      value.id,
      cookie,
    );
    return value;
  }
}
