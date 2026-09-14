import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  Controller,
  Get,
  Put,
  Post,
  Param,
  Query,
  Body,
  Headers,
  Inject,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  IdentitySelectionInputSchema,
  IdentitySelectionPlanSchema,
  IdentitySelectionReceiptSchema,
  IdentitySelectionReviewSchema,
  IdentitySelectionPublicSchema,
  IdentitySelectionOperationsSchema,
  IdentitySelectionHistorySchema,
  IdentitySelectionPlansSchema,
  SecurityIdentitySchema,
  IndianIsinSchema,
  selectionMatchesProvider,
} from '@fingent360/contracts';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorRead, OperatorAction } from './operator-permissions.js';
export const IDENTITY_SELECTION_STORE = Symbol('IDENTITY_SELECTION_STORE');
type Authorize = (client?: pg.PoolClient) => Promise<unknown>;
function parse<T>(schema: z.ZodType<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(
      'Invalid identity selection or continuation.',
    );
  return result.data;
}
export async function admitIdentitySelection(
  c: pg.PoolClient,
  selection: z.infer<typeof IdentitySelectionReceiptSchema>,
  provider: z.infer<typeof SecurityIdentitySchema>,
) {
  const row = (
    await c.query(
      'SELECT r.payload FROM identity_selection_heads h JOIN identity_selection_revisions r ON r.isin=h.isin AND r.version=h.version WHERE h.isin=$1 FOR SHARE OF h',
      [provider.isin],
    )
  ).rows[0];
  if (
    !row ||
    JSON.stringify(IdentitySelectionReceiptSchema.parse(row.payload)) !==
      JSON.stringify(selection) ||
    !selectionMatchesProvider(selection, provider)
  )
    throw new ConflictException(
      'Editorial identity selection changed, was withdrawn, or does not bind this provider edition.',
    );
}
export class IdentitySelectionStore {
  constructor(private readonly ops: OperatorStore) {}
  private async current(c: pg.PoolClient, isin: string) {
    return (
      await c.query(
        'SELECT h.version,r.payload FROM identity_selection_heads h JOIN identity_selection_revisions r ON r.isin=h.isin AND r.version=h.version WHERE h.isin=$1 FOR UPDATE OF h',
        [isin],
      )
    ).rows[0];
  }
  private async provider(c: pg.PoolClient, isin: string, version?: number) {
    const head = (
      await c.query(
        'SELECT version FROM security_identities WHERE isin=$1 FOR SHARE',
        [isin],
      )
    ).rows[0];
    if (!head) throw new NotFoundException('No retained provider identity.');
    const row = (
      await c.query(
        'SELECT payload FROM security_identity_revisions WHERE isin=$1 AND version=$2',
        [isin, version ?? head.version],
      )
    ).rows[0];
    if (!row) throw new NotFoundException('Provider edition not retained.');
    return SecurityIdentitySchema.parse(row.payload);
  }
  save(raw: string, body: unknown, authorize: Authorize) {
    const id = parse(z.uuid(), raw).toLowerCase(),
      input = parse(IdentitySelectionInputSchema, body);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    return this.ops.named.transaction(async (c) => {
      await authorize(c);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'identity-selection-plan:' + id,
      ]);
      const old = (
        await c.query(
          'SELECT payload FROM identity_selection_plans WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (old) {
        await authorize(c);
        const plan = IdentitySelectionPlanSchema.parse(old.payload);
        if (plan.fingerprint !== fingerprint)
          throw new ConflictException('Request identity already used.');
        return plan;
      }
      const provider = await this.provider(
        c,
        input.isin,
        input.action === 'withdraw' ? input.providerVersion : undefined,
      );
      const current = await this.current(c, input.isin);
      if ((current?.version ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          'Selection changed. Reload before proposing.',
        );
      const candidate = provider.candidates.find(
        (item) => item.figi === input.figi,
      );
      if (
        !candidate ||
        provider.version !== input.providerVersion ||
        provider.sourceHash !== input.providerHash
      )
        throw new ConflictException(
          'Choose an actual candidate from the exact provider edition.',
        );
      if (
        input.action === 'withdraw' &&
        (!current ||
          current.payload.status !== 'approved' ||
          current.payload.candidate.figi !== input.figi ||
          current.payload.providerHash !== input.providerHash)
      )
        throw new ConflictException(
          'Only the current approved selection can be withdrawn.',
        );
      const plan = IdentitySelectionPlanSchema.parse({
        id,
        fingerprint,
        createdAt: new Date().toISOString(),
        input,
        provider,
        candidate,
      });
      await authorize(c);
      await c.query(
        'INSERT INTO identity_selection_plans(id,fingerprint,payload) VALUES($1,$2,$3)',
        [id, fingerprint, plan],
      );
      await authorize(c);
      return plan;
    });
  }
  review(
    raw: string,
    body: unknown,
    authorize: Authorize,
    complete?: (c: pg.PoolClient) => Promise<void>,
  ) {
    const id = parse(z.uuid(), raw).toLowerCase(),
      input = parse(IdentitySelectionReviewSchema, body);
    return this.ops.named.transaction(async (c) => {
      await authorize(c);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'identity-selection-plan:' + id,
      ]);
      const row = (
        await c.query(
          'SELECT payload FROM identity_selection_plans WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Selection plan not found.');
      const plan = IdentitySelectionPlanSchema.parse(row.payload);
      if (
        plan.fingerprint !== input.fingerprint ||
        input.status !==
          (plan.input.action === 'select' ? 'approved' : 'withdrawn')
      )
        throw new ConflictException('Decision does not match the exact plan.');
      const replay = (
        await c.query(
          'SELECT payload FROM identity_selection_revisions WHERE plan_id=$1',
          [id],
        )
      ).rows[0];
      if (replay) {
        await authorize(c);
        if (complete)
          throw new ConflictException(
            'Selection plan already applied. Read its receipt.',
          );
        return IdentitySelectionReceiptSchema.parse(replay.payload);
      }
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'identity-selection:' + plan.input.isin,
      ]);
      const provider = await this.provider(
        c,
        plan.input.isin,
        input.status === 'withdrawn' ? plan.input.providerVersion : undefined,
      );
      const current = await this.current(c, plan.input.isin);
      if (
        (current?.version ?? 0) !== plan.input.expectedVersion ||
        JSON.stringify(provider) !== JSON.stringify(plan.provider)
      )
        throw new ConflictException(
          'Provider or selection changed. Create a new plan.',
        );
      const receipt = IdentitySelectionReceiptSchema.parse({
        id,
        version: plan.input.expectedVersion + 1,
        isin: plan.input.isin,
        providerVersion: provider.version,
        providerHash: provider.sourceHash,
        candidate: plan.candidate,
        rationale: plan.input.rationale,
        reviewedAt: new Date().toISOString(),
        method: 'editorial-judgement',
        status: input.status,
      });
      await authorize(c);
      await c.query(
        'INSERT INTO identity_selection_revisions(isin,version,plan_id,payload) VALUES($1,$2,$3,$4)',
        [receipt.isin, receipt.version, id, receipt],
      );
      await c.query(
        'INSERT INTO identity_selection_heads(isin,version) VALUES($1,$2) ON CONFLICT(isin) DO UPDATE SET version=$2',
        [receipt.isin, receipt.version],
      );
      await authorize(c);
      if (complete) await complete(c);
      return receipt;
    });
  }
  read(raw: string, authorize: Authorize) {
    const id = parse(z.uuid(), raw);
    return this.ops.named.transaction(async (c) => {
      await authorize(c);
      const row = (
        await c.query(
          'SELECT p.payload AS plan,r.payload AS receipt FROM identity_selection_plans p LEFT JOIN identity_selection_revisions r ON r.plan_id=p.id WHERE p.id=$1',
          [id],
        )
      ).rows[0];
      await authorize(c);
      if (!row) throw new NotFoundException('Plan not found.');
      return IdentitySelectionOperationsSchema.parse({
        plan: row.plan,
        receipt: row.receipt ?? null,
      });
    });
  }
  plans(raw: unknown, authorize: Authorize) {
    const query = parse(z.strictObject({ after: z.uuid().optional() }), raw);
    return this.ops.named.transaction(async (c) => {
      await authorize(c);
      const rows = (
        await c.query(
          'SELECT id,payload FROM identity_selection_plans WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 21',
          [query.after ?? null],
        )
      ).rows;
      await authorize(c);
      return IdentitySelectionPlansSchema.parse({
        plans: rows.slice(0, 20).map((row) => row.payload),
        next: rows.length > 20 ? rows[19].id : null,
      });
    });
  }
  public(raw: string) {
    const isin = parse(IndianIsinSchema, raw);
    return this.ops.named.transaction(async (c) => {
      const provider = await this.provider(c, isin);
      const row = (
        await c.query(
          'SELECT r.payload FROM identity_selection_heads h JOIN identity_selection_revisions r ON r.isin=h.isin AND r.version=h.version WHERE h.isin=$1 FOR SHARE OF h',
          [isin],
        )
      ).rows[0];
      const receipt = row
        ? IdentitySelectionReceiptSchema.parse(row.payload)
        : null;
      return IdentitySelectionPublicSchema.parse({
        isin,
        receipt,
        state: !receipt
          ? 'none'
          : receipt.status === 'withdrawn'
            ? 'withdrawn'
            : selectionMatchesProvider(receipt, provider)
              ? 'current'
              : 'stale',
        evaluatedAt: new Date().toISOString(),
      });
    });
  }
  history(raw: string, query: unknown) {
    const isin = parse(IndianIsinSchema, raw),
      input = parse(
        z.strictObject({
          before: z.coerce.number().int().positive().max(2147483647).optional(),
        }),
        query,
      );
    return this.ops.named.transaction(async (c) => {
      const rows = (
        await c.query(
          'SELECT payload FROM identity_selection_revisions WHERE isin=$1 AND ($2::int IS NULL OR version<$2) ORDER BY version DESC LIMIT 21',
          [isin, input.before ?? null],
        )
      ).rows;
      return IdentitySelectionHistorySchema.parse({
        receipts: rows.slice(0, 20).map((row) => row.payload),
        nextBefore: rows.length > 20 ? rows[19].payload.version : null,
      });
    });
  }
}
@OperatorRead()
@Controller('ops/identity-selections')
export class OpsIdentitySelectionController {
  constructor(
    @Inject(IDENTITY_SELECTION_STORE)
    private readonly store: IdentitySelectionStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
  ) {}
  @Get() plans(@Query() query: unknown, @Headers('cookie') cookie?: string) {
    return this.store.plans(query, (c) =>
      this.ops.permission(cookie, 'read', c),
    );
  }
  @Get(':id') read(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.read(id, (c) => this.ops.permission(cookie, 'read', c));
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
@Controller('securities')
export class IdentitySelectionController {
  constructor(
    @Inject(IDENTITY_SELECTION_STORE)
    private readonly store: IdentitySelectionStore,
  ) {}
  @Get(':isin/selection') read(
    @Param('isin') isin: string,
    @Query() query: unknown,
  ) {
    parse(z.strictObject({}), query);
    return this.store.public(isin);
  }
  @Get(':isin/selection/history') history(
    @Param('isin') isin: string,
    @Query() query: unknown,
  ) {
    return this.store.history(isin, query);
  }
}
export const identitySelectionProvider = {
  provide: IDENTITY_SELECTION_STORE,
  inject: [OPERATOR_STORE],
  useFactory: (ops: OperatorStore) => new IdentitySelectionStore(ops),
};
