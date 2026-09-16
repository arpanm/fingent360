import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import { AllocationSnapshotSchema } from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
export function encryptAllocation(
  userId: string,
  value: unknown,
  keys: PrivateDataKeys,
) {
  const saved = AllocationSnapshotSchema.parse(value);
  return sealPrivateJson(
    'allocation-revision',
    userId,
    String(saved.version),
    saved,
    keys,
  );
}
export async function decryptAllocationRows(
  c: pg.PoolClient,
  userId: string,
  rows: {
    user_id: string;
    version: number;
    payload: unknown;
    encrypted_payload: unknown;
  }[],
  keys: PrivateDataKeys,
) {
  for (const row of rows) {
    if (row.user_id !== userId)
      throw new ServiceUnavailableException(
        'Stored allocation owner could not be verified.',
      );
    const saved = AllocationSnapshotSchema.parse(
      row.encrypted_payload == null
        ? row.payload
        : openPrivateJson(
            'allocation-revision',
            userId,
            String(row.version),
            row.encrypted_payload,
            keys,
          ),
    );
    if (saved.version !== row.version)
      throw new ServiceUnavailableException(
        'Stored allocation version could not be verified.',
      );
    if (
      row.encrypted_payload == null ||
      privatePayloadNeedsRotation(row.encrypted_payload, keys)
    ) {
      const changed = await c.query(
        'UPDATE app_goal_allocation_revisions SET payload=NULL,encrypted_payload=$3 WHERE user_id=$1 AND version=$2',
        [userId, row.version, encryptAllocation(userId, saved, keys)],
      );
      if (changed.rowCount !== 1)
        throw new ServiceUnavailableException(
          'Stored allocation owner could not be verified.',
        );
    }
    row.payload = saved;
  }
}
export async function exportPrivateAllocations(
  c: pg.PoolClient,
  userId: string,
  keys: PrivateDataKeys,
) {
  const rows = await c.query(
    'SELECT user_id,version,payload,encrypted_payload FROM app_goal_allocation_revisions WHERE user_id=$1 ORDER BY version',
    [userId],
  );
  await decryptAllocationRows(c, userId, rows.rows, keys);
  return { revisions: rows.rows.map((row) => row.payload) };
}
