import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import { SavedBondComparisonSchema } from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
export function encryptBondReceipt(
  userId: string,
  id: string,
  payload: unknown,
  keys: PrivateDataKeys,
) {
  const saved = SavedBondComparisonSchema.parse(payload);
  if (saved.id !== id)
    throw new ServiceUnavailableException(
      'Saved comparison identity could not be verified.',
    );
  return sealPrivateJson('bond-comparison', userId, id, saved, keys);
}
export async function decryptBondReceipts(
  c: pg.PoolClient,
  userId: string,
  rows: Record<string, unknown>[],
  keys: PrivateDataKeys,
) {
  for (const row of rows) {
    if (row.user_id !== userId || typeof row.id !== 'string')
      throw new ServiceUnavailableException(
        'Saved comparison owner could not be verified.',
      );
    const value = SavedBondComparisonSchema.parse(
      row.encrypted_payload == null
        ? row.payload
        : openPrivateJson(
            'bond-comparison',
            userId,
            row.id,
            row.encrypted_payload,
            keys,
          ),
    );
    if (value.id !== row.id)
      throw new ServiceUnavailableException(
        'Saved comparison identity could not be verified.',
      );
    if (
      row.encrypted_payload == null ||
      privatePayloadNeedsRotation(row.encrypted_payload, keys)
    ) {
      const changed = await c.query(
        'UPDATE app_bond_comparisons SET payload=NULL,encrypted_payload=$3 WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL',
        [userId, row.id, encryptBondReceipt(userId, row.id, value, keys)],
      );
      if (changed.rowCount !== 1)
        throw new ServiceUnavailableException(
          'Saved comparison owner could not be verified.',
        );
    }
    row.payload = value;
  }
}
