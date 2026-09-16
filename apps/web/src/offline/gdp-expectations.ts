import {
  GdpExpectationPublicSchema,
  publicBeaGdpSeries,
  currentPublications,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleGdpExpectations: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (request.path.startsWith('/api/v1/ops/gdp-expectations'))
    return fail(
      503,
      'Expectation source capture and review require connected Operations.',
    );
  if (request.path !== '/api/v1/gdp-expectations') return null;
  if (request.method !== 'GET')
    return fail(405, 'Downloaded expectations are read only.');
  const parsed = GdpExpectationPublicSchema.safeParse(
    (bundle as typeof bundle & { gdpExpectations?: unknown })
      .gdpExpectations ?? {
      capturedAt: bundle.generatedAt,
      expectations: [],
      actuals: { capturedAt: bundle.generatedAt, items: [], truncated: false },
    },
  );
  if (!parsed.success)
    return fail(
      503,
      'Downloaded GDP expectation evidence is unreadable. Refresh the bundle.',
    );
  try {
    const admitted = publicBeaGdpSeries(
      currentPublications(bundle.feed, bundle.histories),
      bundle.generatedAt,
    );
    const actuals = parsed.data.actuals.items.filter((item) =>
      admitted.items.some(
        (current) =>
          current.itemId === item.itemId &&
          current.version === item.version &&
          JSON.stringify(current.original) === JSON.stringify(item.original),
      ),
    );
    return {
      body: GdpExpectationPublicSchema.parse({
        ...parsed.data,
        actuals: { ...parsed.data.actuals, items: actuals },
      }),
    };
  } catch {
    return fail(
      503,
      'Downloaded GDP publication manifest is unreadable. Refresh the bundle.',
    );
  }
};
