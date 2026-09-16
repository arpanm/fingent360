import {
  AdjustmentPublicSchema,
  adjustmentBindings,
  EquitySnapshotSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleEquityAdjustments: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/equity-adjustments' ||
    request.path.startsWith('/api/v1/ops/equity-adjustments/')
  )
    fail(
      503,
      'Adjustment source preparation and review require connected Operations.',
    );
  const match = /^\/api\/v1\/equity-adjustments\/(IN[A-Z0-9]{9}[0-9])$/.exec(
    request.path,
  );
  if (!match) return null;
  if (request.method !== 'GET') fail(404, 'Unknown adjustment operation.');
  const map =
    (bundle as typeof bundle & { equityAdjustments?: Record<string, unknown> })
      .equityAdjustments ?? {};
  const parsed = AdjustmentPublicSchema.safeParse(
    map[match[1]!] ?? { windows: [], capturedAt: bundle.generatedAt },
  );
  if (!parsed.success) fail(503, 'Adjustment evidence snapshot is unreadable.');
  const equity = EquitySnapshotSchema.safeParse(bundle.equityCoverage);
  const company = equity.success
    ? equity.data.companies.find((row) => row.isin === match[1])
    : undefined;
  return {
    body: {
      ...parsed.data,
      windows: company
        ? parsed.data.windows.filter(
            (window) =>
              window.isin === company.isin &&
              window.reviewedAt &&
              JSON.stringify(window.retainedBindings) ===
                JSON.stringify(adjustmentBindings(company)),
          )
        : [],
    },
  };
};
