import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import type pg from 'pg';
import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Headers,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedItemSchema,
  OilEducationCaptureSchema,
  OilEducationReviewSchema,
  OilEducationSourceReceiptSchema,
  OilEducationQueueSchema,
  parseOilEducationSource,
} from '@fingent360/contracts';
import { sourceHash } from './discovery-provider.js';
import { canonicalSourceJson } from './canonical-source-json.js';
import { STORE, AccountStore } from './accounts.js';
import { OPERATOR_STORE, OperatorStore } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import type { AppConfig } from './config.js';
const RAW = Symbol('OIL_EDUCATION_RAW'),
  digest = (value: unknown) =>
    createHash('sha256').update(canonicalSourceJson(value)).digest('hex');
class OilEducationRaw {
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
      .collection<{ _id: string; value: unknown }>('oil_education_raw')
      .updateOne({ _id: hash }, { $setOnInsert: { value } }, { upsert: true });
    return hash;
  }
  async read(hash: string) {
    const row = await this.mongo
      .db()
      .collection<{ _id: string; value: unknown }>('oil_education_raw')
      .findOne({ _id: hash });
    if (!row || digest(row.value) !== hash)
      throw new ConflictException(
        'Original oil education source is unavailable or changed.',
      );
    return OilEducationCaptureSchema.parse(row.value);
  }
  async stageOriginal(url: string, body: string, retrievedAt: string) {
    const hash = sourceHash(url, body);
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
}
export const oilEducationProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new OilEducationRaw(config),
});
@OperatorRead()
@Controller('ops/oil-education')
export class OilEducationController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: OilEducationRaw,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const result = await this.ops.permission(cookie, permission, c);
    return typeof result === 'string' ? result : result.identity.id;
  }
  @Get() async queue(@Headers('cookie') cookie?: string) {
    await this.actor(cookie, 'read');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        "SELECT s.id,s.receipt,s.error,CASE WHEN s.error IS NOT NULL THEN 'quarantined' ELSE COALESCE((SELECT payload->>'decision' FROM oil_education_reviews WHERE edition_id=s.id ORDER BY seq DESC LIMIT 1),'draft') END AS state FROM oil_education_sources s ORDER BY created_at DESC,id LIMIT 100",
      );
      await this.actor(cookie, 'read', c);
      return OilEducationQueueSchema.parse(rows.rows);
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') rawId: string,
    @Headers('cookie') cookie?: string,
  ) {
    await this.actor(cookie, 'read');
    const id = z.uuid().safeParse(rawId);
    if (!id.success) throw new BadRequestException('Invalid source ID.');
    return this.store.transaction(async (c) => {
      const rows = await c.query(
        'SELECT source_hash FROM oil_education_sources WHERE id=$1',
        [id.data],
      );
      if (!rows.rows[0]) throw new NotFoundException('Source not found.');
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
    const parsed = OilEducationCaptureSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        'Choose the original issuer HTML and record retention/display/offline permission.',
      );
    const input = parsed.data;
    await this.actor(cookie, 'prepare');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'oil-capture:' + input.requestId,
      ]);
      const actor = await this.actor(cookie, 'prepare', c),
        existing = await c.query(
          'SELECT fingerprint,error FROM oil_education_sources WHERE id=$1',
          [input.requestId],
        );
      if (existing.rows[0]) {
        if (existing.rows[0].fingerprint !== digest(input))
          throw new ConflictException('Capture ID already used.');
        return {
          id: input.requestId,
          state: existing.rows[0].error ? 'quarantined' : 'draft',
        };
      }
      const hash = await this.raw.retain(input);
      let receipt: ReturnType<
          typeof OilEducationSourceReceiptSchema.parse
        > | null = null,
        error: string | null = null;
      try {
        receipt = parseOilEducationSource(
          input,
          hash,
          createHash('sha256').update(input.body).digest('hex'),
          new Date().toISOString(),
        );
      } catch (cause) {
        error = (
          cause instanceof Error ? cause.message : 'Unsupported original.'
        ).slice(0, 2000);
      }
      await c.query(
        'INSERT INTO oil_education_sources(id,actor_id,fingerprint,source_hash,receipt,error) VALUES($1,$2,$3,$4,$5,$6)',
        [input.requestId, actor, digest(input), hash, receipt, error],
      );
      await this.actor(cookie, 'prepare', c);
      return { id: input.requestId, state: error ? 'quarantined' : 'draft' };
    });
  }
  @Post('review') @OperatorAction('approve') async review(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const parsed = OilEducationReviewSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Complete the independent source review.');
    const input = parsed.data;
    await this.actor(cookie, 'approve');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'oil-education-review',
      ]);
      const actor = await this.actor(cookie, 'approve', c),
        old = await c.query(
          'SELECT payload,actor_id FROM oil_education_reviews WHERE request_id=$1',
          [input.requestId],
        );
      if (old.rows[0]) {
        if (
          old.rows[0].actor_id !== actor ||
          digest(old.rows[0].payload) !== digest(input)
        )
          throw new ConflictException('Review ID already used.');
        return input;
      }
      const rows = await c.query(
          'SELECT * FROM oil_education_sources WHERE id=$1',
          [input.id],
        ),
        row = rows.rows[0];
      if (!row?.receipt)
        throw new NotFoundException('Supported original source unavailable.');
      const receipt = OilEducationSourceReceiptSchema.parse(row.receipt);
      let original: ReturnType<typeof OilEducationCaptureSchema.parse> | null =
        null;
      if (input.decision === 'publish') {
        if (
          !this.ops.namedMode ||
          actor === row.actor_id ||
          !input.rightsVerified
        )
          throw new ForbiddenException(
            'A different named reviewer must verify original evidence and storage/display/offline rights.',
          );
        original = await this.raw.read(row.source_hash);
        if (
          digest(
            parseOilEducationSource(
              original,
              row.source_hash,
              createHash('sha256').update(original.body).digest('hex'),
              receipt.retrievedAt,
            ),
          ) !== digest(receipt)
        )
          throw new ConflictException(
            'Source extraction does not reconstruct.',
          );
      }
      const id = 'oil-education-' + input.id,
        now = new Date().toISOString(),
        existing = await c.query(
          "SELECT i.id,i.version,v.data FROM discovery_items i JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version WHERE i.id LIKE 'oil-education-%' ORDER BY i.id FOR UPDATE OF i",
        );
      for (const source of existing.rows) {
        if (
          source.data.status === 'published' &&
          (input.decision === 'publish' || source.id === id)
        ) {
          const next = FeedItemSchema.parse({
            ...source.data,
            version: source.version + 1,
            status: 'withdrawn',
            reviewedAt: now,
            correctionNote: input.reason,
          });
          await c.query(
            'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
            [source.id, next.version, next],
          );
          await c.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
            source.id,
            next.version,
          ]);
        }
      }
      if (original) {
        const hash = await this.raw.stageOriginal(
            receipt.sourceUrl,
            original.body,
            receipt.retrievedAt,
          ),
          head = await c.query(
            'SELECT version FROM discovery_items WHERE id=$1 FOR UPDATE',
            [id],
          ),
          version = (head.rows[0]?.version ?? 0) + 1;
        const text =
          'Issuer report dated 1 April 2026: aviation fuel costs and incomplete fare pass-through. This editorial excerpt was published at review time; the original release time is unknown. No share-price effect is inferred.';
        const item = FeedItemSchema.parse({
          id,
          version,
          kind: 'news',
          title: 'IndiGo: fuel costs and incomplete fare pass-through',
          summary: text,
          body: text + '\n' + receipt.anchor,
          topics: ['India', 'Airlines', 'Energy costs'],
          publishedAt: now,
          effectiveLabel:
            'Issuer report date 2026-04-01; exact release time unknown',
          source: {
            name: 'InterGlobe Aviation / IndiGo',
            url: receipt.sourceUrl,
            retrievedAt: receipt.retrievedAt,
            rights:
              'Original retention/display/offline scope independently attested; no general issuer permission inferred.',
          },
          sourceHash: hash,
          importance: 1,
          relatedIds: [],
          status: 'published',
          reviewedAt: now,
          correctionNote: input.reason,
        });
        if (!head.rows.length)
          await c.query(
            'INSERT INTO discovery_items(id,version) VALUES($1,$2)',
            [id, version],
          );
        else
          await c.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
            id,
            version,
          ]);
        await c.query(
          'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
          [id, version, item],
        );
      }
      await c.query(
        'INSERT INTO oil_education_reviews(request_id,edition_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [input.requestId, input.id, actor, input],
      );
      await this.actor(cookie, 'approve', c);
      return input;
    });
  }
}
