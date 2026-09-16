import { CpiExpectationPublicSchema } from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleCpiExpectations: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (request.path.startsWith('/api/v1/ops/cpi-expectations'))
    return fail(
      503,
      'CPI source capture and review require connected Operations.',
    );
  if (request.path !== '/api/v1/cpi-expectations') return null;
  if (request.method !== 'GET')
    return fail(405, 'Downloaded CPI evidence is read only.');
  const parsed = CpiExpectationPublicSchema.safeParse(
    (bundle as typeof bundle & { cpiExpectations?: unknown })
      .cpiExpectations ?? { capturedAt: bundle.generatedAt, editions: [] },
  );
  if (!parsed.success)
    return fail(
      503,
      'Downloaded CPI evidence is unreadable. Refresh this bundle.',
    );
  return { body: parsed.data };
};
