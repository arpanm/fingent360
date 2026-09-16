import { z } from 'zod';
import { requireAuthenticator } from './account-mfa-crypto.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  RecoveryGenerateSchema,
  RecoveryResetSchema,
  RecoveryStatusSchema,
  RecoveryCreatedSchema,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import {
  derivePassword,
  matchesPassword,
  newSalt,
  sessionHash,
} from './account-security.js';
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new BadRequestException(
      'Provide the required recovery fields in the correct format.',
    );
  return result.data;
}
const invalid = () =>
  new UnauthorizedException(
    'Recovery could not be completed. Check the username and recovery code.',
  );
@Controller('account/recovery')
export class RecoveryController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  private async consume(keys: { key: string; max: number }[]) {
    const allowed = await this.store.transaction(async (c) => {
      await c.query('DELETE FROM app_recovery_limits WHERE reset_at<=now()');
      // Callers put the global IP budget first. Its UPSERT row lock remains
      // held until commit, serializing admission before any per-user row is
      // allocated. A denied request cannot grow counters or key cardinality.
      for (const item of keys) {
        const r = await c.query<{ attempts: number }>(
          "INSERT INTO app_recovery_limits(key_hash,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=app_recovery_limits.attempts+1 WHERE app_recovery_limits.attempts<$2 RETURNING attempts",
          [sessionHash(item.key), item.max],
        );
        if (!r.rows[0]) return false;
      }
      return true;
    });
    if (!allowed)
      throw new HttpException(
        'Too many recovery attempts. Retry after 15 minutes.',
        429,
      );
  }
  @Get() async status(
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      const r = await c.query<{ created_at: Date; consumed_at: Date | null }>(
        'SELECT created_at,consumed_at FROM app_account_recovery WHERE user_id=$1',
        [user.id],
      );
      return RecoveryStatusSchema.parse({
        configured: !!r.rows[0] && !r.rows[0].consumed_at,
        createdAt: r.rows[0]?.created_at.toISOString() ?? null,
      });
    });
  }
  @Post('code') async generate(
    @Body() raw: unknown,
    @Headers('origin') origin: string | undefined,
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ) {
    response.setHeader('Cache-Control', 'no-store');
    this.store.origin(origin);
    const input = parse(RecoveryGenerateSchema, raw);
    const user = await this.store.transaction((c) =>
      this.store.require(c, cookie),
    );
    await this.consume([{ key: `generate:${user.id}`, max: 5 }]);
    return this.store.transaction(async (c) => {
      await c.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [
        user.id,
      ]);
      const current = await this.store.require(c, cookie);
      if (
        !matchesPassword(
          await derivePassword(input.currentPassword, current.password_salt),
          current.password_hash,
        )
      )
        throw new UnauthorizedException('Current password is incorrect.');
      await requireAuthenticator(
        c,
        user.id,
        input.authenticatorCode,
        this.store.privateDataKeys,
      );
      const code = randomBytes(32).toString('hex');
      const r = await c.query<{ created_at: Date }>(
        'INSERT INTO app_account_recovery(user_id,code_hash) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,created_at=now(),consumed_at=NULL RETURNING created_at',
        [user.id, sessionHash(code)],
      );
      return RecoveryCreatedSchema.parse({
        code,
        createdAt: r.rows[0]!.created_at.toISOString(),
      });
    });
  }
  @Post('reset') @HttpCode(200) async reset(
    @Body() raw: unknown,
    @Headers('origin') origin: string | undefined,
    @Req() req: { socket: { remoteAddress?: string } },
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ) {
    response.setHeader('Cache-Control', 'no-store');
    this.store.origin(origin);
    const input = parse(RecoveryResetSchema, raw);
    await this.consume([
      { key: `reset-ip:${req.socket.remoteAddress ?? 'unknown'}`, max: 30 },
      {
        key: `reset-user:${this.store.identityLookup(input.username)}`,
        max: 5,
      },
    ]);
    const salt = newSalt(),
      password = await derivePassword(input.newPassword, salt),
      codeHash = sessionHash(input.code);
    await this.store.transaction(async (c) => {
      const users = await this.store.identityUser(c, input.username);
      const id = users.rows[0]?.id;
      const records = await c.query<{
        code_hash: string;
        consumed_at: Date | null;
      }>(
        'SELECT code_hash,consumed_at FROM app_account_recovery WHERE user_id=$1',
        [id ?? null],
      );
      const record = records.rows[0];
      const equal = timingSafeEqual(
        Buffer.from(codeHash, 'hex'),
        Buffer.from(record?.code_hash ?? '0'.repeat(64), 'hex'),
      );
      if (!id || !record || record.consumed_at || !equal) throw invalid();
      await c.query(
        'UPDATE app_account_recovery SET consumed_at=now() WHERE user_id=$1',
        [id],
      );
      await c.query(
        'UPDATE app_users SET password_hash=$2,password_salt=$3 WHERE id=$1',
        [id, password, salt],
      );
      await c.query('DELETE FROM app_account_mfa WHERE user_id=$1', [id]);
      await c.query('DELETE FROM app_mfa_limits WHERE user_id=$1', [id]);
      await c.query('DELETE FROM app_sessions WHERE user_id=$1', [id]);
      await c.query('DELETE FROM app_login_limits WHERE username=$1', [
        this.store.identityLookup(input.username),
      ]);
    });
    response.setHeader('Set-Cookie', this.store.cookie('', true));
    return { ok: true };
  }
}
