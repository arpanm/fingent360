import {
  MacroDashboardSchema,
  MacroHistorySchema,
  MacroIndicatorSchema,
  MaterialStateSchema,
  MaterialReceiptSchema,
  MaterialExportSchema,
  MaterialHistoryQuerySchema,
  MaterialWriteSchema,
  MaterialViewSchema,
  MaterialError,
  emptyMaterial,
  syncMaterialContext,
  applyMaterial,
  automaticMaterial,
  consentActive,
  type MaterialReceipt,
} from '@fingent360/contracts';
import {
  fail,
  requireUser,
  type LocalState,
  type OfflineBundle,
  type OfflineHandler,
} from './types';
import { parseLocal } from './finance';
import {
  readLocalConsent,
  recordLocalConsentOptIn,
  requireLocalConsent,
} from './consents';

type Saved = {
  state: ReturnType<typeof emptyMaterial>;
  events: { sequence: string; request: unknown; receipt: MaterialReceipt }[];
};
function records(state: LocalState, id: string): Saved {
  const value = (
    state.data.localMaterialAlerts as Record<string, Saved> | undefined
  )?.[id];
  return value
    ? { state: MaterialStateSchema.parse(value.state), events: value.events }
    : { state: emptyMaterial(), events: [] };
}
function context(state: LocalState, id: string) {
  const value = (
    state.data.localAccounts as
      | Record<
          string,
          {
            watchlist: string[];
            alertPreferences: Record<string, { muted: boolean }>;
          }
        >
      | undefined
  )?.[id];
  const followed = (value?.watchlist ?? []).map((v) =>
    MacroIndicatorSchema.parse(v),
  );
  return {
    followed,
    muted: followed.filter((v) => value?.alertPreferences[v]?.muted),
  };
}
export function localMaterialSources(bundle: OfflineBundle) {
  const macro = MacroDashboardSchema.parse(bundle.macro);
  return macro.sources.map((source) => {
    const versions = new Map<number, (typeof source.observations)[number]>();
    const history = Object.entries(bundle.macroHistory)
      .filter(([key]) => key.startsWith(`${source.indicator}/`))
      .flatMap(([, value]) => MacroHistorySchema.parse(value));
    for (const observation of [...source.observations, ...history]) {
      if (observation.indicator !== source.indicator) continue;
      if (
        !versions.has(observation.year) ||
        versions.get(observation.year)!.revision < observation.revision
      )
        versions.set(observation.year, observation);
    }
    const latest =
      [...versions.values()].sort((a, b) => b.year - a.year)[0] ?? null;
    return {
      indicator: source.indicator,
      latest,
      lastSuccessAt: source.lastSuccessAt,
    };
  });
}
function save(
  state: LocalState,
  id: string,
  receipt: MaterialReceipt,
  request: unknown = null,
) {
  const prior = records(state, id);
  state.data.localMaterialAlerts = {
    ...(state.data.localMaterialAlerts as Record<string, Saved> | undefined),
    [id]: {
      state: receipt.state,
      events: [
        ...prior.events,
        {
          sequence: String(BigInt(prior.events.at(-1)?.sequence ?? '0') + 1n),
          request,
          receipt,
        },
      ],
    },
  };
}
export function syncLocalMaterial(
  state: LocalState,
  id: string,
  bundle: OfflineBundle,
) {
  const old = records(state, id);
  if (!old.state.version) return;
  const { followed, muted } = context(state, id),
    at = new Date().toISOString();
  const sources = localMaterialSources(bundle);
  const next = syncMaterialContext(old.state, followed, muted, sources, at);
  if (next.version !== old.state.version)
    save(
      state,
      id,
      MaterialReceiptSchema.parse({
        requestId: null,
        action: 'context',
        at,
        state: next,
        sources,
        outcomes: [],
      }),
    );
}
/** Called only inside the existing serialized local transaction while the app is open. */
export function materializeLocalMaterial(
  state: LocalState,
  bundle: OfflineBundle,
) {
  const id = state.sessionUserId;
  if (!id || !state.users[id]) return;
  const old = records(state, id).state;
  if (
    !old.automatic.enabled ||
    !old.automatic.nextCheckAt ||
    Date.parse(old.automatic.nextCheckAt) > Date.now()
  )
    return;
  const session = (
    state.data.localAccounts as
      Record<string, { session: { expiresAt: string } | null }> | undefined
  )?.[id]?.session;
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return;
  const at = new Date().toISOString();
  const permission = readLocalConsent(state, id, 'automatic-material-checks');
  const permitted =
    consentActive(permission, at) &&
    permission.version === old.automatic.consentVersion;
  const sources = permitted ? localMaterialSources(bundle) : [];
  const current = context(state, id);
  const base = permitted
    ? syncMaterialContext(old, current.followed, current.muted, sources, at)
    : old;
  const receipt = automaticMaterial(base, sources, at, permitted);
  if (receipt) save(state, id, receipt);
}
export function exportLocalMaterial(
  state: LocalState,
  id: string,
  query: unknown = {},
) {
  const q = parseLocal(MaterialHistoryQuerySchema, query),
    events = records(state, id).events;
  const upper = q.upper ?? events.at(-1)?.sequence ?? '0';
  if ((q.after && !q.upper) || BigInt(q.after ?? '0') > BigInt(upper))
    fail(400, 'Invalid material history boundary.');
  const selected = events
    .filter(
      (e) =>
        BigInt(e.sequence) > BigInt(q.after ?? '0') &&
        BigInt(e.sequence) <= BigInt(upper),
    )
    .slice(0, 101);
  return MaterialExportSchema.parse({
    ownerId: id,
    upper,
    events: selected
      .slice(0, 100)
      .map(({ sequence, receipt }) => ({ sequence, receipt })),
    next: selected.length > 100 ? selected[99]!.sequence : null,
  });
}
export const handleMaterialAlerts: OfflineHandler = (req, state, bundle) => {
  const path = '/api/v1/account/inbox/material';
  if (req.path !== path && req.path !== `${path}/history`) return undefined;
  const user = requireUser(state);
  const session = (
    state.data.localAccounts as
      Record<string, { session: { expiresAt: string } | null }> | undefined
  )?.[user.id]?.session;
  if (!session || Date.parse(session.expiresAt) <= Date.now())
    fail(401, 'Your local session expired. Sign in again.');
  if ([...req.query.keys()].some((key) => req.query.getAll(key).length !== 1))
    fail(400, 'Invalid material history query.');
  const saved = records(state, user.id),
    current = context(state, user.id),
    sources = localMaterialSources(bundle),
    at = new Date().toISOString();
  if (req.method === 'GET' && req.path.endsWith('/history'))
    return {
      body: exportLocalMaterial(state, user.id, Object.fromEntries(req.query)),
    };
  if (req.method === 'GET') {
    if (req.query.size) fail(400, 'Invalid material inbox query.');
    const permission = readLocalConsent(
      state,
      user.id,
      'automatic-material-checks',
    );
    return {
      body: MaterialViewSchema.parse({
        automaticPermissionCurrent:
          consentActive(permission, at) &&
          permission.version === saved.state.automatic.consentVersion,
        state: saved.state.version
          ? saved.state
          : {
              ...saved.state,
              followed: current.followed.sort(),
              muted: current.muted.sort(),
            },
        sources,
        evaluatedAt: at,
        bundleGeneratedAt: bundle.generatedAt,
      }),
    };
  }
  if (req.method !== 'POST' || req.path !== path)
    fail(405, 'Unsupported material inbox action.');
  const input = parseLocal(MaterialWriteSchema, req.body);
  const prior = saved.events.find(
    (event) => event.receipt.requestId === input.requestId,
  );
  if (prior) {
    if (
      JSON.stringify(parseLocal(MaterialWriteSchema, prior.request)) !==
      JSON.stringify(input)
    )
      fail(
        409,
        'This request ID was already used for different material-change input.',
      );
    return { body: MaterialReceiptSchema.parse(prior.receipt) };
  }
  const base = saved.state.version
    ? syncMaterialContext(
        saved.state,
        current.followed,
        current.muted,
        sources,
        at,
      )
    : {
        ...saved.state,
        followed: current.followed.sort(),
        muted: current.muted.sort(),
      };
  try {
    let automaticConsentVersion: number | undefined;
    if (input.action === 'automatic-settings' && input.enabled) {
      recordLocalConsentOptIn(state, user.id, 'automatic-material-checks', {
        kind: 'review',
        recordedAt: at,
      });
      automaticConsentVersion = requireLocalConsent(
        state,
        user.id,
        'automatic-material-checks',
      ).version;
    }
    const receipt = applyMaterial(
      base,
      input,
      sources,
      at,
      automaticConsentVersion,
    );
    save(state, user.id, receipt, input);
    if (input.action === 'automatic-settings' && input.enabled)
      requireLocalConsent(state, user.id, 'automatic-material-checks');
    return { body: receipt };
  } catch (error) {
    if (error instanceof MaterialError) fail(error.status, error.message);
    throw error;
  }
};
