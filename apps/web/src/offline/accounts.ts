import { exportOfflineReportSchedules } from './report-schedules';
import { exportLocalGoalScenarios } from './goal-scenarios';
import { exportLocalConnectionReviews } from './connection-reviews';
import { z } from 'zod';
import {
  RegistrationSchema,
  CredentialsSchema,
  DeleteAccountSchema,
  AccountSchema,
  CurrentAccountSchema,
  WatchlistSchema,
  InboxSchema,
  AcknowledgeSchema,
  AlertPreferencesSchema,
  AlertPreferenceUpdateSchema,
  MacroDashboardSchema,
  OverviewSchema,
  SessionsSchema,
  RevokeSessionSchema,
  RevokeOthersSchema,
  PrivacyExportSchema,
  type Account,
  type MacroIndicator,
  type PrivacySession,
} from '@fingent360/contracts';
import {
  requireUser,
  fail,
  type OfflineRequest,
  type OfflineResult,
  type LocalState,
  type LocalUser,
  type OfflineBundle,
} from './types';
import {
  parseLocal,
  localGoals,
  localHoldings,
  goalRecords,
  holdingsRecords,
} from './finance';
import { exportOfflineLibrary } from './library';
import { exportOfflineLearning } from './learning';
import { exportLocalConnections } from './research-connections';
import { localAllocationRevisions } from './allocations';
import { exportOfflineReports } from './reports';
interface LocalAccountData {
  watchlist: MacroIndicator[];
  acknowledgments: Record<string, string>;
  alertPreferences: Record<string, { muted: boolean; updatedAt: string }>;
  session: PrivacySession | null;
}
export function accountData(state: LocalState, id: string): LocalAccountData {
  return (
    (
      state.data.localAccounts as Record<string, LocalAccountData> | undefined
    )?.[id] ?? {
      watchlist: [],
      acknowledgments: {},
      alertPreferences: {},
      session: null,
    }
  );
}
function saveAccount(state: LocalState, id: string, value: LocalAccountData) {
  state.data.localAccounts = {
    ...(state.data.localAccounts as Record<string, unknown> | undefined),
    [id]: value,
  };
}
function account(user: LocalUser): Account {
  return AccountSchema.parse({
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    consentVersion: 'account-storage-v1',
  });
}
function current(state: LocalState) {
  const user = state.sessionUserId
    ? state.users[state.sessionUserId]
    : undefined;
  if (!user) return null;
  const session = accountData(state, user.id).session;
  return session && Date.parse(session.expiresAt) > Date.now() ? user : null;
}
const hex = (bytes: Uint8Array) =>
  [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('');
async function hash(password: string, salt: string) {
  if (!crypto.subtle)
    return fail(
      503,
      'Secure local password storage is unavailable in this environment.',
    );
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bytes = Uint8Array.from(salt.match(/.{2}/g) ?? [], (v) =>
    parseInt(v, 16),
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: bytes, iterations: 600000, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2-sha256-600000:${hex(new Uint8Array(derived))}`;
}
async function matches(password: string, user: LocalUser | undefined) {
  const actual = await hash(password, user?.passwordSalt ?? '00'.repeat(16));
  const expected =
    user?.passwordHash ?? 'pbkdf2-sha256-600000:' + '0'.repeat(64);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++)
    mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return !!user && mismatch === 0;
}
function issue(state: LocalState, user: LocalUser) {
  const now = new Date().toISOString();
  saveAccount(state, user.id, {
    ...accountData(state, user.id),
    session: {
      id: crypto.randomUUID(),
      createdAt: now,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      current: true,
    },
  });
  state.sessionUserId = user.id;
}
export function localInbox(
  state: LocalState,
  id: string,
  bundle: OfflineBundle,
) {
  const settings = accountData(state, id);
  const macro = MacroDashboardSchema.parse(bundle.macro);
  return InboxSchema.parse({
    items: macro.sources
      .filter(
        (s) =>
          settings.watchlist.includes(s.indicator) &&
          !settings.alertPreferences[s.indicator]?.muted,
      )
      .flatMap((s) => {
        const value = s.observations.find(
          (o) => o.value !== null || o.revision > 1,
        );
        return value
          ? [
              {
                indicator: s.indicator,
                observationId: value.id,
                year: value.year,
                value: value.value,
                revision: value.revision,
                retrievedAt: value.retrievedAt,
                kind: value.revision > 1 ? 'correction' : 'observation',
                read: !!settings.acknowledgments[value.id],
                sourceUrl: s.sourceUrl,
              },
            ]
          : [];
      }),
  });
}
function sessions(state: LocalState, id: string) {
  const value = accountData(state, id).session;
  return SessionsSchema.parse({
    sessions:
      value &&
      state.sessionUserId === id &&
      Date.parse(value.expiresAt) > Date.now()
        ? [value]
        : [],
  }).sessions;
}
export async function handleAccounts(
  req: OfflineRequest,
  state: LocalState,
  bundle: OfflineBundle,
): Promise<OfflineResult | null> {
  const base = '/api/v1/account';
  if (!req.path.startsWith(base)) return null;
  if (req.path === base && req.method === 'GET')
    return {
      body: CurrentAccountSchema.parse({
        user: current(state) ? account(current(state)!) : null,
      }),
    };
  if (req.path === `${base}/register` && req.method === 'POST') {
    const input = parseLocal(RegistrationSchema, req.body);
    if (Object.values(state.users).some((u) => u.username === input.username))
      return fail(400, 'Username unavailable on this device.');
    if (Object.keys(state.users).length >= 32)
      return fail(400, 'This device supports up to 32 local accounts.');
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const now = new Date().toISOString();
    const user: LocalUser = {
      id: crypto.randomUUID(),
      username: input.username,
      createdAt: now,
      consentedAt: now,
      passwordSalt: salt,
      passwordHash: await hash(input.password, salt),
    };
    state.users[user.id] = user;
    issue(state, user);
    return { status: 201, body: { user: account(user) } };
  }
  if (req.path === `${base}/login` && req.method === 'POST') {
    const input = parseLocal(CredentialsSchema, req.body);
    const attempts =
      (state.data.localLoginAttempts as
        Record<string, { count: number; until: number }> | undefined) ?? {};
    const prior = attempts[input.username];
    if (prior && prior.until > Date.now() && prior.count >= 5)
      return fail(429, 'Too many sign-in attempts. Retry after 15 minutes.');
    const user = Object.values(state.users).find(
      (u) => u.username === input.username,
    );
    if (!(await matches(input.password, user))) {
      state.data.localLoginAttempts = {
        ...attempts,
        [input.username]: {
          count: prior && prior.until > Date.now() ? prior.count + 1 : 1,
          until:
            prior && prior.until > Date.now()
              ? prior.until
              : Date.now() + 900000,
        },
      };
      return {
        status: 401,
        body: {
          message: 'Username or password is incorrect on this device.',
          statusCode: 401,
          error: 'Unauthorized',
        },
      };
    }
    const next = { ...attempts };
    delete next[input.username];
    state.data.localLoginAttempts = next;
    issue(state, user!);
    return { body: { user: account(user!) } };
  }
  if (req.path === `${base}/logout` && req.method === 'POST') {
    parseLocal(z.strictObject({}), req.body ?? {});
    if (state.sessionUserId) {
      const id = state.sessionUserId;
      saveAccount(state, id, { ...accountData(state, id), session: null });
    }
    state.sessionUserId = null;
    return { body: { ok: true } };
  }
  const known =
    req.path === base ||
    [
      '/watchlist',
      '/inbox',
      '/inbox/acknowledge',
      '/alert-preferences',
      '/overview',
      '/privacy/sessions',
      '/privacy/sessions/revoke',
      '/privacy/sessions/revoke-others',
      '/privacy/export',
    ].some((p) => req.path === base + p);
  const user = requireUser(state);
  if (!current(state))
    return fail(401, 'Your local session expired. Sign in again.');
  if (!known) return null;
  const data = accountData(state, user.id);
  if (req.path === base && req.method === 'DELETE') {
    const input = parseLocal(DeleteAccountSchema, req.body);
    if (!(await matches(input.password, user)))
      return fail(401, 'Password is incorrect. Account was not deleted.');
    delete state.users[user.id];
    state.sessionUserId = null;
    for (const key of [
      'localRecovery',
      'localAllocations',
      'localResearchConnections',
      'localGoalScenarios',
      'localConnectionReviews',
      'localReports',
      'localReportSchedules',
      'localReportTombstones',
      'localReportLimits',
      'localAccounts',
      'localGoals',
      'localHoldings',
      'localLibraries',
      'localLibraryRequests',
      'localLearning',
      'localLearningRequests',
    ]) {
      const map = state.data[key];
      if (map && typeof map === 'object' && !Array.isArray(map))
        delete (map as Record<string, unknown>)[user.id];
    }
    delete state.data[`library:${user.id}`];
    delete state.data[`learning:${user.id}`];
    const limits = state.data.localLoginAttempts as
      Record<string, unknown> | undefined;
    if (limits) delete limits[user.username];
    return { body: { ok: true } };
  }
  if (req.path === `${base}/watchlist` && req.method === 'GET')
    return { body: WatchlistSchema.parse({ indicators: data.watchlist }) };
  if (req.path === `${base}/watchlist` && req.method === 'PUT') {
    const input = parseLocal(WatchlistSchema, req.body);
    saveAccount(state, user.id, { ...data, watchlist: input.indicators });
    return { body: input };
  }
  if (req.path === `${base}/inbox` && req.method === 'GET')
    return { body: localInbox(state, user.id, bundle) };
  if (req.path === `${base}/inbox/acknowledge` && req.method === 'POST') {
    const input = parseLocal(AcknowledgeSchema, req.body);
    if (
      !localInbox(state, user.id, bundle).items.some(
        (i) => i.observationId === input.observationId,
      )
    )
      return fail(400, 'Observation is not in your current local inbox.');
    saveAccount(state, user.id, {
      ...data,
      acknowledgments: {
        ...data.acknowledgments,
        [input.observationId]: new Date().toISOString(),
      },
    });
    return { body: { ok: true } };
  }
  if (req.path === `${base}/alert-preferences` && req.method === 'GET')
    return {
      body: AlertPreferencesSchema.parse({
        preferences: data.watchlist.map((indicator) => ({
          indicator,
          muted: data.alertPreferences[indicator]?.muted ?? false,
          updatedAt: data.alertPreferences[indicator]?.updatedAt ?? null,
        })),
      }),
    };
  if (req.path === `${base}/alert-preferences` && req.method === 'PUT') {
    const input = parseLocal(AlertPreferenceUpdateSchema, req.body);
    if (!data.watchlist.includes(input.indicator))
      return fail(
        400,
        'Follow this indicator before changing its inbox setting.',
      );
    saveAccount(state, user.id, {
      ...data,
      alertPreferences: {
        ...data.alertPreferences,
        [input.indicator]: {
          muted: input.muted,
          updatedAt: new Date().toISOString(),
        },
      },
    });
    return { body: { ok: true } };
  }
  if (req.path === `${base}/overview` && req.method === 'GET')
    return {
      body: OverviewSchema.parse({
        user: account(user),
        goals: localGoals(state, user.id),
        holdings: localHoldings(state, user.id),
        watchlist: { indicators: data.watchlist },
        inbox: localInbox(state, user.id, bundle),
        evaluatedAt: new Date().toISOString(),
      }),
    };
  if (req.path === `${base}/privacy/sessions` && req.method === 'GET')
    return { body: { sessions: sessions(state, user.id) } };
  if (
    req.path === `${base}/privacy/sessions/revoke-others` &&
    req.method === 'POST'
  ) {
    parseLocal(RevokeOthersSchema, req.body);
    return { body: { revoked: 0 } };
  }
  if (req.path === `${base}/privacy/sessions/revoke` && req.method === 'POST') {
    parseLocal(RevokeSessionSchema, req.body);
    return fail(
      404,
      'Only this device session exists. Use Sign out to end it.',
    );
  }
  if (req.path === `${base}/privacy/export` && req.method === 'GET') {
    const holdings = holdingsRecords(state, user.id);
    const detached = structuredClone(state);
    const learning = exportOfflineLearning(detached, user.id);
    return {
      headers: {
        'Content-Disposition':
          'attachment; filename="fingent360-local-account.json"',
      },
      body: PrivacyExportSchema.parse({
        allocations: { revisions: localAllocationRevisions(detached, user.id) },
        reports: exportOfflineReports(detached, user.id),
        reportSchedules: exportOfflineReportSchedules(detached, user.id),
        researchConnections: exportLocalConnections(detached, user.id),
        goalScenarios: exportLocalGoalScenarios(detached, user.id),
        connectionReviews: exportLocalConnectionReviews(detached, user.id),
        formatVersion: 'account-export-v1',
        exportedAt: new Date().toISOString(),
        account: account(user),
        watchlist: { indicators: data.watchlist },
        acknowledgments: Object.entries(data.acknowledgments).map(
          ([observationId, acknowledgedAt]) => ({
            observationId,
            acknowledgedAt,
          }),
        ),
        sessions: sessions(state, user.id),
        goals: {
          available: true,
          revisions: Object.values(goalRecords(state, user.id)).flatMap((g) =>
            g.revisions.map((goal) => ({ goal, deletedAt: g.deletedAt })),
          ),
        },
        alertPreferences: {
          available: true,
          items: Object.entries(data.alertPreferences).map(
            ([indicator, v]) => ({ indicator, ...v }),
          ),
        },
        holdings: {
          available: true,
          currentVersion: localHoldings(state, user.id).version,
          revisions: holdings.revisions,
          previews: Object.values(holdings.previews).map((p) => ({
            id: p.preview.previewId,
            expectedVersion: p.preview.expectedVersion,
            holdings: p.preview.holdings,
            ...(p.preview.reconciliation
              ? { reconciliation: p.preview.reconciliation }
              : {}),
            ...(p.preview.import ? { import: p.preview.import } : {}),
            expiresAt: p.preview.expiresAt,
            confirmedVersion: p.confirmedVersion,
          })),
        },
        library: {
          available: true,
          data: exportOfflineLibrary(detached, user.id, bundle),
        },
        learning: {
          available: true,
          attempts: learning.attempts,
          votes: learning.votes,
        },
        exclusions: [
          'This export contains only records stored by this app on this device.',
          'Passwords, password hashes, salts, recovery codes/hashes and sign-in/recovery counters are excluded.',
          'No server synchronization, remote sessions or current market prices are included.',
        ],
      }),
    };
  }
  return fail(404, 'This account operation is unavailable in local mode.');
}

export {
  hash as hashLocalPassword,
  matches as matchesLocalPassword,
  current as currentLocalAccount,
};
