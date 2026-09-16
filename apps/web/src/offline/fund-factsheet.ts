import {
  FactsheetPageSchema,
  FactsheetSnapshotSchema,
  FundsSnapshotSchema,
  factsheetIdentityMatches,
  factsheetIdentityKey,
  FactsheetListSchema,
} from '@fingent360/contracts';
import { fail, type OfflineHandler } from './types';
export const handleFundFactsheet: OfflineHandler = (
  request,
  _state,
  bundle,
) => {
  if (
    request.path === '/api/v1/ops/fund-factsheets' ||
    request.path.startsWith('/api/v1/ops/fund-factsheets/')
  )
    fail(503, 'Factsheet capture and review require connected Operations.');
  if (
    request.path !== '/api/v1/fund-factsheets' &&
    request.path !== '/api/v1/fund-factsheets/snapshot'
  )
    return null;
  if (request.method !== 'GET') fail(404, 'Unknown factsheet operation.');
  const pagination = FactsheetPageSchema.safeParse({
    cursor: request.query.get('cursor') ?? undefined,
    limit: request.query.get('limit') ?? undefined,
  });
  if (!pagination.success) fail(400, 'Invalid factsheet page.');
  const code = request.query.get('schemeCode');
  if (code && !/^\d{5,8}$/.test(code)) fail(400, 'Invalid scheme code.');
  const parsed = FactsheetSnapshotSchema.safeParse(
    (bundle as typeof bundle & { fundFactsheets?: unknown }).fundFactsheets ?? {
      capturedAt: bundle.generatedAt,
      editions: [],
    },
  );
  if (!parsed.success)
    fail(503, 'Factsheet snapshot is unreadable. Download a fresh snapshot.');
  const nav = FundsSnapshotSchema.safeParse(bundle.fundsBonds);
  const records = nav.success
    ? [...nav.data.funds, ...(nav.data.history ?? [])]
    : [];
  const editions = parsed.data.editions.filter(
    (e) =>
      e.state === 'published' &&
      e.values &&
      e.mappings.length === 2 &&
      e.mappings.every((m) => {
        const retained = records.find(
          (r) =>
            r.edition.id === m.navEditionId &&
            r.observation.schemeCode === m.schemeCode &&
            r.observation.observedOn === m.identity.observedOn,
        );
        const current = nav.success
          ? nav.data.funds.find(
              (r) => r.observation.schemeCode === m.schemeCode,
            )
          : null;
        return (
          retained &&
          current &&
          factsheetIdentityMatches(retained.observation, m.plan) &&
          factsheetIdentityMatches(current.observation, m.plan) &&
          factsheetIdentityKey(retained.observation) ===
            factsheetIdentityKey(m.identity) &&
          factsheetIdentityKey(current.observation) ===
            factsheetIdentityKey(m.identity)
        );
      }) &&
      (!code || e.mappings.some((m) => m.schemeCode === code)),
  );
  if (request.path.endsWith('/snapshot'))
    return {
      body: FactsheetSnapshotSchema.parse({
        capturedAt: parsed.data.capturedAt,
        editions,
      }),
    };
  const page = pagination.data;
  const ordered = editions
    .sort(
      (a, b) =>
        b.retrievedAt.localeCompare(a.retrievedAt) || b.id.localeCompare(a.id),
    )
    .filter((e) => !page.cursor || e.retrievedAt + '|' + e.id < page.cursor);
  const selected = ordered.slice(0, page.limit),
    last = selected.at(-1);
  return {
    body: FactsheetListSchema.parse({
      editions: selected,
      nextCursor:
        ordered.length > page.limit && last
          ? last.retrievedAt + '|' + last.id
          : null,
    }),
  };
};
