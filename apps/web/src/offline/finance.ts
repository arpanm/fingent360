import { z } from 'zod';
import {
  SavedGoalInputSchema,
  SavedGoalUpdateSchema,
  SavedGoalDeleteSchema,
  SavedGoalSchema,
  SavedGoalsSchema,
  SavedGoalHistorySchema,
  goalProjection,
  HoldingsSnapshotSchema,
  HoldingsHistorySchema,
  HoldingsCsvSchema,
  HoldingsPreviewSchema,
  HoldingsConfirmSchema,
  parseHoldingsCsv,
  holdingsTotal,
  type SavedGoal,
  type HoldingsSnapshot,
  type HoldingsPreview,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type OfflineRequest,
  type OfflineResult,
  type LocalState,
  type OfflineBundle,
} from './types';
export interface LocalGoalRecord {
  revisions: SavedGoal[];
  deletedAt: string | null;
}
export interface LocalHoldingsRecord {
  revisions: HoldingsSnapshot[];
  previews: Record<
    string,
    { preview: HoldingsPreview; confirmedVersion: number | null }
  >;
}
export function parseLocal<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return fail(400, parsed.error.issues.map((i) => i.message).join('; '));
  return parsed.data;
}
export function goalRecords(
  state: LocalState,
  userId: string,
): Record<string, LocalGoalRecord> {
  return (
    (
      state.data.localGoals as
        Record<string, Record<string, LocalGoalRecord>> | undefined
    )?.[userId] ?? {}
  );
}
export function holdingsRecords(
  state: LocalState,
  userId: string,
): LocalHoldingsRecord {
  return (
    (
      state.data.localHoldings as
        Record<string, LocalHoldingsRecord> | undefined
    )?.[userId] ?? { revisions: [], previews: {} }
  );
}
export function localGoals(state: LocalState, userId: string) {
  return SavedGoalsSchema.parse({
    goals: Object.values(goalRecords(state, userId))
      .filter((g) => !g.deletedAt)
      .map((g) => g.revisions.at(-1)),
  }).goals;
}
export function localHoldings(state: LocalState, userId: string) {
  return HoldingsSnapshotSchema.parse(
    holdingsRecords(state, userId).revisions.at(-1) ?? {
      version: 0,
      holdings: [],
      totalCostMinor: '0',
      currency: 'INR',
      scale: 2,
      provenance: 'user-entered-unverified',
      updatedAt: null,
    },
  );
}
function saveGoals(
  state: LocalState,
  userId: string,
  records: Record<string, LocalGoalRecord>,
) {
  state.data.localGoals = {
    ...(state.data.localGoals as Record<string, unknown> | undefined),
    [userId]: records,
  };
}
function saveHoldings(
  state: LocalState,
  userId: string,
  records: LocalHoldingsRecord,
) {
  state.data.localHoldings = {
    ...(state.data.localHoldings as Record<string, unknown> | undefined),
    [userId]: records,
  };
}
export async function handleFinance(
  req: OfflineRequest,
  state: LocalState,
  _bundle: OfflineBundle,
): Promise<OfflineResult | null> {
  void _bundle;
  const base = '/api/v1/account';
  if (
    !req.path.startsWith(`${base}/goals`) &&
    !req.path.startsWith(`${base}/holdings`)
  )
    return null;
  const user = requireUser(state);
  const now = new Date().toISOString();
  if (req.path === `${base}/goals` && req.method === 'GET')
    return {
      body: SavedGoalsSchema.parse({ goals: localGoals(state, user.id) }),
    };
  if (req.path === `${base}/goals` && req.method === 'POST') {
    const input = parseLocal(SavedGoalInputSchema, req.body);
    if (localGoals(state, user.id).length >= 100)
      return fail(400, 'Keep at most 100 active goals.');
    const goal = SavedGoalSchema.parse({
      ...input,
      ...goalProjection(input),
      id: crypto.randomUUID(),
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    saveGoals(state, user.id, {
      ...goalRecords(state, user.id),
      [goal.id]: { revisions: [goal], deletedAt: null },
    });
    return { status: 201, body: goal };
  }
  const match = req.path.match(
    /^\/api\/v1\/account\/goals\/([^/]+)(\/history)?$/,
  );
  if (match) {
    const id = parseLocal(z.uuid(), match[1]);
    const records = goalRecords(state, user.id);
    const record = records[id];
    if (!record || record.deletedAt)
      return fail(404, 'Goal not found on this account.');
    const current = record.revisions.at(-1)!;
    if (match[2] && req.method === 'GET')
      return {
        body: SavedGoalHistorySchema.parse({
          revisions: [...record.revisions].reverse(),
        }),
      };
    if (!match[2] && req.method === 'PUT') {
      const input = parseLocal(SavedGoalUpdateSchema, req.body);
      if (input.expectedVersion !== current.version)
        return fail(409, 'Goal changed. Reload before editing.');
      const updated = SavedGoalSchema.parse({
        ...input.goal,
        ...goalProjection(input.goal),
        id,
        version: current.version + 1,
        createdAt: current.createdAt,
        updatedAt: now,
      });
      saveGoals(state, user.id, {
        ...records,
        [id]: { ...record, revisions: [...record.revisions, updated] },
      });
      return { body: updated };
    }
    if (!match[2] && req.method === 'DELETE') {
      const input = parseLocal(SavedGoalDeleteSchema, req.body);
      if (input.expectedVersion !== current.version)
        return fail(409, 'Goal changed. Reload before removing it.');
      saveGoals(state, user.id, {
        ...records,
        [id]: { ...record, deletedAt: now },
      });
      return { body: { ok: true } };
    }
  }
  if (req.path === `${base}/holdings` && req.method === 'GET')
    return { body: localHoldings(state, user.id) };
  if (req.path === `${base}/holdings/history` && req.method === 'GET')
    return {
      body: HoldingsHistorySchema.parse({
        revisions: [...holdingsRecords(state, user.id).revisions].reverse(),
      }),
    };
  if (req.path === `${base}/holdings/preview` && req.method === 'POST') {
    const input = parseLocal(HoldingsCsvSchema, req.body);
    if (input.expectedVersion !== localHoldings(state, user.id).version)
      return fail(409, 'Holdings changed. Reload before previewing.');
    let holdings;
    try {
      holdings = parseHoldingsCsv(input.csv);
    } catch {
      return fail(
        400,
        'Invalid CSV. Check the header, ISIN check digits, quantities, whole-paise costs and duplicates.',
      );
    }
    const record = holdingsRecords(state, user.id);
    const previews = Object.fromEntries(
      Object.entries(record.previews).filter(
        ([, p]) => Date.parse(p.preview.expiresAt) > Date.now(),
      ),
    );
    if (Object.keys(previews).length >= 20)
      return fail(400, 'Too many previews. Wait for older previews to expire.');
    const preview = HoldingsPreviewSchema.parse({
      previewId: crypto.randomUUID(),
      expectedVersion: input.expectedVersion,
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      holdings,
      totalCostMinor: holdingsTotal(holdings),
      parserVersion: 'standard-holdings-csv-v1',
    });
    saveHoldings(state, user.id, {
      ...record,
      previews: {
        ...previews,
        [preview.previewId]: { preview, confirmedVersion: null },
      },
    });
    return { status: 201, body: preview };
  }
  if (req.path === `${base}/holdings/confirm` && req.method === 'POST') {
    const input = parseLocal(HoldingsConfirmSchema, req.body);
    const record = holdingsRecords(state, user.id);
    const item = record.previews[input.previewId];
    if (!item) return fail(404, 'Preview not found on this account.');
    if (item.preview.expectedVersion !== input.expectedVersion)
      return fail(409, 'Preview version does not match.');
    if (item.confirmedVersion !== null) {
      const old = record.revisions.find(
        (r) => r.version === item.confirmedVersion,
      );
      if (!old)
        return fail(409, 'Saved revision unavailable. Reload holdings.');
      return { status: 201, body: HoldingsSnapshotSchema.parse(old) };
    }
    if (Date.parse(item.preview.expiresAt) <= Date.now())
      return fail(409, 'Preview expired. Create a new preview.');
    if (localHoldings(state, user.id).version !== input.expectedVersion)
      return fail(409, 'Holdings changed. Reload and preview again.');
    const saved = HoldingsSnapshotSchema.parse({
      version: input.expectedVersion + 1,
      holdings: item.preview.holdings,
      totalCostMinor: holdingsTotal(item.preview.holdings),
      currency: 'INR',
      scale: 2,
      provenance: 'user-entered-unverified',
      updatedAt: now,
    });
    saveHoldings(state, user.id, {
      revisions: [...record.revisions, saved],
      previews: {
        ...record.previews,
        [input.previewId]: { ...item, confirmedVersion: saved.version },
      },
    });
    return { status: 201, body: saved };
  }
  return fail(404, 'This local finance operation is unavailable.');
}
