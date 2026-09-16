import {
  EquitySnapshotSchema,
  EquityPriceRangeSchema,
  buildEquityPriceHistory,
  EquityCompaniesSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleEquityCoverage: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/equities' ||
    request.path.startsWith('/api/v1/ops/equities/')
  )
    fail(503, 'Source capture and publication require connected Operations.');
  const base = '/api/v1/equities';
  if (request.path !== base && !request.path.startsWith(base + '/'))
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown company operation.');
  const parsed = EquitySnapshotSchema.safeParse(
    (bundle as typeof bundle & { equityCoverage?: unknown }).equityCoverage ?? {
      capturedAt: bundle.generatedAt,
      companies: [],
    },
  );
  if (!parsed.success)
    fail(
      503,
      'Company evidence snapshot is unreadable. Rebuild the app bundle.',
    );
  const snapshot = parsed.data;
  if (request.path === base + '/snapshot') return { body: snapshot };
  if (request.path === base) {
    const after = request.query.get('after'),
      q = (request.query.get('q') ?? '').toLowerCase();
    if (after && !/^IN[A-Z0-9]{9}[0-9]$/.test(after))
      fail(400, 'Invalid company page.');
    const rows = snapshot.companies
      .filter(
        (company) =>
          (!after || company.isin > after) &&
          (!q ||
            `${company.isin} ${company.name} ${company.records
              .filter((r) => r.observation.kind === 'identity')
              .map((r) =>
                r.observation.kind === 'identity' ? r.observation.symbol : '',
              )
              .join(' ')}`
              .toLowerCase()
              .includes(q)),
      )
      .sort((a, b) => a.isin.localeCompare(b.isin));
    return {
      body: EquityCompaniesSchema.parse({
        companies: rows.slice(0, 50).map(({ isin, name }) => ({ isin, name })),
        nextAfter: rows.length > 50 ? rows[49]!.isin : null,
      }),
    };
  }
  const prices = /^\/api\/v1\/equities\/(IN[A-Z0-9]{9}[0-9])\/prices$/.exec(
    request.path,
  );
  if (prices) {
    const range = EquityPriceRangeSchema.safeParse({
      from: request.query.get('from'),
      to: request.query.get('to'),
      after: request.query.get('after'),
      limit: request.query.has('limit')
        ? Number(request.query.get('limit'))
        : 15,
    });
    if (!range.success)
      fail(400, 'Choose a valid price date range and cursor.');
    const company = snapshot.companies.find((row) => row.isin === prices[1]);
    if (company?.truncated)
      fail(
        503,
        'This device price history is incomplete. Use connected history or a complete refreshed snapshot.',
      );
    return {
      body: buildEquityPriceHistory(
        prices[1]!,
        company?.records.filter((row) => row.observation.kind === 'price') ??
          [],
        range.data,
        snapshot.capturedAt,
      ),
    };
  }
  const match = /^\/api\/v1\/equities\/(IN[A-Z0-9]{9}[0-9])$/.exec(
    request.path,
  );
  if (!match) fail(404, 'Unknown company.');
  const company = snapshot.companies.find((r) => r.isin === match[1]);
  if (!company)
    fail(404, 'No reviewed company evidence in this device snapshot.');
  return { body: company };
};
