import {
  CorporateRatingSnapshotSchema,
  CorporateRatingListSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleCorporateRatings: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (/^\/api\/v1\/ops\/corporate-ratings(?:\/|$)/.test(request.path))
    return fail(403, 'Rating editorial review requires connected Operations.');
  if (!/^\/api\/v1\/corporate-ratings(?:\/|$)/.test(request.path)) return null;
  if (request.method !== 'GET')
    return fail(405, 'Downloaded rating evidence is read only.');
  const parsed = CorporateRatingSnapshotSchema.safeParse(
      bundle.corporateRatings,
    ),
    editions = parsed.success
      ? parsed.data.editions.filter((e) => e.state === 'published')
      : [];
  if (request.query.has('after'))
    return fail(404, 'Only downloaded rating history is available.');
  if (request.path === '/api/v1/corporate-ratings/snapshot')
    return {
      body: CorporateRatingSnapshotSchema.parse({
        capturedAt: parsed.success
          ? parsed.data.capturedAt
          : bundle.generatedAt,
        editions,
      }),
    };
  if (request.path !== '/api/v1/corporate-ratings')
    return fail(404, 'Unknown rating evidence route.');
  if (editions.length > 25)
    return fail(503, 'Reconnect for the full paginated rating archive.');
  return {
    body: CorporateRatingListSchema.parse({ editions, nextCursor: null }),
  };
};
