import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import type pg from 'pg';
import {
  openPrivateJson,
  sealPrivateJson,
  type PrivateDataKeys,
} from './private-data-crypto.js';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function newAuthenticatorSecret() {
  const bits = [...randomBytes(20)]
    .map((n) => n.toString(2).padStart(8, '0'))
    .join('');
  return bits
    .match(/.{5}/g)!
    .map((part) => alphabet[parseInt(part, 2)])
    .join('');
}
export function authenticatorCode(secret: string, step: number) {
  if (!/^[A-Z2-7]{32}$/.test(secret) || !Number.isSafeInteger(step) || step < 0)
    throw Error('Invalid authenticator parameters.');
  const bits = [...secret]
    .map((ch) => alphabet.indexOf(ch).toString(2).padStart(5, '0'))
    .join('');
  const key = Buffer.from(
    bits.match(/.{8}/g)!.map((part) => parseInt(part, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hash = createHmac('sha1', key).update(counter).digest();
  const offset = hash[19]! & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, '0');
}
export function matchedAuthenticatorStep(
  secret: string,
  code: string,
  last: number,
  now = Date.now(),
) {
  if (!/^[0-9]{6}$/.test(code)) return null;
  const current = Math.floor(now / 30000);
  let matched: number | null = null;
  for (const step of [current - 1, current, current + 1])
    if (
      step >= 0 &&
      timingSafeEqual(
        Buffer.from(authenticatorCode(secret, step)),
        Buffer.from(code),
      ) &&
      step > last
    )
      matched = step;
  return matched;
}
export function encryptAuthenticator(
  userId: string,
  secret: string,
  keys: PrivateDataKeys,
) {
  return sealPrivateJson('account-mfa', userId, userId, { secret }, keys);
}
export function decryptAuthenticator(
  userId: string,
  value: unknown,
  keys: PrivateDataKeys,
) {
  const clear = openPrivateJson('account-mfa', userId, userId, value, keys);
  const parsed = z
    .strictObject({ secret: z.string().regex(/^[A-Z2-7]{32}$/) })
    .safeParse(clear);
  if (!parsed.success)
    throw new ServiceUnavailableException(
      'Authenticator storage is unavailable. Use your saved recovery code or ask the operator to restore the server keys.',
    );
  return parsed.data.secret;
}
export async function requireAuthenticator(
  c: pg.PoolClient,
  userId: string,
  code: string | undefined,
  keys: PrivateDataKeys,
) {
  const result = await c.query<{
    encrypted_secret: unknown;
    last_step: string;
  }>(
    'SELECT encrypted_secret,last_step FROM app_account_mfa WHERE user_id=$1 AND enabled FOR UPDATE',
    [userId],
  );
  const row = result.rows[0];
  if (!row) return;
  const secret = decryptAuthenticator(userId, row.encrypted_secret, keys),
    step = matchedAuthenticatorStep(secret, code || '', Number(row.last_step));
  if (step === null)
    throw new UnauthorizedException(
      'Authenticator code is missing, invalid or already used. Wait for a new code and try again.',
    );
  await c.query(
    'UPDATE app_account_mfa SET last_step=$2,encrypted_secret=$3,updated_at=now() WHERE user_id=$1',
    [userId, step, encryptAuthenticator(userId, secret, keys)],
  );
}
