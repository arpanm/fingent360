import { RegulatorySnapshotSchema } from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleRegulatorySources: OfflineHandler = async (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/regulatory-sources' ||
    request.path.startsWith('/api/v1/ops/regulatory-sources/')
  )
    fail(
      503,
      'Original capture and independent source review require connected Operations.',
    );
  if (
    ![
      '/api/v1/regulatory-sources',
      '/api/v1/regulatory-sources/snapshot',
    ].includes(request.path)
  )
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown source operation.');
  const snapshot = RegulatorySnapshotSchema.parse(
    (bundle as typeof bundle & { regulatorySources?: unknown })
      .regulatorySources ?? {
      enabled: false,
      editions: [],
      capturedAt: bundle.generatedAt,
    },
  );
  const editions = snapshot.enabled
    ? snapshot.editions
        .filter((e) => ['published', 'stale'].includes(e.state))
        .map((e) =>
          e.state === 'published' &&
          e.metadata.reviewBy < new Date().toISOString().slice(0, 10)
            ? { ...e, state: 'stale' as const }
            : e,
        )
    : [];
  return {
    body: request.path.endsWith('/snapshot')
      ? { ...snapshot, editions }
      : { enabled: snapshot.enabled, editions, nextCursor: null },
  };
};
