import { z } from 'zod';
import {
  GoalFeasibilityInputSchema,
  GoalFeasibilitySchema,
  GoalFeasibilityExportSchema,
  calculateGoalFeasibility,
  type GoalFeasibility,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type OfflineHandler,
  type LocalState,
} from './types';
import { localGoals, parseLocal } from './finance';

type Entry = {
  fingerprint: string;
  value: GoalFeasibility | null;
  deletedAt: string | null;
};
function records(state: LocalState, id: string) {
  return (
    (
      state.data.localGoalFeasibility as
        Record<string, Record<string, Entry>> | undefined
    )?.[id] ?? {}
  );
}
export function exportLocalGoalFeasibility(state: LocalState, id: string) {
  const rows = records(state, id);
  return GoalFeasibilityExportSchema.parse({
    assessments: Object.values(rows).flatMap((row) =>
      row.value ? [row.value] : [],
    ),
    deletedRequestCount: Object.values(rows).filter((row) => row.deletedAt)
      .length,
  });
}
export const handleGoalFeasibility: OfflineHandler = async (request, state) => {
  const base = '/api/v1/account/goal-feasibility';
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  const user = requireUser(state),
    rows = records(state, user.id);
  if (request.path === base && request.method === 'GET')
    return {
      body: {
        assessments: Object.values(rows)
          .flatMap((row) => (row.value ? [row.value] : []))
          .sort(
            (a, b) =>
              b.createdAt.localeCompare(a.createdAt) ||
              a.id.localeCompare(b.id),
          ),
      },
    };
  const id = parseLocal(
    z.uuid(),
    request.path.slice(base.length + 1),
  ).toLowerCase();
  if (request.method === 'DELETE') {
    const old = rows[id];
    if (!old) fail(404, 'Assessment unavailable.');
    if (!old.deletedAt)
      rows[id] = { ...old, value: null, deletedAt: new Date().toISOString() };
  } else if (request.method === 'PUT') {
    const input = parseLocal(GoalFeasibilityInputSchema, request.body);
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(input)),
    );
    const fingerprint = Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    const old = rows[id];
    if (old) {
      if (old.fingerprint !== fingerprint)
        fail(409, 'Request ID already used for different assumptions.');
      if (!old.value)
        fail(410, 'This assessment was deleted. Start a new assessment.');
      return { body: old.value };
    }
    const goal = localGoals(state, user.id).find(
      (item) => item.id === input.goalId,
    );
    if (!goal) fail(404, 'Saved goal unavailable.');
    if (goal.version !== input.expectedVersion)
      fail(409, 'Goal changed. Reload goals and review a new assessment.');
    if (Object.values(rows).filter((row) => row.value).length >= 100)
      fail(
        409,
        '100 assessments retained. Remove a saved assessment to make room.',
      );
    let result;
    try {
      result = calculateGoalFeasibility(goal, input);
    } catch {
      fail(400, 'Interruption cannot exceed the goal horizon.');
    }
    const value = parseLocal(GoalFeasibilitySchema, {
      id,
      createdAt: new Date().toISOString(),
      policy: 'downside-capacity-v1',
      currency: 'INR',
      scale: 2,
      goal,
      input,
      result,
    });
    rows[id] = { fingerprint, value, deletedAt: null };
  } else fail(404, 'Unknown assessment operation.');
  const all = (state.data.localGoalFeasibility ?? {}) as Record<
    string,
    Record<string, Entry>
  >;
  all[user.id] = rows;
  state.data.localGoalFeasibility = all;
  return { body: request.method === 'PUT' ? rows[id]!.value : { ok: true } };
};
