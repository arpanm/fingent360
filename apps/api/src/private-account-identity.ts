import { createHmac } from 'node:crypto';
import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import { AccountSchema } from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
export function identityLookup(username: string, key: string | undefined) {
  if (!key)
    throw new ServiceUnavailableException(
      'Account identity protection is unavailable. Configure the private identity lookup key.',
    );
  const decoded = Buffer.from(key, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== key)
    throw new ServiceUnavailableException(
      'Account identity protection is unavailable.',
    );
  return createHmac('sha256', decoded)
    .update('fingent360-account-username-v1\0')
    .update(AccountSchema.shape.username.parse(username))
    .digest('hex');
}
export function encryptIdentity(
  id: string,
  username: string,
  keys: PrivateDataKeys,
) {
  return sealPrivateJson(
    'account-identity',
    id,
    id,
    { username: AccountSchema.shape.username.parse(username) },
    keys,
  );
}
export async function decodeIdentity<
  T extends {
    id: string;
    username: string;
    username_lookup?: string | null;
    encrypted_identity?: unknown;
  },
>(
  c: pg.PoolClient,
  row: T,
  keys: PrivateDataKeys,
  lookupKey: string | undefined,
) {
  const raw =
    row.encrypted_identity == null
      ? { username: row.username }
      : openPrivateJson(
          'account-identity',
          row.id,
          row.id,
          row.encrypted_identity,
          keys,
        );
  if (!raw || typeof raw !== 'object' || !('username' in raw))
    throw new ServiceUnavailableException(
      'Stored account identity is unreadable.',
    );
  const username = AccountSchema.shape.username.safeParse(raw.username);
  if (!username.success)
    throw new ServiceUnavailableException(
      'Stored account identity is unreadable.',
    );
  const lookup = identityLookup(username.data, lookupKey);
  if (row.username_lookup != null && row.username_lookup !== lookup)
    throw new ServiceUnavailableException(
      'Account identity lookup could not be verified.',
    );
  if (
    row.encrypted_identity == null ||
    privatePayloadNeedsRotation(row.encrypted_identity, keys)
  ) {
    const changed = await c.query(
      'UPDATE app_users SET username=NULL,username_lookup=$2,encrypted_identity=$3 WHERE id=$1',
      [row.id, lookup, encryptIdentity(row.id, username.data, keys)],
    );
    if (changed.rowCount !== 1)
      throw new ServiceUnavailableException(
        'Account identity owner could not be verified.',
      );
  }
  row.username = username.data;
  row.username_lookup = lookup;
  return row;
}
