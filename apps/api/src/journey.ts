import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Headers,
  HttpCode, Inject, NotFoundException, Param, Post, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import pg from 'pg';
import { z } from 'zod';
import {
  ConfirmInputSchema, PreviewInputSchema, PreviewSchema, ReviewInputSchema,
  ReviewListSchema, ReviewSchema, SaveInputSchema, SessionSchema, WorkspaceSchema,
  type PortfolioInput,
} from '@fingent360/contracts';
import { catalog, createReview, emptyPortfolio, parseCsv, valuePortfolio } from './journey-domain.js';
import type { AppConfig } from './config.js';

const STORE = Symbol('JOURNEY_STORE');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException(result.error.issues.map((i) => i.message).join('; '));
  return result.data;
}
function owner(authorization?: string): string {
  if (!authorization || !/^Bearer [a-f0-9]{64}$/.test(authorization)) throw new UnauthorizedException('Open a virtual workspace first.');
  return hash(authorization.slice(7));
}
function workspace(revision: number, portfolio: PortfolioInput) {
  return WorkspaceSchema.parse({ revision, portfolio, valuation: valuePortfolio(portfolio) });
}
export class JourneyStore {
  private readonly pool: pg.Pool;
  constructor(config: AppConfig) {
    this.pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 4, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
    this.pool.on('error', () => { /* Requests report availability without logging connection details. */ });
  }
  async onApplicationShutdown() { await this.pool.end(); }
  async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    let client: pg.PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof UnauthorizedException || error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('Workspace storage unavailable. Start PostgreSQL and apply pnpm db:migrate, then retry.');
    } finally { client?.release(); }
  }
  async locked(client: pg.PoolClient, key: string) {
    const result = await client.query('SELECT revision, portfolio FROM virtual_workspaces WHERE token_hash=$1 FOR UPDATE', [key]);
    if (!result.rows[0]) throw new UnauthorizedException('Workspace expired or deleted. Open a new virtual workspace.');
    return WorkspaceSchema.parse(workspace(result.rows[0].revision, result.rows[0].portfolio));
  }
  async session() {
    const token = randomBytes(32).toString('hex');
    await this.transaction(async (c) => { await c.query('INSERT INTO virtual_workspaces(token_hash, portfolio) VALUES ($1,$2)', [hash(token), emptyPortfolio]); });
    return SessionSchema.parse({ token });
  }
  async read(key: string) { return this.transaction((c) => this.locked(c, key)); }
  async save(key: string, raw: unknown) {
    const input = parse(SaveInputSchema, raw);
    return this.mutate(key, input.idempotencyKey, hash(JSON.stringify(input)), input.expectedRevision, async () => ({ portfolio: input.portfolio }));
  }
  async preview(key: string, raw: unknown) {
    const input = parse(PreviewInputSchema, raw);
    const parsed = parseCsv(input.csv);
    const calculatedTotal = valuePortfolio({ holdings: parsed.holdings, cash: input.cash, goals: [] }).total;
    const issues = [...parsed.issues];
    if (calculatedTotal !== input.sourceTotal) issues.push('Source total does not match calculated holdings plus cash. Correct the CSV or declared total.');
    const result = PreviewSchema.parse({ id: randomUUID(), holdings: parsed.holdings, cash: input.cash, sourceTotal: input.sourceTotal, calculatedTotal, matched: issues.length === 0, issues });
    const contentHash = hash(JSON.stringify({ holdings: parsed.holdings, cash: input.cash, sourceTotal: input.sourceTotal, parserVersion: 'simple-csv-v1' }));
    await this.transaction(async (c) => {
      await this.locked(c, key);
      // Bound staging retention per workspace; raw CSV is never persisted.
      await c.query("DELETE FROM virtual_previews WHERE owner_hash=$1 AND created_at < now() - interval '1 day'", [key]);
      const count = await c.query('SELECT count(*)::int AS count FROM virtual_previews WHERE owner_hash=$1', [key]);
      if (count.rows[0].count >= 100) throw new BadRequestException('Preview limit reached. Try again tomorrow or delete this virtual workspace.');
      await c.query('INSERT INTO virtual_previews(id,owner_hash,content_hash,payload) VALUES ($1,$2,$3,$4)', [result.id,key,contentHash,result]);
    });
    return result;
  }
  async confirm(key: string, raw: unknown) {
    const input = parse(ConfirmInputSchema, raw);
    return this.mutate(key,input.idempotencyKey,hash(JSON.stringify(input)),input.expectedRevision,async (c,current) => {
      const result = await c.query("SELECT payload,content_hash FROM virtual_previews WHERE id=$1 AND owner_hash=$2 AND created_at > now() - interval '1 day'", [input.previewId,key]);
      if (!result.rows[0]) throw new NotFoundException('Preview not found or expired.');
      const preview = PreviewSchema.parse(result.rows[0].payload);
      if (!preview.matched) throw new BadRequestException('Resolve all preview issues before confirming.');
      return { portfolio: { holdings: preview.holdings, cash: preview.cash, goals: current.portfolio.goals }, contentHash: String(result.rows[0].content_hash) };
    });
  }
  private async mutate(key: string, idempotencyKey: string, payloadHash: string, expectedRevision: number,
    resolve: (c: pg.PoolClient, current: z.infer<typeof WorkspaceSchema>) => Promise<{ portfolio: PortfolioInput; contentHash?: string }>) {
    return this.transaction(async (c) => {
      const current = await this.locked(c,key);
      const previous = await c.query('SELECT payload_hash,response FROM virtual_mutations WHERE owner_hash=$1 AND idempotency_key=$2',[key,idempotencyKey]);
      if (previous.rows[0]) {
        if (previous.rows[0].payload_hash !== payloadHash) throw new ConflictException('Idempotency key was already used for different content.');
        return WorkspaceSchema.parse(previous.rows[0].response);
      }
      const next = await resolve(c,current);
      if (next.contentHash) {
        const imported = await c.query('SELECT response FROM virtual_imports WHERE owner_hash=$1 AND content_hash=$2',[key,next.contentHash]);
        if (imported.rows[0]) throw new ConflictException('This portfolio content was already imported. Reload the saved workspace; no changes were made.');
      }
      if (current.revision !== expectedRevision) throw new ConflictException('Workspace changed in another request. Reload saved data before editing.');
      const saved = workspace(current.revision + 1,next.portfolio);
      await c.query('UPDATE virtual_workspaces SET revision=$2,portfolio=$3 WHERE token_hash=$1',[key,saved.revision,saved.portfolio]);
      await c.query('INSERT INTO virtual_mutations(owner_hash,idempotency_key,payload_hash,response) VALUES ($1,$2,$3,$4)',[key,idempotencyKey,payloadHash,saved]);
      if (next.contentHash) await c.query('INSERT INTO virtual_imports(owner_hash,content_hash,response) VALUES ($1,$2,$3)',[key,next.contentHash,saved]);
      return saved;
    });
  }
  async review(key: string, raw: unknown) {
    const { scenario } = parse(ReviewInputSchema, raw);
    return this.transaction(async (c) => {
      const current = await this.locked(c,key);
      const review = createReview(current.portfolio,current.revision,scenario);
      await c.query('INSERT INTO virtual_reviews(id,owner_hash,payload) VALUES ($1,$2,$3)',[review.id,key,review]);
      return review;
    });
  }
  async reviews(key: string) {
    return this.transaction(async (c) => {
      await this.locked(c,key);
      const result = await c.query('SELECT payload FROM virtual_reviews WHERE owner_hash=$1 ORDER BY created_at DESC,id DESC LIMIT 50',[key]);
      return ReviewListSchema.parse(result.rows.map((r) => r.payload));
    });
  }
  async reviewDetail(key: string, id: string) {
    parse(z.uuid(), id);
    return this.transaction(async (c) => {
      await this.locked(c,key);
      const result = await c.query('SELECT payload FROM virtual_reviews WHERE owner_hash=$1 AND id=$2',[key,id]);
      if (!result.rows[0]) throw new NotFoundException('Review not found.');
      return ReviewSchema.parse(result.rows[0].payload);
    });
  }
  async remove(key: string) {
    await this.transaction(async (c) => { await this.locked(c,key); await c.query('DELETE FROM virtual_workspaces WHERE token_hash=$1',[key]); });
    return { deleted: true };
  }
}
@Controller('journey')
export class JourneyController {
  constructor(@Inject(STORE) private readonly store: JourneyStore) {}
  @Get('catalog') catalog() { return catalog; }
  @Post('workspaces') session() { return this.store.session(); }
  @Get('workspace') read(@Headers('authorization') auth?: string) { return this.store.read(owner(auth)); }
  @Post('workspace') @HttpCode(200) save(@Body() body: unknown, @Headers('authorization') auth?: string) { return this.store.save(owner(auth),body); }
  @Delete('workspace') remove(@Headers('authorization') auth?: string) { return this.store.remove(owner(auth)); }
  @Post('previews') preview(@Body() body: unknown, @Headers('authorization') auth?: string) { return this.store.preview(owner(auth),body); }
  @Post('imports') @HttpCode(200) confirm(@Body() body: unknown, @Headers('authorization') auth?: string) { return this.store.confirm(owner(auth),body); }
  @Post('reviews') review(@Body() body: unknown, @Headers('authorization') auth?: string) { return this.store.review(owner(auth),body); }
  @Get('reviews') reviews(@Headers('authorization') auth?: string) { return this.store.reviews(owner(auth)); }
  @Get('reviews/:id') detail(@Param('id') id: string, @Headers('authorization') auth?: string) { return this.store.reviewDetail(owner(auth),id); }
}
export function journeyProvider(config: AppConfig) { return { provide: STORE, useValue: new JourneyStore(config) }; }
