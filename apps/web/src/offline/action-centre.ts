import { z } from 'zod';
import {
  ActionCentreInputSchema,
  ActionCentreReceiptSchema,
  ActionCentreChoicesSchema,
  ActionCentreListSchema,
  ImpactTraceListSchema,
  EquitySnapshotSchema,
  equityTraceWarnings,
  actionPriceBindingCurrent,
  calculateActionCentre,
  type ActionCentreReceipt,
  type ActionCentreInput,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type LocalState,
  type OfflineHandler,
} from './types';
import { localHoldings, localGoals, parseLocal } from './finance';
import { exportLocalImpactTraces, handleImpactTraces } from './impact-trace';
type Entry = { fingerprint: string; value: ActionCentreReceipt | null };
function records(state: LocalState, userId: string) {
  return (
    (
      (state.data.localActionCentre ?? {}) as Record<
        string,
        Record<string, Entry>
      >
    )[userId] ?? {}
  );
}
export function exportLocalActionCentre(state: LocalState, userId: string) {
  return {
    assessments: Object.values(records(state, userId)).flatMap((row) =>
      row.value ? [ActionCentreReceiptSchema.parse(row.value)] : [],
    ),
  };
}
export const handleActionCentre: OfflineHandler = async (
  request,
  state,
  bundle,
) => {
  const base = '/api/v1/account/action-centre';
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  const user = requireUser(state),
    rows = records(state, user.id),
    now = new Date().toISOString();
  const holdings = localHoldings(state, user.id),
    goals = localGoals(state, user.id);
  const equityFor = (isin: string) =>
    EquitySnapshotSchema.parse(
      bundle.equityCoverage ?? {
        capturedAt: bundle.generatedAt,
        companies: [],
      },
    ).companies.find((item) => item.isin === isin) ?? null;
  const traceFor = async (input: ActionCentreInput, required = true) => {
    if (!input.traceId) return { trace: null, warnings: [] as string[] };
    const response = await handleImpactTraces(
      {
        ...request,
        path: '/api/v1/account/impact-traces',
        method: 'GET',
        query: new URLSearchParams(),
      },
      state,
      bundle,
    );
    const trace = ImpactTraceListSchema.parse(response?.body).traces.find(
      (item) => item.receipt.id === input.traceId,
    );
    if (!trace) {
      if (required) fail(409, 'Selected trace is unavailable.');
      return { trace: null, warnings: ['Linked trace was removed.'] };
    }
    if (
      trace.receipt.input.isin !== input.isin ||
      trace.receipt.goal.id !== input.goalId
    )
      fail(400, 'Trace does not match the chosen holding and goal.');
    return { trace: trace.receipt, warnings: trace.reviewReasons };
  };
  if (request.path === base + '/choices' && request.method === 'GET')
    return {
      body: ActionCentreChoicesSchema.parse({
        holdings,
        goals,
        traces: exportLocalImpactTraces(state, user.id).traces,
        bundleGeneratedAt: bundle.generatedAt,
      }),
    };
  if (request.path === base && request.method === 'GET') {
    const assessments = [];
    for (const receipt of exportLocalActionCentre(state, user.id).assessments) {
      const context = await traceFor(receipt.input, false),
        equity = equityFor(receipt.input.isin),
        reasons = [...context.warnings, ...equityTraceWarnings(equity)];
      if (receipt.holdings.version !== holdings.version)
        reasons.push('Your holdings changed. Review a new comparison.');
      if (
        !goals.some(
          (goal) =>
            goal.id === receipt.goal.id &&
            goal.version === receipt.goal.version,
        )
      )
        reasons.push('Your goal changed or was removed.');
      if (!actionPriceBindingCurrent(receipt.input, equity))
        reasons.push('The bound published price is withdrawn or unavailable.');
      if (
        Date.now() - Date.parse(receipt.input.price.asOf + 'T00:00:00Z') >
        7 * 86400000
      )
        reasons.push('Price is beyond the seven-day review window.');
      assessments.push({ receipt, reviewReasons: [...new Set(reasons)] });
    }
    return { body: ActionCentreListSchema.parse({ assessments }) };
  }
  const id = parseLocal(
    z.uuid(),
    request.path.slice(base.length + 1),
  ).toLowerCase();
  if (request.method === 'DELETE') {
    if (!rows[id]) fail(404, 'Comparison not found.');
    rows[id] = { ...rows[id], value: null };
  } else if (request.method === 'PUT') {
    const input = parseLocal(ActionCentreInputSchema, request.body),
      bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(input)),
      );
    const fingerprint = Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
      old = rows[id];
    if (old) {
      if (old.fingerprint !== fingerprint)
        fail(409, 'Receipt ID already used for different inputs.');
      if (!old.value) fail(410, 'Comparison deleted. Start a new review.');
      return { body: old.value };
    }
    if (Object.values(rows).filter((row) => row.value).length >= 100)
      fail(409, 'Remove a comparison before exceeding 100 saved receipts.');
    const goal = goals.find((item) => item.id === input.goalId);
    if (!goal) fail(409, 'Goal unavailable.');
    const context = await traceFor(input),
      equity = equityFor(input.isin);
    if (!actionPriceBindingCurrent(input, equity))
      fail(409, 'Published price receipt changed.');
    let result;
    try {
      result = calculateActionCentre(input, holdings, goal, now, [
        ...context.warnings,
        ...equityTraceWarnings(equity),
      ]);
    } catch (e) {
      fail(409, e instanceof Error ? e.message : 'Comparison changed.');
    }
    const value = ActionCentreReceiptSchema.parse({
      id,
      createdAt: now,
      policy: 'proposed-disposal-education-v1',
      input,
      holdings,
      goal,
      trace: context.trace,
      equity,
      contextWarnings: [...context.warnings, ...equityTraceWarnings(equity)],
      result,
    });
    rows[id] = { fingerprint, value };
  } else fail(404, 'Unknown comparison operation.');
  const all = (state.data.localActionCentre ?? {}) as Record<
    string,
    Record<string, Entry>
  >;
  all[user.id] = rows;
  state.data.localActionCentre = all;
  return {
    body: request.method === 'PUT' ? rows[id]!.value : { deleted: true },
  };
};
