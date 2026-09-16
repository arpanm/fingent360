import { CalendarSourceSchema } from '@fingent360/contracts';
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
  const source = CalendarSourceSchema.safeParse(
    request.query.get('source') ?? 'bea-calendar',
  );
  if (!source.success) return fail(400, 'Choose BEA or BLS calendar.');
  try {
    return {
      body: offlineResearchCalendar(
        bundle.researchCalendars?.[source.data] ??
          (source.data === 'bea-calendar'
            ? bundle.researchCalendar
            : undefined),
        request.query.get('edition') ?? undefined,
        source.data,
      ),
    };
  } catch {
    return fail(
      404,
      'This calendar capture is not downloaded. Refresh the app snapshot while connected.',
    );
  }
};
