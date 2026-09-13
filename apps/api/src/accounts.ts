import { randomBytes, randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import pg from 'pg';
import { z } from 'zod';
import {
  AcknowledgeSchema,
  InboxSchema,
  AccountSchema,
  CredentialsSchema,
  CurrentAccountSchema,
  DeleteAccountSchema,
  RegistrationSchema,
  WatchlistSchema,
  type Account,
} from '@fingent360/contracts';
import {
  AccountRateLimit,
  checkOrigin,
  derivePassword,
  matchesPassword,
  newSalt,
  sessionFromCookie,
  sessionHash,
} from './account-security.js';
import type { AppConfig } from './config.js';
export const STORE = Symbol('ACCOUNT_STORE');
interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  consent_version: string;
  created_at: Date;
}
function user(row: UserRow): Account {
  return AccountSchema.parse({
    id: row.id,
    username: row.username,
    consentVersion: row.consent_version,
    createdAt: row.created_at.toISOString(),
  });
}
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(
      result.error.issues.map((i) => i.message).join('; '),
    );
  return result.data;
}
export class AccountStore {
  private readonly pool: pg.Pool;
  private readonly limits = new AccountRateLimit();
  private readonly deletionIpLimits = new AccountRateLimit();
  private readonly deletionOwnerLimits = new AccountRateLimit(5);
  constructor(private readonly config: AppConfig) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {
      /* Never log credentials. */
    });
  }
  async onApplicationShutdown() {
    await this.pool.end();
  }
  origin(value?: string) {
    checkOrigin(value, this.config.WEB_ORIGIN);
  }
  cookie(token: string, clear = false) {
    return `f360_session=${clear ? '' : token}; Path=/api/v1/account; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 604800}${new URL(this.config.WEB_ORIGIN).protocol === 'https:' ? '; Secure' : ''}`;
  }
  async transaction<T>(
    work: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    let client: pg.PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Account storage unavailable. Check PostgreSQL and apply pnpm db:migrate.',
      );
    } finally {
      client?.release();
    }
  }
  private async find(client: pg.PoolClient, cookie?: string) {
    const hash = sessionFromCookie(cookie);
    if (!hash) return null;
    const result = await client.query<UserRow>(
      'SELECT u.* FROM app_users u JOIN app_sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at > now()',
      [hash],
    );
    return result.rows[0] ?? null;
  }
  async require(client: pg.PoolClient, cookie?: string) {
    const found = await this.find(client, cookie);
    if (!found)
      throw new UnauthorizedException('Sign in to access your account.');
    return found;
  }
  private async issue(client: pg.PoolClient, id: string) {
    const token = randomBytes(32).toString('hex');
    await client.query(
      'DELETE FROM app_sessions WHERE user_id=$1 AND expires_at <= now()',
      [id],
    );
    await client.query(
      "INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now() + interval '7 days')",
      [sessionHash(token), id],
    );
    await client.query(
      'DELETE FROM app_sessions WHERE user_id=$1 AND token_hash NOT IN (SELECT token_hash FROM app_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10)',
      [id],
    );
    return token;
  }
  async current(cookie?: string) {
    return this.transaction(async (c) => {
      const found = await this.find(c, cookie);
      return CurrentAccountSchema.parse({ user: found ? user(found) : null });
    });
  }
  async register(body: unknown, ip: string) {
    this.limits.consume(ip);
    const input = parse(RegistrationSchema, body);
    const salt = newSalt();
    const passwordHash = await derivePassword(input.password, salt);
    return this.transaction(async (c) => {
      const result = await c.query<UserRow>(
        'INSERT INTO app_users(id,username,password_hash,password_salt) VALUES ($1,$2,$3,$4) ON CONFLICT(username) DO NOTHING RETURNING *',
        [randomUUID(), input.username, passwordHash, salt],
      );
      const row = result.rows[0];
      if (!row)
        throw new BadRequestException(
          'Username unavailable. Choose another username.',
        );
      await c.query('INSERT INTO app_watchlists(user_id) VALUES ($1)', [
        row.id,
      ]);
      return { account: user(row), token: await this.issue(c, row.id) };
    });
  }
  async login(body: unknown, ip: string) {
    this.limits.consume(ip);
    const input = parse(CredentialsSchema, body);
    // The attempt counter commits separately so a failed login cannot roll it back.
    await this.transaction(async (c) => {
      await c.query('DELETE FROM app_login_limits WHERE reset_at <= now()');
      const result = await c.query<{ attempts: number }>(
        "INSERT INTO app_login_limits(username,attempts,reset_at) VALUES ($1,1,now() + interval '15 minutes') ON CONFLICT(username) DO UPDATE SET attempts=app_login_limits.attempts+1 RETURNING attempts",
        [input.username],
      );
      if ((result.rows[0]?.attempts ?? 99) > 5)
        throw new HttpException(
          'Too many sign-in attempts for this username. Retry after 15 minutes.',
          429,
        );
    });
    return this.transaction(async (c) => {
      const result = await c.query<UserRow>(
        'SELECT * FROM app_users WHERE username=$1 FOR UPDATE',
        [input.username],
      );
      const row = result.rows[0];
      const computed = await derivePassword(
        input.password,
        row?.password_salt ?? '0'.repeat(64),
      );
      if (!row || !matchesPassword(computed, row.password_hash))
        throw new UnauthorizedException('Username or password is incorrect.');
      await c.query('DELETE FROM app_login_limits WHERE username=$1', [
        input.username,
      ]);
      return { account: user(row), token: await this.issue(c, row.id) };
    });
  }
  async logout(cookie?: string) {
    return this.transaction(async (c) => {
      const hash = sessionFromCookie(cookie);
      if (hash)
        await c.query('DELETE FROM app_sessions WHERE token_hash=$1', [hash]);
      return { ok: true as const };
    });
  }
  async watchlist(cookie?: string) {
    return this.transaction(async (c) => {
      const account = await this.require(c, cookie);
      const result = await c.query<{ indicators: string[] }>(
        'SELECT indicators FROM app_watchlists WHERE user_id=$1',
        [account.id],
      );
      return WatchlistSchema.parse({
        indicators: result.rows[0]?.indicators ?? [],
      });
    });
  }
  async saveWatchlist(body: unknown, cookie?: string) {
    const input = parse(WatchlistSchema, body);
    return this.transaction(async (c) => {
      const account = await this.require(c, cookie);
      await c.query(
        'INSERT INTO app_watchlists(user_id,indicators) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET indicators=excluded.indicators,updated_at=now()',
        [account.id, input.indicators],
      );
      return input;
    });
  }
  async inbox(cookie?: string) {
    return this.transaction(async (c) => {
      const account = await this.require(c, cookie);
      return this.inboxFor(c, account.id);
    });
  }
  async inboxFor(c: pg.PoolClient, userId: string) {
    const result = await c.query<{
      indicator: string;
      id: string;
      year: number;
      value: string | null;
      revision: number;
      retrieved_at: Date;
      source_url: string;
      read: boolean;
    }>(
      `
        SELECT o.*, EXISTS(SELECT 1 FROM app_observation_receipts r WHERE r.user_id=$1 AND r.observation_id=o.id) AS read
        FROM app_watchlists w
        CROSS JOIN LATERAL unnest(w.indicators) AS followed(indicator)
        CROSS JOIN LATERAL (
          SELECT id,indicator,year,value::text,revision,retrieved_at,source_url
          FROM (SELECT DISTINCT ON (year) * FROM macro_observations WHERE indicator=followed.indicator ORDER BY year DESC,revision DESC) versions
          WHERE value IS NOT NULL OR revision > 1 ORDER BY year DESC LIMIT 1
        ) o WHERE w.user_id=$1 AND NOT EXISTS (
          SELECT 1 FROM app_alert_preferences p WHERE p.user_id=w.user_id AND p.indicator=o.indicator AND p.muted
        ) ORDER BY o.indicator`,
      [userId],
    );
    return InboxSchema.parse({
      items: result.rows.map((row) => ({
        indicator: row.indicator,
        observationId: row.id,
        year: row.year,
        value: row.value,
        revision: row.revision,
        retrievedAt: row.retrieved_at.toISOString(),
        kind: row.revision > 1 ? 'correction' : 'observation',
        read: row.read,
        sourceUrl: row.source_url,
      })),
    });
  }
  async acknowledge(body: unknown, cookie?: string) {
    const input = parse(AcknowledgeSchema, body);
    return this.transaction(async (c) => {
      const account = await this.require(c, cookie);
      const allowed = await c.query(
        'SELECT 1 FROM macro_observations o JOIN app_watchlists w ON o.indicator=ANY(w.indicators) WHERE w.user_id=$1 AND o.id=$2',
        [account.id, input.observationId],
      );
      if (!allowed.rowCount)
        throw new BadRequestException(
          'Observation is not in your followed indicators.',
        );
      await c.query(
        'INSERT INTO app_observation_receipts(user_id,observation_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [account.id, input.observationId],
      );
      return { ok: true as const };
    });
  }

  async remove(body: unknown, cookie: string | undefined, ip: string) {
    this.deletionIpLimits.consume(ip);
    const input = parse(DeleteAccountSchema, body);
    return this.transaction(async (c) => {
      const owner = await this.require(c, cookie);
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        owner.id,
      ]);
      const account = await this.require(c, cookie);
      // In-memory attempts survive a failed password transaction.
      this.deletionOwnerLimits.consume(account.id);
      const computed = await derivePassword(
        input.password,
        account.password_salt,
      );
      if (!matchesPassword(computed, account.password_hash))
        throw new UnauthorizedException(
          'Password is incorrect. Account was not deleted.',
        );
      await c.query('DELETE FROM app_users WHERE id=$1', [account.id]);
      await c.query('DELETE FROM app_login_limits WHERE username=$1', [
        account.username,
      ]);
      return { ok: true as const };
    });
  }
}
interface HttpResponse {
  setHeader(name: string, value: string): void;
}
interface HttpRequest {
  socket: { remoteAddress?: string };
}
@Controller('account')
export class AccountController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get() current(@Headers('cookie') cookie?: string) {
    return this.store.current(cookie);
  }
  @Post('register') async register(
    @Body() body: unknown,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    const result = await this.store.register(
      body,
      req.socket.remoteAddress ?? 'unknown',
    );
    res.setHeader('Set-Cookie', this.store.cookie(result.token));
    return { user: result.account };
  }
  @Post('login') @HttpCode(200) async login(
    @Body() body: unknown,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    const result = await this.store.login(
      body,
      req.socket.remoteAddress ?? 'unknown',
    );
    res.setHeader('Set-Cookie', this.store.cookie(result.token));
    return { user: result.account };
  }
  @Post('logout') @HttpCode(200) async logout(
    @Res({ passthrough: true }) res: HttpResponse,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const result = await this.store.logout(cookie);
    res.setHeader('Set-Cookie', this.store.cookie('', true));
    return result;
  }
  @Get('watchlist') watchlist(@Headers('cookie') cookie?: string) {
    return this.store.watchlist(cookie);
  }
  @Put('watchlist') saveWatchlist(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    return this.store.saveWatchlist(body, cookie);
  }
  @Get('inbox') inbox(@Headers('cookie') cookie?: string) {
    return this.store.inbox(cookie);
  }
  @Post('inbox/acknowledge') @HttpCode(200) acknowledge(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    return this.store.acknowledge(body, cookie);
  }
  @Delete() async remove(
    @Body() body: unknown,
    @Req() req: HttpRequest,
    @Res({ passthrough: true }) res: HttpResponse,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const result = await this.store.remove(
      body,
      cookie,
      req.socket.remoteAddress ?? 'unknown',
    );
    res.setHeader('Set-Cookie', this.store.cookie('', true));
    return result;
  }
}
export function accountProvider(config: AppConfig) {
  return { provide: STORE, useValue: new AccountStore(config) };
}
