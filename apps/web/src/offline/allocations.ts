import {
  AllocationWriteSchema,
  AllocationHistorySchema,
  AllocationSnapshotSchema,
  allocationState,
  emptyAllocation,
  makeAllocation,
  type AllocationSnapshot,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type OfflineRequest,
  type OfflineResult,
  type LocalState,
  type OfflineBundle,
} from './types';
import { localGoals, localHoldings, parseLocal } from './finance';
export function localAllocationRevisions(
  state: LocalState,
  userId: string,
): AllocationSnapshot[] {
  return AllocationHistorySchema.parse({
    revisions:
      (
        state.data.localAllocations as
          Record<string, AllocationSnapshot[]> | undefined
      )?.[userId] ?? [],
  }).revisions;
}
export function localAllocation(
  state: LocalState,
  userId: string,
): AllocationSnapshot {
  return localAllocationRevisions(state, userId).at(-1) ?? emptyAllocation();
}
export function handleAllocations(
  req: OfflineRequest,
  state: LocalState,
  _bundle: OfflineBundle,
): OfflineResult | null {
  void _bundle;
  const base = '/api/v1/account/allocations';
  if (req.path !== base && req.path !== `${base}/history`) return null;
  const user = requireUser(state);
  const history = localAllocationRevisions(state, user.id);
  const snapshot = localAllocation(state, user.id);
  const holdings = localHoldings(state, user.id);
  const goals = localGoals(state, user.id);
  if (req.method === 'GET')
    return {
      body:
        req.path === base
          ? allocationState(snapshot, holdings, goals)
          : AllocationHistorySchema.parse({
              revisions: [...history].reverse(),
            }),
    };
  if (req.path === base && req.method === 'PUT') {
    const input = parseLocal(AllocationWriteSchema, req.body);
    if (
      input.expectedVersion !== snapshot.version ||
      input.expectedHoldingsVersion !== holdings.version
    )
      return fail(
        409,
        'Your allocation plan or holdings changed. Reload and review before saving.',
      );
    if (
      input.rows.some((row) => {
        const goal = goals.find((g) => g.id === row.goalId);
        return goal && goal.version !== row.goalVersion;
      })
    )
      return fail(409, 'A goal changed. Reload and review before saving.');
    let next;
    try {
      next = makeAllocation(input, holdings, goals, new Date().toISOString());
    } catch (error) {
      return fail(
        400,
        error instanceof Error ? error.message : 'Invalid allocation.',
      );
    }
    state.data.localAllocations = {
      ...(state.data.localAllocations as Record<string, unknown> | undefined),
      [user.id]: [...history, AllocationSnapshotSchema.parse(next)],
    };
    return { body: allocationState(next, holdings, goals) };
  }
  return fail(404, 'Allocation operation unavailable.');
}
