import { createHash } from 'node:crypto';
import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  GoalComparisonSchema,
  GoalAdoptionSchema,
  GoalFeasibilitySchema,
} from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';
type Kind = 'goal-comparison' | 'goal-adoption' | 'goal-feasibility';
const stores = {
  'goal-comparison': { table: 'app_goal_comparisons', id: 'id' },
  'goal-adoption': { table: 'app_goal_adoptions', id: 'request_id' },
  'goal-feasibility': { table: 'app_goal_feasibility', id: 'id' },
} as const;
function validated(kind: Kind, value: unknown) {
  return kind === 'goal-comparison'
    ? GoalComparisonSchema.parse(value)
    : kind === 'goal-adoption'
      ? GoalAdoptionSchema.parse(value)
      : GoalFeasibilitySchema.parse(value);
}
export function sealGoalRecord(
  kind: Kind,
  userId: string,
  id: string,
  value: unknown,
  keys: PrivateDataKeys,
) {
  const data = validated(kind, value);
  return {
    envelope: sealPrivateJson(kind, userId, id, data, keys),
    hash: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
  };
}
export async function openGoalRecord(
  c: pg.PoolClient,
  kind: Kind,
  userId: string,
  id: string,
  row: {
    payload: unknown;
    encrypted_payload: unknown;
    content_hash: string | null;
  },
  keys: PrivateDataKeys,
) {
  const data = validated(
    kind,
    row.encrypted_payload == null
      ? row.payload
      : openPrivateJson(kind, userId, id, row.encrypted_payload, keys),
  );
  const recordId =
    kind === 'goal-adoption'
      ? GoalAdoptionSchema.parse(data).requestId
      : kind === 'goal-comparison'
        ? GoalComparisonSchema.parse(data).id
        : GoalFeasibilitySchema.parse(data).id;
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  if (
    recordId !== id ||
    (row.encrypted_payload != null && hash !== row.content_hash)
  )
    throw new ServiceUnavailableException(
      'Stored goal receipt integrity could not be verified.',
    );
  if (
    row.encrypted_payload == null ||
    privatePayloadNeedsRotation(row.encrypted_payload, keys)
  ) {
    const store = stores[kind];
    const changed = await c.query(
      `UPDATE ${store.table} SET payload=NULL,encrypted_payload=$3,content_hash=$4 WHERE user_id=$1 AND ${store.id}=$2`,
      [userId, id, sealPrivateJson(kind, userId, id, data, keys), hash],
    );
    if (changed.rowCount !== 1)
      throw new ServiceUnavailableException(
        'Stored goal receipt owner could not be verified.',
      );
  }
  row.payload = data;
  return data;
}
