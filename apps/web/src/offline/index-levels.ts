import {
  IndexLevelPublicSchema,
  IndexLevelQuerySchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleIndexLevels: OfflineHandler = (request, _state, bundle) => {
  if (
    request.path === '/api/v1/ops/index-levels' ||
    request.path.startsWith('/api/v1/ops/index-levels/')
  )
    fail(
      503,
      'Index source capture and independent review require connected Operations.',
    );
  if (
    request.path !== '/api/v1/index-levels' &&
    request.path !== '/api/v1/index-levels/snapshot'
  )
    return null;
  if (request.method !== 'GET')
    fail(405, 'Installed index history is read-only.');
  if (request.path.endsWith('/snapshot') && request.query.size)
    fail(400, 'Snapshot does not accept query filters.');
  if (
    [...request.query.keys()].some(
      (key) => request.query.getAll(key).length !== 1,
    )
  )
    fail(400, 'Duplicate index history query.');
  const query = IndexLevelQuerySchema.safeParse(
    Object.fromEntries(request.query),
  );
  if (!query.success) fail(400, 'Use an optional exclusive before date.');
  if (!bundle.indexLevels)
    fail(
      503,
      'Index history is not installed. Install an updated public snapshot.',
    );
  const snapshot = IndexLevelPublicSchema.safeParse(bundle.indexLevels);
  if (!snapshot.success || snapshot.data.nextBefore !== null)
    fail(
      503,
      'Installed index history is unreadable or incomplete. Install an updated snapshot.',
    );
  const editions = snapshot.data.editions.filter(
    (edition) => !query.data.before || edition.effectiveOn < query.data.before,
  );
  const limit = request.path.endsWith('/snapshot') ? 1000 : 20;
  return {
    body: IndexLevelPublicSchema.parse({
      editions: editions.slice(0, limit),
      capturedAt: snapshot.data.capturedAt,
      nextBefore:
        editions.length > limit ? editions[limit - 1]!.effectiveOn : null,
    }),
  };
};
