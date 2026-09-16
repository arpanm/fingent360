import { InstitutionalFlowPublicSchema } from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleInstitutionalFlows: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/institutional-flows' ||
    request.path.startsWith('/api/v1/ops/institutional-flows/')
  )
    return fail(503, 'Source review requires the connected API.');
  if (request.path !== '/api/v1/institutional-flows') return null;
  if (request.method !== 'GET')
    return fail(405, 'Institutional flows are read-only.');
  const value = (bundle as typeof bundle & { institutionalFlows?: unknown })
    .institutionalFlows;
  const parsed = InstitutionalFlowPublicSchema.safeParse(
    value ?? { editions: [], capturedAt: bundle.generatedAt },
  );
  if (!parsed.success)
    return fail(503, 'Offline institutional flow evidence is unreadable.');
  return { body: parsed.data };
};
