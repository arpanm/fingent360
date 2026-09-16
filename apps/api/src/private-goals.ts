import type pg from 'pg';
import { ServiceUnavailableException } from '@nestjs/common';
import { SavedGoalSchema, type SavedGoal } from '@fingent360/contracts';
import {
  openPrivateJson,
  sealPrivateJson,
  privatePayloadNeedsRotation,
  type PrivateDataKeys,
} from './private-data-crypto.js';

export type PrivateGoalRow = {
  goal_id: string;
  version: number;
  payload: unknown;
  encrypted_payload: unknown;
};
const binding = (goalId: string, version: number) => `${goalId}:${version}`;
export function encryptGoal(
  userId: string,
  value: SavedGoal,
  keys: PrivateDataKeys,
) {
  const goal = SavedGoalSchema.parse(value);
  return sealPrivateJson(
    'goal-revision',
    userId,
    binding(goal.id, goal.version),
    goal,
    keys,
  );
}
// Call only after owner admission. Mutates returned rows, never database-query behavior.
export async function decryptGoalRows(
  c: pg.PoolClient,
  userId: string,
  rows: PrivateGoalRow[],
  keys: PrivateDataKeys,
) {
  for (const row of rows) {
    const goal = SavedGoalSchema.parse(
      row.encrypted_payload == null
        ? row.payload
        : openPrivateJson(
            'goal-revision',
            userId,
            binding(row.goal_id, row.version),
            row.encrypted_payload,
            keys,
          ),
    );
    if (goal.id !== row.goal_id || goal.version !== row.version)
      throw new ServiceUnavailableException(
        'Stored goal identity could not be verified.',
      );
    if (
      row.encrypted_payload == null ||
      privatePayloadNeedsRotation(row.encrypted_payload, keys)
    ) {
      const changed = await c.query(
        'UPDATE app_goal_revisions r SET payload=NULL,encrypted_payload=$4 FROM app_goals g WHERE r.goal_id=$1 AND r.version=$2 AND g.id=r.goal_id AND g.user_id=$3',
        [row.goal_id, row.version, userId, encryptGoal(userId, goal, keys)],
      );
      if (changed.rowCount !== 1)
        throw new ServiceUnavailableException(
          'Stored goal owner could not be verified.',
        );
    }
    row.payload = goal;
  }
}
