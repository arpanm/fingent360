import { RBI_CALENDAR_URL, RbiCalendarSchema } from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleRbiCalendar: OfflineHandler = (request, _state, bundle) => {
  if (request.path !== '/api/v1/research-calendar/rbi') return null;
  if (request.method !== 'GET')
    return fail(405, 'Downloaded RBI calendar is read only.');
  const parsed = RbiCalendarSchema.safeParse(
    bundle.rbiCalendar ?? {
      sourceId: 'rbi-mpc-calendar',
      sourceUrl: RBI_CALENDAR_URL,
      version: 'rbi-mpc-html-v1',
      edition: null,
      retrievedAt: null,
      data: null,
      editions: [],
    },
  );
  if (!parsed.success)
    return fail(
      503,
      'Downloaded RBI calendar is invalid. Refresh the snapshot while connected.',
    );
  const v = parsed.data;
  const edition = request.query.get('edition');
  if (edition && edition !== v.edition)
    return fail(
      404,
      'This RBI capture is not downloaded. Refresh the snapshot while connected.',
    );
  return {
    body: {
      ...v,
      editions: v.editions.filter((e) => e.edition === v.edition),
    },
  };
};
