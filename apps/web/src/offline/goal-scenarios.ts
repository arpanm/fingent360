import { z } from 'zod';
import {
  GoalComparisonInputSchema,
  GoalComparisonSchema,
  GoalAdoptionInputSchema,
  GoalAdoptionSchema,
  GoalComparisonsSchema,
  GoalScenarioExportSchema,
  compareGoal,
  adoptGoal,
  type GoalComparison,
  type GoalAdoption,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type OfflineHandler,
  type LocalState,
} from './types';
import { localGoals, goalRecords, parseLocal } from './finance';
type Records = {
  comparisons: Record<string, { fingerprint: string; value: GoalComparison }>;
  adoptions: Record<string, { fingerprint: string; value: GoalAdoption }>;
};
function records(state: LocalState, id: string): Records {
  return (
    (state.data.localGoalScenarios as Record<string, Records> | undefined)?.[
      id
    ] ?? { comparisons: {}, adoptions: {} }
  );
}
export function exportLocalGoalScenarios(state: LocalState, id: string) {
  const data = records(state, id);
  return GoalScenarioExportSchema.parse({
    comparisons: Object.values(data.comparisons).map((r) => r.value),
    adoptions: Object.values(data.adoptions).map((r) => r.value),
  });
}
export const handleGoalScenarios: OfflineHandler = (req, state) => {
  const base = '/api/v1/account/goal-comparisons';
  if (req.path !== base && !req.path.startsWith(`${base}/`)) return null;
  const user = requireUser(state),
    data = records(state, user.id);
  const goals = localGoals(state, user.id);
  if (req.path === base && req.method === 'GET')
    return {
      body: GoalComparisonsSchema.parse({
        ...exportLocalGoalScenarios(state, user.id),
        goals,
      }),
    };
  const segments = req.path.slice(base.length + 1).split('/');
  const id = parseLocal(z.uuid(), segments[0]);
  if (req.method !== 'PUT' || segments.length > 2)
    return fail(404, 'Unknown comparison operation.');
  const persist = () => {
    state.data.localGoalScenarios = {
      ...(state.data.localGoalScenarios as Record<string, Records> | undefined),
      [user.id]: data,
    };
  };
  if (segments.length === 1) {
    const input = parseLocal(GoalComparisonInputSchema, req.body),
      fingerprint = JSON.stringify(input);
    const existing = data.comparisons[id];
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        return fail(409, 'Comparison ID already used.');
      return { body: GoalComparisonSchema.parse(existing.value) };
    }
    if (
      Object.entries(
        (state.data.localGoalScenarios as
          Record<string, Records> | undefined) ?? {},
      ).some(([owner, value]) => owner !== user.id && !!value.comparisons[id])
    )
      return fail(404, 'Comparison not found.');
    if (Object.keys(data.comparisons).length >= 100)
      return fail(400, 'Keep at most 100 saved comparisons.');
    const current = goals.find((g) => g.id === input.goalId);
    if (!current) return fail(404, 'Goal not found.');
    let value;
    try {
      value = compareGoal(id, current, input, new Date().toISOString());
    } catch (e) {
      return fail(409, e instanceof Error ? e.message : 'Goal changed.');
    }
    data.comparisons = { ...data.comparisons, [id]: { fingerprint, value } };
    persist();
    return { body: value };
  }
  if (segments[1] !== 'adopt')
    return fail(404, 'Unknown comparison operation.');
  const input = parseLocal(GoalAdoptionInputSchema, req.body),
    fingerprint = JSON.stringify({ id, input });
  const prior = data.adoptions[input.requestId];
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      return fail(409, 'Request ID already used.');
    return { body: GoalAdoptionSchema.parse(prior.value) };
  }
  const comparison = data.comparisons[id]?.value;
  if (!comparison) return fail(404, 'Comparison not found.');
  const current = goals.find((g) => g.id === comparison.baseline.id);
  if (!current)
    return fail(404, 'Goal was removed. This comparison remains historical.');
  let value;
  try {
    value = adoptGoal(comparison, current, input, new Date().toISOString());
  } catch (e) {
    return fail(409, e instanceof Error ? e.message : 'Goal changed.');
  }
  const owned = goalRecords(state, user.id),
    goal = owned[current.id]!;
  state.data.localGoals = {
    ...(state.data.localGoals as Record<string, unknown> | undefined),
    [user.id]: {
      ...owned,
      [current.id]: { ...goal, revisions: [...goal.revisions, value.goal] },
    },
  };
  data.adoptions = {
    ...data.adoptions,
    [input.requestId]: { fingerprint, value },
  };
  persist();
  return { body: value };
};
