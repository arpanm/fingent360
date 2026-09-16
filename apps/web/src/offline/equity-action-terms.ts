import {
  ActionTermsPublicSchema,
  EquitySnapshotSchema,
  adjustmentBindings,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleEquityActionTerms: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/equity-action-terms' ||
    request.path.startsWith('/api/v1/ops/equity-action-terms/')
  )
    fail(
      503,
      'Action terms preparation and review require connected Operations.',
    );
  const match = /^\/api\/v1\/equity-action-terms\/(IN[A-Z0-9]{9}[0-9])$/.exec(
    request.path,
  );
  if (!match) return null;
  if (request.method !== 'GET') fail(404, 'Unknown action terms operation.');
  const map =
      (
        bundle as typeof bundle & {
          equityActionTerms?: Record<string, unknown>;
        }
      ).equityActionTerms ?? {},
    parsed = ActionTermsPublicSchema.safeParse(
      map[match[1]!] ?? { actions: [], capturedAt: bundle.generatedAt },
    );
  if (!parsed.success) fail(503, 'Action terms snapshot is unreadable.');
  const equity = EquitySnapshotSchema.safeParse(bundle.equityCoverage);
  if (!equity.success) fail(503, 'Bound equity evidence is unavailable.');
  return {
    body: {
      ...parsed.data,
      actions: parsed.data.actions.filter((r) => {
        if (r.terms.oldIsin !== match[1] && r.terms.newIsin !== match[1])
          return false;
        const old = equity.data.companies.find(
            (c) => c.isin === r.terms.oldIsin,
          ),
          next = equity.data.companies.find((c) => c.isin === r.terms.newIsin);
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
