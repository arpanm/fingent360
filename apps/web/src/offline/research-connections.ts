import { z } from 'zod';
import {
  ResearchConnectionHistorySchema,
  ResearchConnectionWriteSchema,
  ResearchConnectionQuerySchema,
  ResearchConnectionsSchema,
  connectionSource,
  connectionTargets,
  connectionView,
  reviseConnection,
  ConnectionError,
  type ResearchConnectionRevision,
} from '@fingent360/contracts';
import {
  fail,
  requireUser,
  type OfflineHandler,
  type LocalState,
} from './types';
import { localGoals, localHoldings, parseLocal } from './finance';

type Records = {
  revisions: ResearchConnectionRevision[];
  requests: Record<
    string,
    { fingerprint: string; revision: ResearchConnectionRevision }
  >;
};
function records(state: LocalState, userId: string): Records {
  return (
    (
      state.data.localResearchConnections as Record<string, Records> | undefined
    )?.[userId] ?? { revisions: [], requests: {} }
  );
}
export function exportLocalConnections(state: LocalState, userId: string) {
  return ResearchConnectionHistorySchema.parse({
    revisions: records(state, userId).revisions,
  });
}
export const handleResearchConnections: OfflineHandler = (
  req,
  state,
  bundle,
) => {
  const base = '/api/v1/account/research-connections';
  if (req.path !== base && !req.path.startsWith(`${base}/`)) return null;
  const user = requireUser(state);
  const saved = records(state, user.id);
  const revisions = ResearchConnectionHistorySchema.parse({
    revisions: saved.revisions,
  }).revisions;
  const latest = new Map<string, ResearchConnectionRevision>();
  for (const revision of revisions) latest.set(revision.id, revision);
  const targets = connectionTargets(
    localHoldings(state, user.id),
    localGoals(state, user.id),
  );
  // A bundle refresh may contain a withdrawal in history and omit it from feed.
  const published = new Map(bundle.feed.map((item) => [item.id, item]));
  for (const history of Object.values(bundle.histories)) {
    const current = [...history]
      .filter((item) => item.status !== 'draft')
      .sort((a, b) => b.version - a.version)[0];
    if (
      current &&
      (!published.has(current.id) ||
        current.version >= published.get(current.id)!.version)
    )
      published.set(current.id, current);
  }
  const sources = [...published.values()].flatMap((item) => {
    const source = connectionSource(item);
    return source ? [source] : [];
  });
  if (req.path === base && req.method === 'GET') {
    const queryFields: Record<string, string> = {};
    req.query.forEach((value, key) => {
      queryFields[key] = value;
    });
    const query = parseLocal(ResearchConnectionQuerySchema, queryFields);
    return {
      body: ResearchConnectionsSchema.parse({
        connections: [...latest.values()]
          .filter((r) => !r.removed)
          .reverse()
          .map((r) => connectionView(r, sources, targets)),
        targets,
        selectedSource: sources.find((s) => s.itemId === query.itemId) ?? null,
        evaluatedAt: new Date().toISOString(),
        bundleGeneratedAt: bundle.generatedAt,
      }),
    };
  }
  if (req.path === `${base}/history` && req.method === 'GET')
    return { body: exportLocalConnections(state, user.id) };
  const match = req.path.slice(base.length + 1).split('/');
  const id = match[0];
  if (!z.uuid().safeParse(id).success)
    return fail(400, 'Invalid connection ID.');
  if (match.length === 2 && match[1] === 'history' && req.method === 'GET') {
    const own = revisions.filter((r) => r.id === id).reverse();
    if (!own.length) return fail(404, 'Connection not found.');
    return { body: ResearchConnectionHistorySchema.parse({ revisions: own }) };
  }
  if (match.length !== 1 || req.method !== 'PUT')
    return fail(404, 'Connection operation unavailable.');
  const input = parseLocal(ResearchConnectionWriteSchema, req.body);
  const fingerprint = JSON.stringify({ id, input });
  const prior = saved.requests[input.requestId];
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      return fail(
        409,
        'This request ID was already used for different changes. Start a new review.',
      );
    return { body: prior.revision };
  }
  const otherOwners = state.data.localResearchConnections as
    Record<string, Records> | undefined;
  if (
    Object.entries(otherOwners ?? {}).some(
      ([owner, value]) =>
        owner !== user.id && value.revisions.some((r) => r.id === id),
    )
  )
    return fail(404, 'Connection not found.');
  if (
    input.action === 'create' &&
    !latest.has(id!) &&
    [...latest.values()].filter((r) => !r.removed).length >= 200
  )
    return fail(
      400,
      'Keep at most 200 active connections. Remove one before adding another.',
    );
  let revision;
  try {
    revision = reviseConnection(
      id!,
      input,
      latest.get(id!) ?? null,
      sources,
      targets,
      new Date().toISOString(),
    );
  } catch (e) {
    if (e instanceof ConnectionError) return fail(e.status, e.message);
    throw e;
  }
  state.data.localResearchConnections = {
    ...otherOwners,
    [user.id]: {
      revisions: [...revisions, revision],
      requests: {
        ...saved.requests,
        [input.requestId]: { fingerprint, revision },
      },
    },
  };
  return { body: revision };
};
