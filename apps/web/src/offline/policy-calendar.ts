import { FOMC_CALENDAR_URL, PolicyCalendarSchema } from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';

export const handlePolicyCalendar: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (request.path !== '/api/v1/research-calendar/policy') return null;
  if (request.method !== 'GET')
    return fail(405, 'Offline policy calendars are read only.');
  try {
    const calendar = PolicyCalendarSchema.parse(
      bundle.policyCalendar ?? {
        sourceId: 'fomc-calendar',
        sourceUrl: FOMC_CALENDAR_URL,
        version: 'fomc-calendar-html-v1',
        edition: null,
        retrievedAt: null,
        basis: 'retained-calendar-capture',
        meetings: [],
        editions: [],
      },
    );
    const edition = request.query.get('edition');
    if (edition && edition !== calendar.edition)
      return fail(
        404,
        'This policy calendar capture is not downloaded. Refresh the snapshot while connected.',
      );
    return {
      body: {
        ...calendar,
        editions: calendar.editions.filter(
          (item) => item.edition === calendar.edition,
        ),
      },
    };
  } catch {
    return fail(
      503,
      'Downloaded policy calendar is invalid. Refresh the snapshot while connected.',
    );
  }
};
