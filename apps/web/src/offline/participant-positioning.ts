import { PositioningPublicSchema } from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleParticipantPositioning: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/positioning' ||
    request.path.startsWith('/api/v1/ops/positioning/')
  )
    return fail(503, 'Source review requires the connected API.');
  if (request.path !== '/api/v1/positioning') return null;
  if (request.method !== 'GET') return fail(405, 'Positioning is read-only.');
  const value = (bundle as typeof bundle & { participantPositioning?: unknown })
    .participantPositioning;
  const parsed = PositioningPublicSchema.safeParse(
    value ?? { editions: [], capturedAt: bundle.generatedAt },
  );
  if (!parsed.success)
    return fail(503, 'Offline positioning evidence is unreadable.');
  return { body: parsed.data };
};
