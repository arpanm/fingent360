import {
  ConsolidationPublicSchema,
  EquitySnapshotSchema,
  adjustmentBindings,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleEquityConsolidations: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/equity-consolidations' ||
    request.path.startsWith('/api/v1/ops/equity-consolidations/')
  )
    fail(
      503,
      'Consolidation preparation and review require connected Operations.',
    );
  const match = /^\/api\/v1\/equity-consolidations\/(IN[A-Z0-9]{9}[0-9])$/.exec(
    request.path,
  );
  if (!match) return null;
  if (request.method !== 'GET') fail(404, 'Unknown consolidation operation.');
  const map =
      (
        bundle as typeof bundle & {
          equityConsolidations?: Record<string, unknown>;
        }
      ).equityConsolidations ?? {},
    parsed = ConsolidationPublicSchema.safeParse(
      map[match[1]!] ?? { bridges: [], capturedAt: bundle.generatedAt },
    );
  if (!parsed.success) fail(503, 'Consolidation snapshot is unreadable.');
  const equity = EquitySnapshotSchema.safeParse(bundle.equityCoverage);
  if (!equity.success) fail(503, 'Bound equity evidence is unavailable.');
  return {
    body: {
      ...parsed.data,
      bridges: parsed.data.bridges.filter((r) => {
        if (r.oldIsin !== match[1] && r.newIsin !== match[1]) return false;
        const old = equity.data.companies.find((c) => c.isin === r.oldIsin),
          next = equity.data.companies.find((c) => c.isin === r.newIsin);
        return (
          old &&
          next &&
          !old.truncated &&
          !next.truncated &&
          JSON.stringify(adjustmentBindings(old)) ===
            JSON.stringify(r.oldBindings) &&
          JSON.stringify(adjustmentBindings(next)) ===
            JSON.stringify(r.newBindings)
        );
      }),
    },
  };
};
