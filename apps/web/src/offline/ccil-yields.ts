import { CcilYieldsSnapshotSchema } from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleCcilYields: OfflineHandler = async (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/bond-yields' ||
    request.path.startsWith('/api/v1/ops/bond-yields/')
  )
    fail(503, 'Yield source capture and review require connected Operations.');
  if (
    request.path !== '/api/v1/bond-yields' &&
    request.path !== '/api/v1/bond-yields/snapshot'
  )
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown yield operation.');
  const source = (bundle as typeof bundle & { bondYields?: unknown })
    .bondYields;
  const data = CcilYieldsSnapshotSchema.parse(
    source ?? { capturedAt: bundle.generatedAt, enabled: false, editions: [] },
  );
  const editions = data.enabled
    ? data.editions.filter((e) => e.state === 'published' && e.data)
    : [];
  return {
    body: request.path.endsWith('/snapshot')
      ? { ...data, editions }
      : { enabled: data.enabled, editions },
  };
};
