import {
  SbiPortfolioSnapshotSchema,
  SbiPortfolioListSchema,
  FundsSnapshotSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleSbiPortfolio: OfflineHandler = async (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/fund-lookthrough' ||
    request.path.startsWith('/api/v1/ops/fund-lookthrough/')
  )
    fail(
      503,
      'AMC capture and independent mapping review require connected Operations.',
    );
  if (
    request.path !== '/api/v1/fund-lookthrough' &&
    request.path !== '/api/v1/fund-lookthrough/snapshot'
  )
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown portfolio operation.');
  const source = (bundle as typeof bundle & { fundPortfolios?: unknown })
    .fundPortfolios;
  const snapshot = SbiPortfolioSnapshotSchema.parse(
    source ?? { capturedAt: bundle.generatedAt, editions: [] },
  );
  const nav = FundsSnapshotSchema.safeParse(bundle.fundsBonds);
  const editions = snapshot.editions.filter(
    (edition) =>
      edition.state === 'published' &&
      edition.portfolio &&
      edition.mapping &&
      nav.success &&
      [...nav.data.funds, ...(nav.data.history ?? [])].some(
        (f) =>
          f.edition.id === edition.mapping!.navEditionId &&
          f.observation.schemeCode === edition.mapping!.schemeCode,
      ) &&
      nav.data.funds.some(
        (f) =>
          f.observation.schemeCode === edition.mapping!.schemeCode &&
          f.observation.name === edition.mapping!.schemeName &&
          (f.observation.plan ?? null) === edition.mapping!.plan &&
          (f.observation.option ?? null) === edition.mapping!.option,
      ),
  );
  if (request.path.endsWith('/snapshot'))
    return { body: { ...snapshot, editions } };
  const code = request.query.get('schemeCode');
  if (code !== null && !/^\d{5,8}$/.test(code))
    fail(400, 'Invalid scheme code.');
  const selected = editions.filter(
    (edition) => !code || edition.mapping?.schemeCode === code,
  );
  if (selected.length > 30)
    fail(503, 'Portfolio history exceeds the explicit reader limit.');
  return { body: SbiPortfolioListSchema.parse({ editions: selected }) };
};
