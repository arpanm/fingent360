import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedItemSchema,
  institutionalFlowLines,
  InstitutionalFlowInputSchema,
  InstitutionalFlowReviewSchema,
  InstitutionalFlowEditionSchema,
  InstitutionalFlowPublicSchema,
  InstitutionalFlowQueueSchema,
  InstitutionalFlowCaptureSchema,
  parseInstitutionalFlows,
} from '@fingent360/contracts';
import type pg from 'pg';
import type { AppConfig } from './config.js';
import { sourceHash as discoverySourceHash } from './discovery-provider.js';
import { canonicalSourceJson } from './canonical-source-json.js';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
const digest = (value: unknown) =>
    createHash('sha256').update(canonicalSourceJson(value)).digest('hex'),
  RAW = Symbol('INSTITUTIONAL_FLOWS_RAW');
class InstitutionalFlowRaw {
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await this.mongo.close();
  }
  async retain(value: unknown) {
    const hash = digest(value);
    await this.mongo
      .db()
      .collection<{ _id: string; value: unknown }>('institutional_flow_raw')
      .updateOne({ _id: hash }, { $setOnInsert: { value } }, { upsert: true });
    return hash;
  }
  async discoveryOriginal(url: string, body: string, retrievedAt: string) {
    const hash = discoverySourceHash(url, body);
    await this.mongo
      .db()
      .collection<{
        _id: string;
        url: string;
        body: string;
        retrievedAt: string;
      }>('discovery_raw')
      .updateOne(
        { _id: hash },
        { $setOnInsert: { url, body, retrievedAt } },
        { upsert: true },
      );
    return hash;
  }
  async read(hash: string) {
    const row = await this.mongo
      .db()
      .collection<{ _id: string; value: unknown }>('institutional_flow_raw')
      .findOne({ _id: hash });
    if (!row || digest(row.value) !== hash)
      throw new ConflictException(
        'Original Flow capture is unavailable or changed.',
      );
    return row.value;
  }
}
export const institutionalFlowProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new InstitutionalFlowRaw(config),
});
export async function institutionalFlowSnapshot(c: pg.PoolClient) {
  await c.query('LOCK TABLE institutional_flow_reviews IN SHARE MODE');
  const result = await c.query(
    "SELECT head.receipt,latest.created_at FROM(SELECT DISTINCT ON(e.receipt->>'source') e.id,e.receipt FROM institutional_flow_editions e JOIN institutional_flow_reviews r ON r.edition_id=e.id WHERE e.receipt IS NOT NULL AND r.payload->>'decision'='publish' ORDER BY e.receipt->>'source' DESC,r.seq DESC) head JOIN LATERAL(SELECT payload,created_at FROM institutional_flow_reviews WHERE edition_id=head.id ORDER BY seq DESC LIMIT 1) latest ON true WHERE latest.payload->>'decision'='publish' ORDER BY head.receipt->>'source' DESC LIMIT 100",
  );
  return InstitutionalFlowPublicSchema.parse({
    editions: result.rows.map((row) => ({
      ...row.receipt,
      reviewedAt: row.created_at.toISOString(),
    })),
    capturedAt: new Date().toISOString(),
  });
}
@Controller('institutional-flows')
export class InstitutionalFlowController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() list() {
    return this.store.transaction((c) => institutionalFlowSnapshot(c));
  }
}
@OperatorRead()
@Controller('ops/institutional-flows')
export class InstitutionalFlowOperationsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: InstitutionalFlowRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const identity = await this.ops.permission(cookie, permission, c);
    return typeof identity === 'string' ? identity : identity.identity.id;
  }
  @Get() async queue(@Headers('cookie') cookie?: string) {
    await this.actor(cookie, 'read');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        "SELECT e.id,e.source_hash,e.error,e.receipt,CASE WHEN e.error IS NOT NULL THEN 'quarantined' ELSE COALESCE((SELECT payload->>'decision' FROM institutional_flow_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1),'draft') END AS state FROM institutional_flow_editions e ORDER BY e.created_at DESC,e.id LIMIT 100",
      );
      await this.actor(cookie, 'read', c);
      return InstitutionalFlowQueueSchema.parse(rows.rows);
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.actor(cookie, 'read');
    if (!z.uuid().safeParse(id).success)
      throw new BadRequestException('Invalid capture ID.');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        'SELECT source_hash FROM institutional_flow_editions WHERE id=$1',
        [id],
      );
      if (!rows.rows[0])
        throw new NotFoundException('Flow capture unavailable.');
      const value = await this.raw.read(rows.rows[0].source_hash);
      await this.actor(cookie, 'read', c);
      return value;
    });
  }
  @Post('capture') @OperatorAction('prepare') async capture(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = InstitutionalFlowInputSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Upload the original dated source file and confirm usage permission.',
      );
    const input = parsed.data;
    await this.actor(cookie, 'prepare');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const actor = await this.actor(cookie, 'prepare', c),
        old = await c.query(
          'SELECT fingerprint,error FROM institutional_flow_editions WHERE id=$1',
          [input.requestId],
        );
      if (old.rows[0]) {
        if (old.rows[0].fingerprint !== digest(input))
          throw new ConflictException('Capture request ID already used.');
        return InstitutionalFlowCaptureSchema.parse({
          id: input.requestId,
          state: old.rows[0].error ? 'quarantined' : 'retained',
          reason: old.rows[0].error,
        });
      }
      const hash = await this.raw.retain(input);
      let receipt: ReturnType<
          typeof InstitutionalFlowEditionSchema.parse
        > | null = null,
        error: string | null = null;
      try {
        receipt = parseInstitutionalFlows(
          input,
          hash,
          new Date().toISOString(),
          createHash('sha256').update(input.body).digest('hex'),
        );
      } catch (cause) {
        error = (
          cause instanceof Error ? cause.message : 'Unsupported Flow capture.'
        ).slice(0, 2000);
      }
      await c.query(
        'INSERT INTO institutional_flow_editions(id,actor_id,fingerprint,source_hash,input,receipt,error) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          input.requestId,
          actor,
          digest(input),
          hash,
          {
            source: input.source,
            rightsEvidence: input.rightsEvidence,
            rightsConfirmed: input.rightsConfirmed,
          },
          receipt,
          error,
        ],
      );
      await this.actor(cookie, 'prepare', c);
      return InstitutionalFlowCaptureSchema.parse({
        id: input.requestId,
        state: error ? 'quarantined' : 'retained',
        reason: error,
      });
    });
  }
  @Post('review') @OperatorAction('approve') async review(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = InstitutionalFlowReviewSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Complete the independent review.');
    const input = parsed.data;
    await this.actor(cookie, 'approve');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        input.requestId,
      ]);
      const actor = await this.actor(cookie, 'approve', c),
        previous = await c.query(
          'SELECT payload,actor_id FROM institutional_flow_reviews WHERE request_id=$1',
          [input.requestId],
        );
      if (previous.rows[0]) {
        if (
          previous.rows[0].actor_id !== actor ||
          digest(previous.rows[0].payload) !== digest(input)
        )
          throw new ConflictException('Review request ID already used.');
        return input;
      }
      const found = await c.query(
          'SELECT * FROM institutional_flow_editions WHERE id=$1',
          [input.id],
        ),
        row = found.rows[0];
      if (!row || !row.receipt)
        throw new NotFoundException('No supported Flow edition to review.');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'flow-source:' + row.receipt.source,
      ]);
      if (input.decision === 'publish') {
        if (
          !this.ops.namedMode ||
          row.actor_id === actor ||
          !input.rightsVerified
        )
          throw new ForbiddenException(
            'A different named reviewer must verify original source and retention/display/offline permission.',
          );
        const raw = await this.raw.read(row.source_hash),
          receipt = InstitutionalFlowEditionSchema.parse(row.receipt);
        if (
          digest(
            parseInstitutionalFlows(
              raw,
              row.source_hash,
              receipt.retrievedAt,
              createHash('sha256')
                .update(InstitutionalFlowInputSchema.parse(raw).body)
                .digest('hex'),
            ),
          ) !== digest(receipt)
        )
          throw new ConflictException(
            'Flow edition does not reconstruct from its original capture.',
          );
      }
      // Source review also governs its derived reading/event evidence. Never fabricate a source release time.
      const now = new Date().toISOString(),
        sourceId = 'institutional-flow-' + input.id;
      const older = await c.query(
        "SELECT i.id,i.version,v.data FROM discovery_items i JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version WHERE i.id LIKE 'institutional-flow-%' AND v.data->'source'->>'url'=$1 ORDER BY i.id FOR UPDATE OF i",
        [row.receipt.sourceUrl],
      );
      for (const old of older.rows) {
        if (
          old.data.status === 'published' &&
          (input.decision === 'publish' || old.id === sourceId)
        ) {
          const withdrawn = FeedItemSchema.parse({
            ...old.data,
            version: old.version + 1,
            status: 'withdrawn',
            reviewedAt: now,
            correctionNote:
              input.decision === 'publish'
                ? 'Superseded by a newer independently reviewed source capture.'
                : input.reason,
          });
          await c.query(
            'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
            [old.id, withdrawn.version, withdrawn],
          );
          await c.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
            old.id,
            withdrawn.version,
          ]);
        }
      }
      if (input.decision === 'publish') {
        const edition = InstitutionalFlowEditionSchema.parse(row.receipt),
          original = InstitutionalFlowInputSchema.parse(
            await this.raw.read(row.source_hash),
          ),
          sourceHash = await this.raw.discoveryOriginal(
            edition.sourceUrl,
            original.body,
            edition.retrievedAt,
          );
        const existing = await c.query(
          'SELECT version FROM discovery_items WHERE id=$1 FOR UPDATE',
          [sourceId],
        );
        const version = (existing.rows[0]?.version ?? 0) + 1;
        const notice =
          'Editorial summary published at review time; source publication time is unknown. Report dates below retain their original basis. No inferred portfolio effect.';
        const lines = institutionalFlowLines(edition);
        const item = FeedItemSchema.parse({
          id: sourceId,
          version,
          kind: 'news',
          title:
            edition.source === 'nse-cash-html'
              ? 'Reviewed exchange institutional cash activity'
              : 'Reviewed depository investment reports',
          summary: notice,
          body: notice + '\n' + lines.join('\n'),
          topics: ['India', 'Institutional flows'],
          publishedAt: now,
          effectiveLabel:
            'Separate report dates: ' +
            edition.datasets.map((d) => d.effectiveOn).join(' / '),
          source: {
            name: edition.source === 'nse-cash-html' ? 'NSE' : 'CDSL',
            url: edition.sourceUrl,
            retrievedAt: edition.retrievedAt,
            rights:
              'Retention, display and offline permission independently attested in the source review.',
          },
          sourceHash,
          importance: 1,
          relatedIds: [],
          status: 'published',
          reviewedAt: now,
          correctionNote: input.reason,
        });
        if (!existing.rows.length)
          await c.query(
            'INSERT INTO discovery_items(id,version) VALUES($1,$2)',
            [sourceId, version],
          );
        else
          await c.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
            sourceId,
            version,
          ]);
        await c.query(
          'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
          [sourceId, version, item],
        );
      }
      await c.query(
        'INSERT INTO institutional_flow_reviews(request_id,edition_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, input.id, actor, input],
      );
      await this.actor(cookie, 'approve', c);
      return input;
    });
  }
}
