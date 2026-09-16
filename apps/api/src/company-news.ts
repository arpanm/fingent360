import { canonicalSourceJson } from './canonical-source-json.js';
import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  CompanyNewsInputSchema,
  CompanyNewsReviewSchema,
  CompanyNewsQueueSchema,
  CompanyNewsProofSchema,
  companyNewsReasons,
  FeedItemSchema,
} from '@fingent360/contracts';
import type pg from 'pg';
import type { AppConfig } from './config.js';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
import { equityCompanyForTrace } from './equity-coverage.js';
import { sourceHash } from './discovery-provider.js';
const RAW = Symbol('COMPANY_NEWS_RAW');
const digest = (value: unknown) =>
  createHash('sha256').update(canonicalSourceJson(value)).digest('hex');
class CompanyNewsRaw {
  private readonly mongo: MongoClient;
  constructor(config: AppConfig) {
    this.mongo = new MongoClient(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
    });
  }
  async onApplicationShutdown() {
    await this.mongo.close();
  }
  async verify(hash: string) {
    const value = await this.mongo
      .db()
      .collection<{ _id: string; url: string; body: string }>('discovery_raw')
      .findOne({ _id: hash });
    return Boolean(value && sourceHash(value.url, value.body) === hash);
  }
  async retain(url: string, body: string, retrievedAt: string) {
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
export const companyNewsProvider = (config: AppConfig) => ({
  provide: RAW,
  useValue: new CompanyNewsRaw(config),
});
function parse<T>(schema: z.ZodType<T>, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new BadRequestException(
      'Complete the company, sources, source-specific permissions and verification fields.',
    );
  return parsed.data;
}
@OperatorRead()
@Controller('ops/company-news')
export class CompanyNewsController {
  constructor(
    @Inject(STORE) private readonly store: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(RAW) private readonly raw: CompanyNewsRaw,
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
      const result = await c.query(
        "SELECT n.*,i.version,v.data->>'status' AS state FROM company_news_inputs n JOIN discovery_items i ON i.id=n.item_id JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version ORDER BY n.created_at DESC,n.item_id LIMIT 101",
      );
      await this.actor(cookie, 'read', c);
      return CompanyNewsQueueSchema.parse({
        items: result.rows.slice(0, 100).map((row) => ({
          id: row.item_id,
          version: row.version,
          state: row.state,
          companyName: row.company_name,
          input: row.payload,
        })),
        truncated: result.rows.length > 100,
      });
    });
  }
  @Post('prepare')
  @OperatorAction('prepare')
  async prepare(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const data = parse(CompanyNewsInputSchema, body);
    await this.actor(cookie, 'prepare');
    const now = new Date().toISOString();
    if (
      data.citations.some(
        (row) => row.publishedAt > row.retrievedAt || row.retrievedAt > now,
      )
    )
      throw new BadRequestException(
        'Citation dates cannot be future or precede publication.',
      );
    const id = `company-news-${data.requestId}`,
      fingerprint = digest(data);
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        id,
      ]);
      const actor = await this.actor(cookie, 'prepare', c);
      const old = await c.query(
        'SELECT fingerprint FROM company_news_inputs WHERE item_id=$1',
        [id],
      );
      if (old.rows[0]) {
        if (old.rows[0].fingerprint !== fingerprint)
          throw new ConflictException(
            'Preparation ID already belongs to different evidence.',
          );
        return { id };
      }
      await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
      const company = await equityCompanyForTrace(c, data.isin);
      const identity = company.records.find(
        (row) =>
          row.observation.kind === 'identity' &&
          row.observation.exchange === 'NSE',
      );
      if (!identity)
        throw new BadRequestException(
          'Publish a reviewed NSE company identity before linking this report.',
        );
      const primary =
        data.citations.find((row) => row.primary) ?? data.citations[0]!;
      const hash = await this.raw.retain(
        primary.url,
        JSON.stringify(data),
        now,
      );
      const proof = CompanyNewsProofSchema.parse({
        policy: 'company-news-two-originators-v1',
        isin: data.isin,
        companyName: company.name,
        identityEditionId: identity.editionId,
        identityHash: identity.hash,
        checkedAt: now,
        basis: 'recorded-editor-and-reviewer-verification',
        sources: data.citations.map(
          ({
            name,
            url,
            originator,
            primary,
            independentReporting,
            publishedAt,
            retrievedAt,
            rightsMode,
          }) => ({
            name,
            url,
            originator,
            primary,
            independentReporting,
            publishedAt,
            retrievedAt,
            rightsMode,
          }),
        ),
      });
      const copied = data.copiedText
        ? `\n\nLicensed text from ${data.citations[data.copiedFrom!]!.name}:\n${data.copiedText}`
        : '';
      const item = FeedItemSchema.parse({
        id,
        version: 1,
        kind: 'news',
        title: data.title,
        summary: data.summary,
        body: `${data.summary}${copied}`,
        topics: ['India', 'Company news', company.name.slice(0, 80)],
        publishedAt: primary.publishedAt,
        effectiveLabel: `Company source dated ${primary.publishedAt.slice(0, 10)}`,
        source: {
          name: primary.name,
          url: primary.url,
          retrievedAt: now,
          rights: data.copiedText
            ? 'Source-specific full-text permission and offline scope recorded; original editorial summary.'
            : 'Original editorial summary and permission-reviewed links only; no copied article text.',
        },
        sourceHash: hash,
        importance: 2,
        relatedIds: [],
        status: 'draft',
        correctionNote: null,
        reviewedAt: null,
        companyNews: proof,
      });
      await c.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
        id,
      ]);
      await c.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
        [id, item],
      );
      await c.query(
        'INSERT INTO company_news_inputs(item_id,request_id,fingerprint,actor_id,company_name,payload) VALUES($1,$2,$3,$4,$5,$6)',
        [id, data.requestId, fingerprint, actor, company.name, data],
      );
      await this.actor(cookie, 'prepare', c);
      return { id };
    });
  }
  @Post('review')
  @OperatorAction('approve')
  async review(
    @Body() body: unknown,
    @Headers('cookie') cookie?: string,
    @Headers('origin') origin?: string,
  ) {
    this.ops.origin(origin);
    const data = parse(CompanyNewsReviewSchema, body);
    await this.actor(cookie, 'approve');
    return this.store.transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        data.requestId,
      ]);
      const found = await c.query(
        'SELECT n.*,i.version,v.data FROM company_news_inputs n JOIN discovery_items i ON i.id=n.item_id JOIN discovery_versions v ON v.item_id=i.id AND v.version=i.version WHERE n.item_id=$1 FOR UPDATE OF i',
        [data.id],
      );
      const actor = await this.actor(cookie, 'approve', c);
      if (!found.rows[0])
        throw new NotFoundException('Company report unavailable.');
      const previous = await c.query(
        'SELECT payload FROM company_news_reviews WHERE request_id=$1',
        [data.requestId],
      );
      if (previous.rows[0]) {
        if (digest(previous.rows[0].payload) !== digest(data))
          throw new ConflictException('Review ID already used.');
        return { id: data.id };
      }
      const row = found.rows[0];
      if (row.version !== data.expectedVersion)
        throw new ConflictException(
          'Report changed; reload its current review.',
        );
      const input = CompanyNewsInputSchema.parse(row.payload);
      if (data.decision === 'publish') {
        if (
          !row.data.sourceHash ||
          !(await this.raw.verify(row.data.sourceHash))
        )
          throw new ConflictException(
            'Retained original evidence is unavailable or changed.',
          );
        if (!this.ops.namedMode)
          throw new ForbiddenException(
            'Publishing company news requires named operators and an independent reviewer.',
          );
        if (!data.corroborationConfirmed || !data.rightsConfirmed)
          throw new BadRequestException(
            'Review both independent corroboration and source-specific rights.',
          );
        if (this.ops.namedMode && row.actor_id === actor)
          throw new ForbiddenException(
            'Another named operator must review this report.',
          );
        const reasons = companyNewsReasons(input, new Date().toISOString());
        if (reasons.length) throw new BadRequestException(reasons.join(' '));
        await c.query('LOCK TABLE equity_reviews IN SHARE MODE');
        const admitted = await equityCompanyForTrace(c, input.isin);
        const currentIdentity = admitted.records.find(
          (record) =>
            record.observation.kind === 'identity' &&
            record.observation.exchange === 'NSE',
        );
        const retainedProof = CompanyNewsProofSchema.parse(
          row.data.companyNews,
        );
        if (
          !currentIdentity ||
          currentIdentity.editionId !== retainedProof.identityEditionId ||
          currentIdentity.hash !== retainedProof.identityHash
        )
          throw new ConflictException(
            'Company identity changed or was withdrawn. Prepare a new report against the current reviewed identity.',
          );
      }
      const item = FeedItemSchema.parse({
        ...row.data,
        version: row.version + 1,
        status: data.decision === 'publish' ? 'published' : 'withdrawn',
        correctionNote: data.reason,
        reviewedAt: new Date().toISOString(),
      });
      await c.query(
        'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,$2,$3)',
        [data.id, item.version, item],
      );
      await c.query('UPDATE discovery_items SET version=$2 WHERE id=$1', [
        data.id,
        item.version,
      ]);
      await c.query(
        'INSERT INTO company_news_reviews(request_id,item_id,actor_id,payload) VALUES($1,$2,$3,$4)',
        [data.requestId, data.id, actor, data],
      );
      await this.actor(cookie, 'approve', c);
      return { id: data.id };
    });
  }
}
