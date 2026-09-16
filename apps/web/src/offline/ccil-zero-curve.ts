import {
  CcilZeroSnapshotSchema,
  CcilZeroPageSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleCcilZero: OfflineHandler = async (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/bond-zero-curve' ||
    request.path.startsWith('/api/v1/ops/bond-zero-curve/')
  )
    fail(503, 'Yield source capture and review require connected Operations.');
  if (
    request.path !== '/api/v1/bond-zero-curve' &&
    request.path !== '/api/v1/bond-zero-curve/snapshot'
  )
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown yield operation.');
  const source = (bundle as typeof bundle & { bondZeroCurve?: unknown })
    .bondZeroCurve;
  const data = CcilZeroSnapshotSchema.parse(
    source ?? { capturedAt: bundle.generatedAt, enabled: false, editions: [] },
  );
  const editions = data.enabled
    ? data.editions.filter((e) => e.state === 'published' && e.data)
    : [];
  if (request.path.endsWith('/snapshot'))
    return { body: { ...data, editions } };
  const page = CcilZeroPageSchema.safeParse({
    cursor: request.query.get('cursor') ?? undefined,
    limit: request.query.get('limit') ?? undefined,
  });
  if (!page.success) fail(400, 'Invalid curve history page');
  const candidates = editions
      .sort(
        (a, b) =>
          b.retrievedAt.localeCompare(a.retrievedAt) ||
          b.id.localeCompare(a.id),
      )
      .filter(
        (e) =>
          !page.data.cursor || e.retrievedAt + '|' + e.id < page.data.cursor,
      ),
    selected = candidates.slice(0, page.data.limit),
    last = selected.at(-1);
  return {
    body: {
      enabled: data.enabled,
      editions: selected,
      nextCursor:
        candidates.length > page.data.limit && last
          ? last.retrievedAt + '|' + last.id
          : null,
    },
  };
};
