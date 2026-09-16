import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import { HoldingsSnapshotSchema } from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
export type PrivateHoldingsRow = {
  user_id: string;
  version: number;
  payload: unknown;
  encrypted_payload: unknown;
};
export function encryptHoldings(
  userId: string,
  value: unknown,
  keys: PrivateDataKeys,
) {
  const snapshot = HoldingsSnapshotSchema.parse(value);
  return sealPrivateJson(
    'holdings-revision',
    userId,
    String(snapshot.version),
    snapshot,
    keys,
  );
}
export async function decryptHoldingsRows(
  c: pg.PoolClient,
  userId: string,
  rows: PrivateHoldingsRow[],
  keys: PrivateDataKeys,
) {
  for (const row of rows) {
    if (row.user_id !== userId)
      throw new ServiceUnavailableException(
        'Stored holdings owner could not be verified.',
      );
    const snapshot = HoldingsSnapshotSchema.parse(
      row.encrypted_payload == null
        ? row.payload
        : openPrivateJson(
            'holdings-revision',
            userId,
            String(row.version),
            row.encrypted_payload,
            keys,
          ),
    );
    if (snapshot.version !== row.version)
      throw new ServiceUnavailableException(
        'Stored holdings version could not be verified.',
      );
    if (
      row.encrypted_payload == null ||
      privatePayloadNeedsRotation(row.encrypted_payload, keys)
    ) {
      const changed = await c.query(
        'UPDATE app_holdings_revisions SET payload=NULL,encrypted_payload=$3 WHERE user_id=$1 AND version=$2',
        [userId, row.version, encryptHoldings(userId, snapshot, keys)],
      );
      if (changed.rowCount !== 1)
        throw new ServiceUnavailableException(
          'Stored holdings owner could not be verified.',
        );
    }
    row.payload = snapshot;
  }
}
export function encryptHoldingsPreview(
  userId: string,
  id: string,
  value: unknown,
  keys: PrivateDataKeys,
) {
  return sealPrivateJson('holdings-preview', userId, id, value, keys);
}
export async function decryptHoldingsPreview(
  c: pg.PoolClient,
  userId: string,
  row: {
    id: string;
    user_id: string;
    payload: unknown;
    encrypted_payload: unknown;
  },
  keys: PrivateDataKeys,
) {
  if (row.user_id !== userId)
    throw new ServiceUnavailableException(
      'Stored preview owner could not be verified.',
    );
  const value =
    row.encrypted_payload == null
      ? row.payload
      : openPrivateJson(
          'holdings-preview',
          userId,
          row.id,
          row.encrypted_payload,
          keys,
        );
  if (
    row.encrypted_payload == null ||
    privatePayloadNeedsRotation(row.encrypted_payload, keys)
  ) {
    const changed = await c.query(
      'UPDATE app_holdings_previews SET payload=NULL,encrypted_payload=$3 WHERE user_id=$1 AND id=$2',
      [userId, row.id, encryptHoldingsPreview(userId, row.id, value, keys)],
    );
    if (changed.rowCount !== 1)
      throw new ServiceUnavailableException(
        'Stored preview owner could not be verified.',
      );
  }
  row.payload = value;
}
