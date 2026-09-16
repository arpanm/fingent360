import { createHash } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
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
  SbiPortfolioCaptureSchema,
  SbiPortfolioReviewSchema,
  SbiPortfolioEditionSchema,
  SbiPortfolioListSchema,
  SbiPortfolioSnapshotSchema,
  parseSbiPortfolio,
  parseSbiPortfolioStructural,
  parseAxisPortfolio,
  AXIS_PORTFOLIO_URL,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { FundsRawStore, FUNDS_RAW } from './funds-bonds.js';
import { OperatorStore, OPERATOR_STORE } from './operator.js';
import { OperatorAction, OperatorRead } from './operator-permissions.js';
const sha = (v: string | Uint8Array) =>
  createHash('sha256').update(v).digest('hex');
function parse<T>(schema: z.ZodType<T>, raw: unknown) {
  const p = schema.safeParse(raw);
  if (!p.success)
    throw new BadRequestException(
      'Review valid portfolio capture/mapping fields.',
    );
  return p.data;
}
async function mapping(
  c: pg.PoolClient,
  code: string,
  scheme = 'SBI Contra Fund',
) {
  const row = (
    await c.query(
      "SELECT o.payload,e.id FROM fund_nav_observations o JOIN fund_nav_editions e ON e.id=o.edition_id WHERE o.scheme_code=$1 AND (SELECT decision FROM fund_nav_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY o.observed_on DESC,e.created_at DESC,e.id LIMIT 1",
      [code],
    )
  ).rows[0];
  if (
    !row ||
    !(scheme === 'Axis NIFTY 50 ETF'
      ? /^Axis NIFTY 50 ETF(?:\b|\s)/i.test(row.payload.name) &&
        /^Axis Mutual Fund$/i.test(row.payload.amc)
      : /^SBI Contra Fund(?:\b|\s)/i.test(row.payload.name) &&
        /SBI/i.test(row.payload.amc))
  )
    throw new ConflictException(
      'Choose the matching admitted AMC scheme/plan; no name-only automatic mapping is allowed.',
    );
  return {
    schemeCode: code,
    navEditionId: row.id,
    schemeName: row.payload.name,
    plan: row.payload.plan ?? null,
    option: row.payload.option ?? null,
  };
}
async function edition(
  c: pg.PoolClient,
  row: Record<string, unknown>,
  publicOnly = false,
) {
  const review = (
    await c.query(
      'SELECT * FROM fund_portfolio_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
      [row.id],
    )
  ).rows[0];
  const state =
    review?.decision === 'publish'
      ? 'published'
      : review?.decision === 'withdraw'
        ? 'withdrawn'
        : row.portfolio
          ? 'draft'
          : 'quarantined';
  if (publicOnly) {
    if (state !== 'published') return null;
    try {
      const current = await mapping(
        c,
        review.mapping.schemeCode,
        (row.portfolio as { scheme: string }).scheme,
      );
      if (
        current.schemeName !== review.mapping.schemeName ||
        current.plan !== review.mapping.plan ||
        current.option !== review.mapping.option
      )
        return null;
      const original = (
        await c.query(
          'SELECT decision FROM fund_nav_reviews WHERE edition_id=$1 ORDER BY seq DESC LIMIT 1',
          [review.mapping.navEditionId],
        )
      ).rows[0];
      if (original?.decision !== 'publish') return null;
    } catch (error) {
      if (error instanceof ConflictException) return null;
      throw error;
    }
  }
  return SbiPortfolioEditionSchema.parse({
    id: row.id,
    hash: row.hash,
    sourceUrl: row.source_url,
    retrievedAt: (row.retrieved_at as Date).toISOString(),
    portfolio: publicOnly && state !== 'published' ? null : row.portfolio,
    error: row.error,
    state,
    mapping: review?.mapping ?? null,
    reviewedAt: review?.reviewed_at.toISOString() ?? null,
  });
}
@Controller('fund-lookthrough')
export class FundLookthroughController {
  constructor(@Inject(STORE) private readonly account: AccountStore) {}
  @Get() read(@Query('schemeCode') code?: string) {
    if (code !== undefined) parse(z.string().regex(/^[0-9]{5,8}$/), code);
    return this.account.transaction(async (c) => {
      await c.query(
        'LOCK TABLE fund_portfolio_reviews,fund_nav_reviews IN SHARE MODE',
      );
      const rows = await c.query(
        "SELECT e.* FROM fund_portfolio_editions e WHERE (SELECT decision FROM fund_portfolio_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' AND ($1::text IS NULL OR (SELECT mapping->>'schemeCode' FROM fund_portfolio_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)=$1) ORDER BY e.retrieved_at DESC,e.id LIMIT 31",
        [code ?? null],
      );
      if (rows.rows.length > 30)
        throw new ServiceUnavailableException(
          'Portfolio history exceeds reader limit. A scoped archive is required.',
        );
      const editions = [];
      for (const row of rows.rows) {
        const item = await edition(c, row, true);
        if (item && (!code || item.mapping?.schemeCode === code))
          editions.push(item);
      }
      return SbiPortfolioListSchema.parse({ editions });
    });
  }
  @Get('snapshot') snapshot() {
    return this.account.transaction(async (c) => {
      await c.query(
        'LOCK TABLE fund_portfolio_reviews,fund_nav_reviews IN SHARE MODE',
      );
      const rows = await c.query(
        "SELECT e.* FROM fund_portfolio_editions e WHERE (SELECT decision FROM fund_portfolio_reviews WHERE edition_id=e.id ORDER BY seq DESC LIMIT 1)='publish' ORDER BY e.retrieved_at DESC,e.id LIMIT 101",
      );
      if (rows.rows.length > 100)
        throw new ServiceUnavailableException(
          'Portfolio snapshot exceeds explicit100-record limit.',
        );
      const editions = [];
      for (const row of rows.rows) {
        const item = await edition(c, row, true);
        if (item) editions.push(item);
      }
      return SbiPortfolioSnapshotSchema.parse({
        capturedAt: new Date().toISOString(),
        editions,
      });
    });
  }
}
@OperatorRead()
@Controller('ops/fund-lookthrough')
export class OpsFundLookthroughController {
  constructor(
    @Inject(STORE) private readonly account: AccountStore,
    @Inject(OPERATOR_STORE) private readonly ops: OperatorStore,
    @Inject(FUNDS_RAW) private readonly raw: FundsRawStore,
  ) {}
  private async actor(
    cookie: string | undefined,
    permission: 'read' | 'prepare' | 'approve',
    c?: pg.PoolClient,
  ) {
    const actor = await this.ops.permission(cookie, permission, c);
    return typeof actor === 'string' ? actor : actor.identity.id;
  }
  @Get() queue(@Headers('cookie') cookie?: string) {
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'read', c);
      const rows = await c.query(
          'SELECT * FROM fund_portfolio_editions ORDER BY retrieved_at DESC,id LIMIT 30',
        ),
        editions = [];
      for (const row of rows.rows) editions.push(await edition(c, row));
      await this.actor(cookie, 'read', c);
      return SbiPortfolioListSchema.parse({ editions });
    });
  }
  @Get(':id/evidence') async evidence(
    @Param('id') id: string,
    @Headers('cookie') cookie?: string,
  ) {
    parse(z.uuid(), id);
    await this.actor(cookie, 'read');
    const row = await this.account.transaction(
      async (c) =>
        (
          await c.query(
            'SELECT hash FROM fund_portfolio_editions WHERE id=$1',
            [id],
          )
        ).rows[0],
    );
    if (!row) throw new NotFoundException('Portfolio capture unavailable.');
    const raw = await this.raw.read(row.hash);
    await this.actor(cookie, 'read');
    if (!raw || sha(Buffer.from(raw.body, 'base64')) !== row.hash)
      throw new ServiceUnavailableException(
        'Retained workbook unavailable or corrupt.',
      );
    return { id, hash: row.hash, body: raw.body, encoding: 'base64' };
  }
  @OperatorAction('prepare') @Post('import') capture(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    const input = parse(SbiPortfolioCaptureSchema, body);
    if (!input.body)
      throw new BadRequestException('Choose the original workbook.');
    return this.retain(input, cookie);
  }
  @OperatorAction('prepare') @Post('fetch') async fetch(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    await this.actor(cookie, 'prepare');
    const input = parse(SbiPortfolioCaptureSchema.omit({ body: true }), body);
    const response = await fetch(input.sourceUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (
      !response.ok ||
      !response.body ||
      !response.headers.get('content-type')?.includes('spreadsheetml')
    )
      throw new ServiceUnavailableException(
        'Original workbook unavailable; no bypass attempted.',
      );
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.length;
        if (size > 2000000)
          throw new BadRequestException('Workbook exceeds2MB.');
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return this.retain(
      { ...input, body: Buffer.concat(chunks).toString('base64') },
      cookie,
    );
  }
  private async retain(
    input: z.infer<typeof SbiPortfolioCaptureSchema>,
    cookie?: string,
  ) {
    const actor = await this.actor(cookie, 'prepare'),
      body = input.body!,
      bytes = Buffer.from(body, 'base64');
    if (
      !bytes.length ||
      bytes.length > 2000000 ||
      bytes.toString('base64') !== body
    )
      throw new BadRequestException('Invalid workbook encoding or byte bound.');
    const hash = sha(bytes),
      at = new Date().toISOString();
    let portfolio = null,
      error = null;
    try {
      portfolio =
        input.sourceUrl === AXIS_PORTFOLIO_URL
          ? parseAxisPortfolio(bytes, input.sourceUrl)
          : parseSbiPortfolioStructural(bytes, input.sourceUrl);
    } catch {
      error =
        'Unsupported or inconsistent workbook structure. Retained for operator inspection; no publishable portfolio parsed.';
    }
    await this.raw.retain(hash, body, at);
    return this.account.transaction(async (c) => {
      await this.actor(cookie, 'prepare', c);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'fund-portfolio:' + input.requestId,
      ]);
      const existing = (
        await c.query('SELECT * FROM fund_portfolio_editions WHERE id=$1', [
          input.requestId,
        ])
      ).rows[0];
      if (existing) {
        if (
          existing.hash !== hash ||
          existing.source_url !== input.sourceUrl ||
          existing.permission_reference !== input.permissionReference
        )
          throw new ConflictException(
            'Capture request reused with different source or permission.',
          );
        return edition(c, existing);
      }
      const row = (
        await c.query(
          'INSERT INTO fund_portfolio_editions(id,hash,source_url,retrieved_at,portfolio,error,prepared_by,permission_reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
          [
            input.requestId,
            hash,
            input.sourceUrl,
            at,
            portfolio,
            error,
            actor,
            input.permissionReference,
          ],
        )
      ).rows[0];
      return edition(c, row);
    });
  }
  @OperatorAction('approve') @Post(':id/review') review(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.ops.origin(origin);
    parse(z.uuid(), id);
    const input = parse(SbiPortfolioReviewSchema, body),
      fingerprint = sha(JSON.stringify({ id, input }));
    return this.account.transaction(async (c) => {
      const actor = await this.actor(cookie, 'approve', c);
      await c.query('LOCK TABLE fund_nav_reviews IN SHARE MODE');
      const row = (
        await c.query(
          'SELECT * FROM fund_portfolio_editions WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Capture unavailable.');
      const old = (
        await c.query(
          'SELECT fingerprint FROM fund_portfolio_reviews WHERE request_id=$1',
          [input.requestId],
        )
      ).rows[0];
      if (old) {
        if (old.fingerprint !== fingerprint)
          throw new ConflictException('Review request reused.');
        return edition(c, row);
      }
      let selected = null;
      if (input.decision === 'publish') {
        if (!row.portfolio)
          throw new ConflictException('Quarantined structure cannot publish.');
        const original = await this.raw.read(row.hash);
        if (!original || sha(Buffer.from(original.body, 'base64')) !== row.hash)
          throw new ServiceUnavailableException(
            'Retained workbook unavailable or corrupt.',
          );
        const reconstructed =
          row.portfolio.parser === 'axis-nifty50-february-2026-v1'
            ? parseAxisPortfolio(
                Buffer.from(original.body, 'base64'),
                row.source_url,
              )
            : row.portfolio.parser === 'sbi-contra-august-2026-v1'
              ? parseSbiPortfolio(Buffer.from(original.body, 'base64'))
              : parseSbiPortfolioStructural(
                  Buffer.from(original.body, 'base64'),
                  row.source_url,
                );
        if (JSON.stringify(reconstructed) !== JSON.stringify(row.portfolio)) {
          const canonical = (value: unknown): string =>
            JSON.stringify(value, (_key, v) =>
              v && typeof v === 'object' && !Array.isArray(v)
                ? Object.fromEntries(
                    Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
                  )
                : v,
            );
          if (canonical(reconstructed) !== canonical(row.portfolio))
            throw new ConflictException(
              'Retained workbook does not reconstruct its parsed disclosure.',
            );
        }
        const named = await this.ops.permission(cookie, 'approve', c);
        if (typeof named === 'string' || actor === row.prepared_by)
          throw new ForbiddenException(
            'A different named reviewer must approve the scheme mapping and disclosure.',
          );
        if (
          row.portfolio.quality === 'source-discrepancy' &&
          !input.acknowledgeDiscrepancy
        )
          throw new ConflictException(
            'Acknowledge source discrepancies before publishing limited-quality disclosure.',
          );
        if (!input.schemeCode)
          throw new BadRequestException(
            'Select the admitted AMFI scheme code.',
          );
        selected = await mapping(c, input.schemeCode, row.portfolio.scheme);
      }
      await c.query(
        'INSERT INTO fund_portfolio_reviews(request_id,edition_id,fingerprint,decision,mapping,reason,acknowledged_discrepancy,reviewer) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          input.requestId,
          id,
          fingerprint,
          input.decision,
          selected,
          input.reason,
          input.acknowledgeDiscrepancy,
          actor,
        ],
      );
      await this.actor(cookie, 'approve', c);
      return edition(c, row);
    });
  }
}
