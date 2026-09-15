import { offlineResearchCalendar } from './research-auto';
import { fail, type OfflineHandler } from './types';

export const handleResearchCalendar: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (request.path !== '/api/v1/research-calendar') return null;
  if (request.method !== 'GET')
    return fail(405, 'Calendar snapshots are read only.');
  try {
    return {
      body: offlineResearchCalendar(
        bundle.researchCalendar,
        request.query.get('edition') ?? undefined,
      ),
    };
  } catch {
    return fail(
      404,
      'This calendar capture is not downloaded. Refresh the app snapshot while connected.',
    );
  }
};
