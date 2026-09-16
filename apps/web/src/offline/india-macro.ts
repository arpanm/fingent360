import {
  IndiaMacroDashboardSchema,
  selectIndiaCpiVintages,
  selectIndiaGdp,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleIndiaMacro: OfflineHandler = (request, _state, bundle) => {
  if (
    request.path === '/api/v1/ops/india-macro' ||
    request.path.startsWith('/api/v1/ops/india-macro/')
  )
    fail(
      503,
      'India macro source capture and publication require connected Operations.',
    );
  if (request.path !== '/api/v1/india-macro') return null;
  if (request.method !== 'GET') fail(404, 'Unknown India macro operation.');
  const parsed = IndiaMacroDashboardSchema.safeParse(
    (bundle as typeof bundle & { indiaMacro?: unknown }).indiaMacro ?? {
      cpi: {
        capturedAt: bundle.generatedAt,
        asOf: null,
        editions: [],
        selected: [],
      },
      calendar: null,
      calendarHistory: [],
    },
  );
  if (!parsed.success)
    fail(503, 'India macro snapshot is unreadable. Refresh the app bundle.');
  const value = request.query.get('asOf');
  if (
    value &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19))
  )
    fail(400, 'Use an explicit UTC as-of timestamp.');
  const asOf = value ? new Date(value).toISOString() : null;
  return {
    body: IndiaMacroDashboardSchema.parse({
      ...parsed.data,
      ...(parsed.data.gdp
        ? {
            gdp: {
              ...parsed.data.gdp,
              selected: selectIndiaGdp(parsed.data.gdp.editions, asOf),
            },
          }
        : {}),
      cpi: {
        ...parsed.data.cpi,
        asOf,
        selected: selectIndiaCpiVintages(parsed.data.cpi.editions, asOf),
      },
    }),
  };
};
