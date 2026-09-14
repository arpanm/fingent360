import { INTERNAL_OPERATOR } from './operator-internal.js';
import {
  NamedOperatorStore,
  type OperatorPermission,
} from './named-operator-store.js';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
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
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import pg from 'pg';
import { z } from 'zod';
import { checkOrigin } from './account-security.js';
import type { AppConfig } from './config.js';
export const OPERATOR_STORE = Symbol('OPERATOR_STORE');
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export class OperatorStore {
  private readonly pool: pg.Pool;
  readonly named: NamedOperatorStore;
  get namedMode() {
    return this.config.OPS_AUTH_MODE === 'named';
  }
  async permission(
    cookie: string | undefined,
    permission: OperatorPermission,
    client?: pg.PoolClient,
  ) {
    if (this.namedMode) return this.named.require(cookie, permission, client);
    return this.require(cookie);
  }
  constructor(private readonly config: AppConfig) {
    this.named = new NamedOperatorStore(config);
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
    });
    this.pool.on('error', () => {});
  }
  async onApplicationShutdown() {
    await this.pool.end();
    await this.named.close();
  }
  serverAuthorization() {
    if (this.namedMode) return INTERNAL_OPERATOR;
    if (!this.config.RESEARCH_ADMIN_TOKEN)
      throw new ServiceUnavailableException('Operator key unavailable.');
    return `Bearer ${this.config.RESEARCH_ADMIN_TOKEN}`;
  }
  origin(value?: string) {
    checkOrigin(value, this.config.WEB_ORIGIN);
  }
  cookie(token: string, clear = false) {
    return `f360_ops=${token}; Path=/api/v1/ops; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 3600}${new URL(this.config.WEB_ORIGIN).protocol === 'https:' ? '; Secure' : ''}`;
  }
  private token(cookie?: string) {
    const tokens = (cookie ?? '')
      .split(';')
      .map((v) => v.trim())
      .filter((v) => v.startsWith('f360_ops='));
    return tokens.length === 1 && /^[a-f0-9]{64}$/.test(tokens[0]!.slice(9))
      ? tokens[0]!.slice(9)
      : null;
  }
  async session(cookie?: string) {
    if (this.namedMode) return this.named.session(cookie);
    const token = this.token(cookie);
    if (!token) return { authenticated: false, expiresAt: null };
    try {
      const r = await this.pool.query<{ expires_at: Date }>(
        'SELECT expires_at FROM operator_sessions WHERE token_hash=$1 AND operator_id IS NULL AND expires_at>clock_timestamp()',
        [hash(token)],
      );
      return {
        authenticated: !!r.rows[0],
        expiresAt: r.rows[0]?.expires_at.toISOString() ?? null,
      };
    } catch {
      throw new ServiceUnavailableException(
        'Operations storage unavailable. Apply migrations and retry.',
      );
    }
  }
  async require(cookie?: string) {
    if (!(await this.session(cookie)).authenticated)
      throw new UnauthorizedException('Sign in to operations.');
    return hash(this.token(cookie)!);
  }
  async record(action: string, target: string, cookie?: string) {
    const actor = await this.require(cookie);
    await this.pool.query(
      'INSERT INTO operator_audit(id,actor_hash,action,target) VALUES($1,$2,$3,$4)',
      [randomUUID(), actor, action.slice(0, 100), target.slice(0, 200)],
    );
  }
  async login(body: unknown, client: string) {
    if (this.namedMode) return this.named.login(body, client);
    const input = z
      .strictObject({ key: z.string().regex(/^[a-f0-9]{64}$/) })
      .safeParse(body);
    if (!this.config.RESEARCH_ADMIN_TOKEN)
      throw new ServiceUnavailableException(
        'Operations key is not configured.',
      );
    const clientHash = hash(client);
    try {
      const blocked = await this.pool.query<{ attempts: number }>(
        'SELECT attempts FROM operator_login_limits WHERE client_hash=$1 AND reset_at>now()',
        [clientHash],
      );
      if ((blocked.rows[0]?.attempts ?? 0) >= 20)
        throw new HttpException(
          'Too many operations sign-in attempts. Retry later.',
          429,
        );
      const valid =
        input.success &&
        timingSafeEqual(
          Buffer.from(input.data.key),
          Buffer.from(this.config.RESEARCH_ADMIN_TOKEN),
        );
      if (!valid) {
        const attempt = await this.pool.query<{ attempts: number }>(
          "INSERT INTO operator_login_limits(client_hash,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(client_hash) DO UPDATE SET attempts=CASE WHEN operator_login_limits.reset_at<=now() THEN 1 ELSE operator_login_limits.attempts+1 END,reset_at=CASE WHEN operator_login_limits.reset_at<=now() THEN now()+interval '15 minutes' ELSE operator_login_limits.reset_at END RETURNING attempts",
          [clientHash],
        );
        if ((attempt.rows[0]?.attempts ?? 100) > 20)
          throw new HttpException(
            'Too many operations sign-in attempts. Retry later.',
            429,
          );
        if (!input.success)
          throw new BadRequestException('Enter a valid operator key.');
        throw new UnauthorizedException('Operator key is incorrect.');
      }
      // Successful authentication clears earlier mistakes but never bypasses an
      // already active lockout. Only failed attempts consume the allowance.
      await this.pool.query(
        'DELETE FROM operator_login_limits WHERE client_hash=$1',
        [clientHash],
      );
      const token = randomBytes(32).toString('hex');
      await this.pool.query(
        'DELETE FROM operator_sessions WHERE expires_at<=now()',
      );
      await this.pool.query(
        "INSERT INTO operator_sessions(token_hash,expires_at) VALUES($1,now()+interval '1 hour')",
        [hash(token)],
      );
      return token;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Operations storage unavailable. Apply migrations and retry.',
      );
    }
  }
  async logout(cookie?: string) {
    const token = this.token(cookie);
    if (token)
      await this.pool.query(
        'DELETE FROM operator_sessions WHERE token_hash=$1',
        [hash(token)],
      );
    return { ok: true };
  }
}
interface Response {
  setHeader(name: string, value: string): void;
}
@Controller('ops/session')
export class OperatorController {
  constructor(@Inject(OPERATOR_STORE) private readonly store: OperatorStore) {}
  @Get() get(@Headers('cookie') cookie?: string) {
    return this.store.session(cookie);
  }
  @Post() @HttpCode(200) async login(
    @Body() body: unknown,
    @Headers('origin') origin: string | undefined,
    @Req() req: { socket: { remoteAddress?: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    this.store.origin(origin);
    const token = await this.store.login(
      body,
      req.socket.remoteAddress ?? 'unknown',
    );
    res.setHeader('Set-Cookie', this.store.cookie(token));
    return this.store.session(`f360_ops=${token}`);
  }
  @Delete() async logout(
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.store.origin(origin);
    await this.store.logout(cookie);
    res.setHeader('Set-Cookie', this.store.cookie('', true));
    return { authenticated: false, expiresAt: null };
  }
}
export function operatorProvider(config: AppConfig) {
  return { provide: OPERATOR_STORE, useValue: new OperatorStore(config) };
}
