import {
  FundMergerSnapshotSchema,
  FundMergerListSchema,
  FundsSnapshotSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleFundMergers: OfflineHandler = (request, _state, bundle) => {
  if (request.path.startsWith('/api/v1/ops/fund-mergers'))
    return fail(
      403,
      'Merger original review requires the connected Operations service.',
    );
  if (
    !['/api/v1/fund-mergers', '/api/v1/fund-mergers/snapshot'].includes(
      request.path,
    )
  )
    return null;
  if (request.method !== 'GET')
    return fail(405, 'Downloaded merger lineage is read only.');
  if (request.query.has('after'))
    return fail(404, 'Only the downloaded merger snapshot is available.');
  const snapshot = FundMergerSnapshotSchema.safeParse(bundle.fundMergers),
    funds = FundsSnapshotSchema.safeParse(bundle.fundsBonds);
  const records = funds.success
    ? [...funds.data.funds, ...(funds.data.history ?? [])]
    : [];
  const canonical = (value: unknown) =>
    JSON.stringify(value, (_k, v) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v).sort())
        : v,
    );
  const editions = snapshot.success
    ? snapshot.data.editions.filter(
        (item) =>
          item.state === 'published' &&
          item.mapping &&
          [item.mapping.from, item.mapping.to].every((selected) =>
            records.some(
              (record) =>
                record.edition.id === selected.editionId &&
                canonical(record.observation) ===
                  canonical(selected.observation),
            ),
          ),
      )
    : [];
  if (request.path.endsWith('/snapshot'))
    return {
      body: FundMergerSnapshotSchema.parse({
        capturedAt: snapshot.success
          ? snapshot.data.capturedAt
          : bundle.generatedAt,
        editions,
      }),
    };
  const code = request.query.get('schemeCode');
  if (code !== null && !/^\d{5,8}$/.test(code))
    return fail(400, 'Invalid AMFI plan code.');
  const selected = editions.filter(
    (item) =>
      !code ||
      [
        item.mapping!.from.observation.schemeCode,
        item.mapping!.to.observation.schemeCode,
      ].includes(code),
  );
  if (selected.length > 25)
    return fail(
      503,
      'This downloaded merger list exceeds the page limit. Scope by AMFI plan or reconnect.',
    );
  return {
    body: FundMergerListSchema.parse({ editions: selected, nextCursor: null }),
  };
};
