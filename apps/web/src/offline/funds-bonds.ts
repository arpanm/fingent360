import { z } from 'zod';
import {
  FundsSnapshotSchema,
  FundsListSchema,
  FundDetailSchema,
  BondComparisonInputSchema,
  BondComparisonsSchema,
  SavedBondComparisonSchema,
  calculateBondComparison,
} from '@fingent360/contracts';
import {
  fail,
  requireUser,
  type OfflineHandler,
  type LocalState,
} from './types';
import { parseLocal } from './finance';
type Entry = {
  fingerprint: string;
  value: ReturnType<typeof SavedBondComparisonSchema.parse> | null;
};
function records(state: LocalState, userId: string) {
  return (
    (
      state.data.localBondComparisons as
        Record<string, Record<string, Entry>> | undefined
    )?.[userId] ?? {}
  );
}
export function exportLocalBondComparisons(state: LocalState, userId: string) {
  return BondComparisonsSchema.parse({
    comparisons: Object.values(records(state, userId)).flatMap((r) =>
      r.value ? [r.value] : [],
    ),
  });
}
export const handleFundsBonds: OfflineHandler = async (
  request,
  state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/funds' ||
    request.path.startsWith('/api/v1/ops/funds/')
  )
    fail(503, 'NAV capture and publication require connected Operations.');
  const publicBase = '/api/v1/funds',
    privateBase = '/api/v1/account/bond-comparisons';
  if (
    request.path === publicBase ||
    request.path.startsWith(publicBase + '/')
  ) {
    if (request.method !== 'GET') fail(404, 'Unknown fund operation.');
    const value = (bundle as typeof bundle & { fundsBonds?: unknown })
      .fundsBonds ?? {
      capturedAt: bundle.generatedAt,
      funds: [],
      totalSchemeCount: 0,
      truncated: false,
    };
    const parsed = FundsSnapshotSchema.safeParse(value);
    if (!parsed.success)
      fail(503, 'NAV snapshot is unreadable. Rebuild the device bundle.');
    const snapshot = parsed.data;
    if (request.path === publicBase + '/snapshot') return { body: snapshot };
    if (request.path === publicBase) {
      const q = (request.query.get('q') ?? '').toLowerCase(),
        after = request.query.get('after');
      if (after && !/^\d{5,8}$/.test(after)) fail(400, 'Invalid fund page.');
      if (q.length > 100) fail(400, 'Fund search is too long.');
      const rows = snapshot.funds
        .filter(
          (r) =>
            (!after || r.observation.schemeCode > after) &&
            `${r.observation.name} ${r.observation.amc} ${r.observation.schemeCode}`
              .toLowerCase()
              .includes(q),
        )
        .sort((a, b) =>
          a.observation.schemeCode.localeCompare(b.observation.schemeCode),
        );
      return {
        body: FundsListSchema.parse({
          funds: rows.slice(0, 50),
          nextAfter: rows.length > 50 ? rows[49]!.observation.schemeCode : null,
          snapshot: {
            capturedAt: snapshot.capturedAt,
            included: snapshot.funds.length,
            total: snapshot.totalSchemeCount,
          },
        }),
      };
    }
    const code = request.path.slice(publicBase.length + 1);
    if (!/^\d{5,8}$/.test(code)) fail(404, 'Unknown scheme.');
    const row = snapshot.funds.find((r) => r.observation.schemeCode === code);
    if (!row) fail(404, 'Fund is not included in this dated snapshot.');
    return {
      body: FundDetailSchema.parse({
        schemeCode: code,
        history: [row],
        lookThrough: 'not-connected',
        truncated: true,
      }),
    };
  }
  if (
    request.path !== privateBase &&
    !request.path.startsWith(privateBase + '/')
  )
    return null;
  const user = requireUser(state),
    rows = records(state, user.id);
  if (request.path === privateBase && request.method === 'GET')
    return { body: exportLocalBondComparisons(state, user.id) };
  const id = parseLocal(z.uuid(), request.path.slice(privateBase.length + 1));
  if (request.method === 'DELETE') {
    if (!rows[id]) fail(404, 'Comparison unavailable.');
    rows[id] = { ...rows[id]!, value: null };
  } else if (request.method === 'PUT') {
    const input = parseLocal(BondComparisonInputSchema, request.body),
      bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(input)),
      ),
      fingerprint = Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
      old = rows[id];
    if (old) {
      if (old.fingerprint !== fingerprint)
        fail(409, 'Comparison ID already used.');
      if (!old.value) fail(410, 'Comparison was removed.');
      return { body: old.value };
    }
    if (Object.values(rows).filter((r) => r.value).length >= 100)
      fail(409, 'Remove a comparison before adding more.');
    let result;
    try {
      result = calculateBondComparison(input);
    } catch {
      fail(400, 'Comparison amounts or dates exceed supported bounds.');
    }
    rows[id] = {
      fingerprint,
      value: SavedBondComparisonSchema.parse({
        id,
        createdAt: new Date().toISOString(),
        input,
        result,
      }),
    };
  } else fail(404, 'Unknown comparison operation.');
  state.data.localBondComparisons = {
    ...(state.data.localBondComparisons as Record<string, unknown> | undefined),
    [user.id]: rows,
  };
  return {
    body: request.method === 'DELETE' ? { deleted: true } : rows[id]!.value,
  };
};
