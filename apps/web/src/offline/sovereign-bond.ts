import {
  SovereignSnapshotSchema,
  SovereignListSchema,
  calculateSovereignAuction,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleSovereignBonds: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (request.path.startsWith('/api/v1/ops/sovereign-bonds'))
    return fail(403, 'Original source review requires connected Operations.');
  if (!/^\/api\/v1\/sovereign-bonds(?:\/|$)/.test(request.path)) return null;
  const parsed = SovereignSnapshotSchema.safeParse(bundle.sovereignBonds);
  const editions = parsed.success
    ? parsed.data.editions.filter((row) => row.state === 'published')
    : [];
  if (request.path.endsWith('/calculate') && request.method === 'POST') {
    const id = request.path.split('/')[4],
      edition = editions.find((row) => row.id === id);
    if (!edition)
      return fail(409, 'Exact reviewed source pack is not downloaded.');
    try {
      return { body: calculateSovereignAuction(edition, request.body) };
    } catch {
      return fail(400, 'Invalid historical calculation inputs.');
    }
  }
  if (request.method !== 'GET')
    return fail(405, 'Historical source snapshot is read only.');
  if (request.query.has('after'))
    return fail(404, 'Only the downloaded source capture is available.');
  if (request.path === '/api/v1/sovereign-bonds/snapshot')
    return {
      body: SovereignSnapshotSchema.parse({
        capturedAt: parsed.success
          ? parsed.data.capturedAt
          : bundle.generatedAt,
        editions,
      }),
    };
  if (request.path !== '/api/v1/sovereign-bonds')
    return fail(404, 'Unknown historical source route.');
  if (editions.length > 25)
    return fail(
      503,
      'Downloaded source page exceeds limit. Reconnect for paginated archive.',
    );
  return { body: SovereignListSchema.parse({ editions, nextCursor: null }) };
};
