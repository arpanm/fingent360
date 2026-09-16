import { canonicalSourceJson } from './canonical-source-json.js';
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
} from '@nestjs/common';
import { z } from 'zod';
import type pg from 'pg';
import {
  ClassificationCrosswalkSnapshotSchema,
  ClassificationCrosswalkDraftSchema,
  ClassificationCrosswalkRevisionSchema,
  ClassificationCrosswalkReviewSchema,
  ClassificationCrosswalkListSchema,
  ClassificationCrosswalkHistorySchema,
  ClassificationCrosswalkPublicSchema,
  type ClassificationCrosswalkRevision,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
import { equityCompanyForTrace } from './equity-coverage.js';
const hash = (v: unknown) =>
  createHash('sha256').update(canonicalSourceJson(v)).digest('hex');
function parse<T>(schema: z.ZodType<T>, value: unknown) {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new BadRequestException(
      'Review crosswalk fields and exact source selection.',
    );
  return r.data;
}
@Injectable()
export class ClassificationCrosswalkStore {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  private async actor(
    c: pg.PoolClient,
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
  ) {
    const value = await this.ops.permission(cookie, permission, c);
    return hash(typeof value === 'string' ? value : value.identity.id);
  }
  private async source(
    c: pg.PoolClient,
    input: ClassificationCrosswalkRevision['input'],
  ) {
    await c.query('SELECT id FROM equity_editions WHERE id=$1 FOR SHARE', [
      input.editionId,
    ]);
    const company = await equityCompanyForTrace(c, input.isin);
    const source = company.records.find(
      (r) =>
        r.editionId === input.editionId &&
        r.hash === input.hash &&
        r.observation.kind === 'classification' &&
        r.observation.sector === input.providerLabel &&
        r.observation.effectiveOn === input.effectiveOn,
    );
    if (!source)
      throw new ConflictException(
        'Classification source is unavailable or changed.',
      );
    return source;
  }
  private async current(c: pg.PoolClient, r: ClassificationCrosswalkRevision) {
    if (
      r.input.reviewBy < new Date().toISOString().slice(0, 10) ||
      r.input.effectiveOn > new Date().toISOString().slice(0, 10)
    )
      throw new ConflictException('Crosswalk is expired or not yet effective.');
    if (
      canonicalSourceJson(await this.source(c, r.input)) !==
      canonicalSourceJson(r.source)
    )
      throw new ConflictException('Classification source revision changed.');
  }
  async save(idValue: string, body: unknown, cookie?: string) {
    const id = parse(z.uuid(), idValue),
      input = parse(ClassificationCrosswalkDraftSchema, body);
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'prepare');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'crosswalk-request:' + input.requestId,
      ]);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'crosswalk:' + id,
      ]);
      const old = (
        await c.query(
          'SELECT payload FROM classification_crosswalk_versions WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (old) {
        const value = ClassificationCrosswalkRevisionSchema.parse(old.payload);
        if (value.id !== id || hash(value.input) !== hash(input))
          throw new ConflictException('Request ID reused.');
        await this.actor(c, cookie, 'prepare');
        return value;
      }
      const head = (
        await c.query(
          'SELECT * FROM classification_crosswalk_heads WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if ((head?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'Crosswalk changed. Reload latest version.',
        );
      const revision = ClassificationCrosswalkRevisionSchema.parse({
        id,
        version: input.expectedVersion + 1,
        recordedAt: new Date().toISOString(),
        input,
        source: await this.source(c, input),
      });
      await this.current(c, revision);
      const actor = await this.actor(c, cookie, 'prepare');
      await c.query(
        "INSERT INTO classification_crosswalk_heads(id,version,state) VALUES($1,$2,'draft') ON CONFLICT(id) DO UPDATE SET version=$2,state='draft'",
        [id, revision.version],
      );
      await c.query(
        'INSERT INTO classification_crosswalk_versions(id,version,request_id,actor_hash,payload) VALUES($1,$2,$3,$4,$5)',
        [id, revision.version, input.requestId, actor, revision],
      );
      return revision;
    });
  }
  async review(idValue: string, body: unknown, cookie?: string) {
    const id = parse(z.uuid(), idValue),
      input = parse(ClassificationCrosswalkReviewSchema, body);
    return this.account.transaction(async (c) => {
      const actor = await this.actor(c, cookie, 'approve');
      if (!this.ops.namedMode)
        throw new ForbiddenException('Independent named review is required.');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'crosswalk-review:' + input.requestId,
      ]);
      const head = (
        await c.query(
          'SELECT * FROM classification_crosswalk_heads WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      const old = (
        await c.query(
          'SELECT * FROM classification_crosswalk_reviews WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (old) {
        if (
          old.id !== id ||
          old.version !== input.expectedVersion ||
          old.decision !== input.decision ||
          old.reason !== input.reason
        )
          throw new ConflictException('Review request ID reused.');
        await this.actor(c, cookie, 'approve');
        return input;
      }
      if (!head || head.version !== input.expectedVersion)
        throw new ConflictException('Review the latest crosswalk version.');
      const row = (
        await c.query(
          'SELECT actor_hash,payload FROM classification_crosswalk_versions WHERE id=$1 AND version=$2',
          [id, input.expectedVersion],
        )
      ).rows[0];
      if (row.actor_hash === actor)
        throw new ForbiddenException('Author cannot approve this crosswalk.');
      const revision = ClassificationCrosswalkRevisionSchema.parse(row.payload);
      if (input.decision === 'publish') await this.current(c, revision);
      await this.actor(c, cookie, 'approve');
      await c.query(
        'INSERT INTO classification_crosswalk_reviews(request_id,id,version,actor_hash,decision,reason) VALUES($1,$2,$3,$4,$5,$6)',
        [
          input.requestId,
          id,
          input.expectedVersion,
          actor,
          input.decision,
          input.reason,
        ],
      );
      await c.query(
        'UPDATE classification_crosswalk_heads SET state=$2 WHERE id=$1',
        [id, input.decision === 'publish' ? 'published' : 'withdrawn'],
      );
      return input;
    });
  }
  async list(query: unknown, cookie?: string) {
    const input = parse(z.strictObject({ after: z.uuid().optional() }), query);
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'read');
      const rows = await c.query(
        'SELECT h.id,h.state,v.payload FROM classification_crosswalk_heads h JOIN classification_crosswalk_versions v ON v.id=h.id AND v.version=h.version WHERE ($1::uuid IS NULL OR h.id>$1) ORDER BY h.id LIMIT 101',
        [input.after ?? null],
      );
      const items = [];
      for (const row of rows.rows.slice(0, 100)) {
        const revision = ClassificationCrosswalkRevisionSchema.parse(
            row.payload,
          ),
          reviewReasons: string[] = [];
        let state = row.state;
        try {
          await this.current(c, revision);
        } catch (error) {
          if (!(
            error instanceof ConflictException ||
            error instanceof NotFoundException
          ))
            throw error;
          state = 'unavailable';
          reviewReasons.push(
            'Classification source, review date or effective period requires another review.',
          );
        }
        items.push({ revision, state, reviewReasons });
      }
      await this.actor(c, cookie, 'read');
      return ClassificationCrosswalkListSchema.parse({
        items,
        next: rows.rows.length > 100 ? rows.rows[99].id : null,
      });
    });
  }
  async history(idValue: string, cookie?: string) {
    const id = parse(z.uuid(), idValue);
    return this.account.transaction(async (c) => {
      await this.actor(c, cookie, 'read');
      const versions = await c.query(
          'SELECT payload FROM classification_crosswalk_versions WHERE id=$1 ORDER BY version DESC LIMIT 100',
          [id],
        ),
        reviews = await c.query(
          'SELECT * FROM classification_crosswalk_reviews WHERE id=$1 ORDER BY reviewed_at DESC LIMIT 100',
          [id],
        );
      await this.actor(c, cookie, 'read');
      return ClassificationCrosswalkHistorySchema.parse({
        versions: versions.rows.map((r) => r.payload),
        reviews: reviews.rows.map((r) => ({
          version: r.version,
          decision: r.decision,
          reason: r.reason,
          reviewedAt: r.reviewed_at.toISOString(),
        })),
      });
    });
  }
  async snapshot() {
    const isins = await this.account.transaction(async (c) =>
      (
        await c.query(
          "SELECT DISTINCT v.payload->'input'->>'isin' AS isin FROM classification_crosswalk_heads h JOIN classification_crosswalk_versions v ON v.id=h.id AND v.version=h.version WHERE h.state='published' ORDER BY isin LIMIT 1000",
        )
      ).rows.map((r) => r.isin as string),
    );
    const companies = [];
    for (const isin of isins) companies.push(await this.publicView(isin));
    return ClassificationCrosswalkSnapshotSchema.parse({
      capturedAt: new Date().toISOString(),
      companies,
    });
  }
  async publicView(isinValue: string) {
    const isin = parse(
      ClassificationCrosswalkDraftSchema.shape.isin,
      isinValue,
    );
    return this.account.transaction(async (c) => {
      const rows = await c.query(
        "SELECT v.payload FROM classification_crosswalk_heads h JOIN classification_crosswalk_versions v ON v.id=h.id AND v.version=h.version WHERE h.state='published' AND v.payload->'input'->>'isin'=$1 ORDER BY h.id LIMIT 100",
        [isin],
      );
      const mappings = [];
      for (const row of rows.rows) {
        const revision = ClassificationCrosswalkRevisionSchema.parse(
          row.payload,
        );
        try {
          await this.current(c, revision);
          mappings.push(revision);
        } catch (error) {
          if (!(
            error instanceof ConflictException ||
            error instanceof NotFoundException
          ))
            throw error;
        }
      }
      return ClassificationCrosswalkPublicSchema.parse({
        isin,
        evaluatedAt: new Date().toISOString(),
        mappings,
        conflict:
          new Set(mappings.map((r) => r.input.applicationSector)).size > 1,
      });
    });
  }
}
@OperatorRead()
@Controller('ops/classification-crosswalks')
export class ClassificationCrosswalkController {
  constructor(
    @Inject(ClassificationCrosswalkStore)
    private readonly store: ClassificationCrosswalkStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() list(@Query() q: unknown, @Headers('cookie') cookie?: string) {
    return this.store.list(q, cookie);
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
@Controller('classifications')
export class ClassificationCrosswalkPublicController {
  constructor(
    @Inject(ClassificationCrosswalkStore)
    private readonly store: ClassificationCrosswalkStore,
  ) {}
  @Get() snapshot() {
    return this.store.snapshot();
  }
  @Get(':isin') view(@Param('isin') isin: string) {
    return this.store.publicView(isin);
  }
}
