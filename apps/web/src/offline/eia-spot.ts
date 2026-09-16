import { EiaSpotPublicSchema } from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleEiaSpot: OfflineHandler = (request, _state, bundle) => {
  if (
    request.path === '/api/v1/ops/eia-spot' ||
    request.path.startsWith('/api/v1/ops/eia-spot/')
  )
    fail(503, 'Daily oil acquisition and review require connected Operations.');
  if (request.path !== '/api/v1/eia-spot') return null;
  if (request.method !== 'GET') fail(405, 'Downloaded daily oil is read only.');
  const data = (bundle as typeof bundle & { eiaSpot?: unknown }).eiaSpot;
  if (!data) fail(404, 'No reviewed daily oil edition downloaded.');
  const parsed = EiaSpotPublicSchema.safeParse(data);
  if (!parsed.success) fail(503, 'Downloaded daily source is unreadable.');
  const edition = request.query.get('edition');
  if (edition && edition !== parsed.data.receipt.id)
    fail(404, 'This historical edition is not downloaded. Connect to read it.');
  return { body: { ...parsed.data, editions: [parsed.data.receipt.id] } };
};
