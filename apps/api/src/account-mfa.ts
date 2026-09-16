import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Header,
  Inject,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  HttpException,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  MfaStatusSchema,
  MfaStartSchema,
  MfaConfirmSchema,
  MfaEnrollmentSchema,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import {
  derivePassword,
  matchesPassword,
  sessionFromCookie,
} from './account-security.js';
import {
  newAuthenticatorSecret,
  encryptAuthenticator,
  decryptAuthenticator,
  matchedAuthenticatorStep,
  requireAuthenticator,
} from './account-mfa-crypto.js';
const input = <T>(schema: z.ZodType<T>, body: unknown) => {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new BadRequestException('Check the authenticator form fields.');
  return parsed.data;
};
@Controller('account/mfa')
export class AccountMfaController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  private async rate(cookie?: string) {
    await this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      const result = await c.query(
        "INSERT INTO app_mfa_limits(user_id,attempts,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(user_id) DO UPDATE SET attempts=CASE WHEN app_mfa_limits.reset_at<=now() THEN 1 ELSE app_mfa_limits.attempts+1 END,reset_at=CASE WHEN app_mfa_limits.reset_at<=now() THEN now()+interval '15 minutes' ELSE app_mfa_limits.reset_at END WHERE app_mfa_limits.attempts<5 OR app_mfa_limits.reset_at<=now() RETURNING user_id",
        [user.id],
      );
      if (!result.rowCount)
        throw new HttpException(
          'Too many authenticator changes. Retry after 15 minutes.',
          429,
        );
    });
  }
  private async owner(
    c: pg.PoolClient,
    cookie: string | undefined,
    password: string,
  ) {
    const user = await this.store.require(c, cookie);
    const rows = await c.query<{
      password_hash: string;
      password_salt: string;
    }>(
      'SELECT password_hash,password_salt FROM app_users WHERE id=$1 FOR UPDATE',
      [user.id],
    );
    const row = rows.rows[0];
    if (
      !row ||
      !matchesPassword(
        await derivePassword(password, row.password_salt),
        row.password_hash,
      )
    )
      throw new UnauthorizedException('Current password is incorrect.');
    return user;
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async status(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (c) => {
      const user = await this.store.require(c, cookie);
      await c.query(
        'DELETE FROM app_account_mfa WHERE user_id=$1 AND NOT enabled AND expires_at<=clock_timestamp()',
        [user.id],
      );
      const row = (
        await c.query<{ enabled: boolean }>(
          'SELECT enabled FROM app_account_mfa WHERE user_id=$1',
          [user.id],
        )
      ).rows[0];
      await this.store.require(c, cookie);
      return MfaStatusSchema.parse({
        enabled: row?.enabled ?? false,
        pending: !!row && !row.enabled,
      });
    });
  }
  @Post('setup')
  @Header('Cache-Control', 'private, no-store')
  async setup(
    @Body() body: unknown,
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    const value = input(MfaStartSchema, body);
    await this.rate(cookie);
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie, value.password);
      if (
        (
          await c.query(
            'SELECT 1 FROM app_account_mfa WHERE user_id=$1 AND enabled',
            [user.id],
          )
        ).rowCount
      )
        throw new ConflictException(
          'Authenticator is already enabled. Disable it before replacing it.',
        );
      if (
        !(
          await c.query(
            'SELECT 1 FROM app_account_recovery WHERE user_id=$1 AND consumed_at IS NULL',
            [user.id],
          )
        ).rowCount
      )
        throw new BadRequestException(
          'Create and safely save a recovery code before enabling an authenticator.',
        );
      const secret = newAuthenticatorSecret(),
        expiresAt = new Date(Date.now() + 600000).toISOString();
      await c.query(
        'INSERT INTO app_account_mfa(user_id,encrypted_secret,expires_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET encrypted_secret=$2,expires_at=$3,last_step=-1,updated_at=now()',
        [
          user.id,
          encryptAuthenticator(user.id, secret, this.store.privateDataKeys),
          expiresAt,
        ],
      );
      await this.store.require(c, cookie);
      return MfaEnrollmentSchema.parse({
        secret,
        uri: `otpauth://totp/${encodeURIComponent('Fingent360:' + user.username)}?secret=${secret}&issuer=Fingent360&algorithm=SHA1&digits=6&period=30`,
        expiresAt,
      });
    });
  }
  @Post('confirm')
  async confirm(
    @Body() body: unknown,
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    const value = input(MfaConfirmSchema, body);
    await this.rate(cookie);
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie, value.password);
      const row = (
        await c.query<{ encrypted_secret: unknown; last_step: string }>(
          'SELECT encrypted_secret,last_step FROM app_account_mfa WHERE user_id=$1 AND NOT enabled AND expires_at>clock_timestamp() FOR UPDATE',
          [user.id],
        )
      ).rows[0];
      if (!row)
        throw new BadRequestException(
          'Start a new authenticator setup; this one is unavailable or expired.',
        );
      const secret = decryptAuthenticator(
          user.id,
          row.encrypted_secret,
          this.store.privateDataKeys,
        ),
        step = matchedAuthenticatorStep(
          secret,
          value.code,
          Number(row.last_step),
        );
      if (step === null)
        throw new UnauthorizedException('Authenticator code is invalid.');
      await c.query(
        'UPDATE app_account_mfa SET enabled=true,expires_at=NULL,last_step=$2,encrypted_secret=$3,updated_at=now() WHERE user_id=$1',
        [
          user.id,
          step,
          encryptAuthenticator(user.id, secret, this.store.privateDataKeys),
        ],
      );
      await c.query(
        'DELETE FROM app_sessions WHERE user_id=$1 AND token_hash<>$2',
        [user.id, sessionFromCookie(cookie)],
      );
      await this.store.require(c, cookie);
      return MfaStatusSchema.parse({ enabled: true, pending: false });
    });
  }
  @Post('disable')
  async disable(
    @Body() body: unknown,
    @Headers('cookie') cookie: string | undefined,
    @Headers('origin') origin?: string,
  ) {
    this.store.origin(origin);
    const value = input(MfaConfirmSchema, body);
    await this.rate(cookie);
    return this.store.transaction(async (c) => {
      const user = await this.owner(c, cookie, value.password);
      if (
        !(
          await c.query(
            'SELECT 1 FROM app_account_mfa WHERE user_id=$1 AND enabled',
            [user.id],
          )
        ).rowCount
      )
        throw new BadRequestException('Authenticator is not enabled.');
      await requireAuthenticator(
        c,
        user.id,
        value.code,
        this.store.privateDataKeys,
      );
      await c.query('DELETE FROM app_account_mfa WHERE user_id=$1', [user.id]);
      await c.query(
        'DELETE FROM app_sessions WHERE user_id=$1 AND token_hash<>$2',
        [user.id, sessionFromCookie(cookie)],
      );
      await this.store.require(c, cookie);
      return MfaStatusSchema.parse({ enabled: false, pending: false });
    });
  }
}
