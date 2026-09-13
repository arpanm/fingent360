import {
  LearningCatalogSchema,
  learningRubrics,
  learningContentItems,
  LearningStateSchema,
  LearningSubmitSchema,
  LearningSuggestionsSchema,
  type LearningState,
} from '@fingent360/contracts';
import {
  fail,
  requireUser,
  type OfflineRequest,
  type OfflineResult,
  type LocalState,
  type OfflineBundle,
} from './types';
import { localGoals, localHoldings } from './finance';
export function exportOfflineLearning(
  state: LocalState,
  userId: string,
): LearningState {
  const all = (state.data.localLearning ?? {}) as Record<string, LearningState>;
  return (
    all[userId] ??
    LearningStateSchema.parse({ attempts: [], votes: [], polls: [] })
  );
}
const rubrics = learningRubrics;
export function handleLearning(
  req: OfflineRequest,
  state: LocalState,
  bundle: OfflineBundle,
): OfflineResult | undefined {
  void bundle;
  if (!req.path.startsWith('/api/v1/account/learning/')) return undefined;
  const user = requireUser(state),
    learning = exportOfflineLearning(state, user.id),
    p = req.path.slice('/api/v1/account/learning/'.length);
  const all = (state.data.localLearning ??= {}) as Record<
    string,
    LearningState
  >;
  all[user.id] = learning;
  const catalog = LearningCatalogSchema.parse({ items: learningContentItems });
  if (req.method === 'GET' && p === 'state') {
    learning.polls = catalog.items
      .filter((q) => q.kind === 'poll')
      .map((q) => {
        const own = learning.votes.find(
          (v) => v.questionId === q.id && v.version === q.version,
        );
        return {
          questionId: q.id,
          version: q.version,
          total: own ? 1 : 0,
          counts: q.choices.map((c) => ({
            choiceId: c.id,
            count: own?.choiceId === c.id ? 1 : 0,
          })),
        };
      });
    return { body: LearningStateSchema.parse(learning) };
  }
  if (req.method === 'GET' && p === 'suggestions') {
    const goals = localGoals(state, user.id)
      .slice(0, 2)
      .map((g) => ({
        kind: 'goal' as const,
        sourceId: g.id,
        sourceVersion: g.version,
        sourceName: g.name,
        savedAt: g.updatedAt,
        values: {
          type: g.type,
          monthlyMinor: g.monthlyMinor,
          horizonMonths: g.horizonMonths,
        },
      }));
    const holdings = localHoldings(state, user.id);
    return {
      body: LearningSuggestionsSchema.parse({
        basis: 'your-saved-input-only',
        suggestions: [
          ...goals,
          ...holdings.holdings.slice(0, 2).map((h) => ({
            kind: 'holding',
            sourceId: h.isin,
            sourceVersion: holdings.version,
            sourceName: h.isin,
            savedAt: holdings.updatedAt,
            values: h,
          })),
        ],
      }),
    };
  }
  if (req.method === 'POST' && (p === 'attempts' || p === 'vote')) {
    const input = LearningSubmitSchema.parse(req.body);
    const question = catalog.items.find(
      (q) =>
        q.id === input.questionId &&
        q.version === input.version &&
        q.kind === (p === 'vote' ? 'poll' : 'quiz'),
    );
    if (!question || !question.choices.some((c) => c.id === input.choiceId))
      fail(400, 'Choose a listed choice and edition.');
    const maps = (state.data.localLearningRequests ??= {}) as Record<
      string,
      Record<string, { input: unknown; result: unknown }>
    >;
    const requests = (maps[user.id] ??= {});
    const prior = requests[input.requestId];
    if (prior) {
      if (JSON.stringify(prior.input) !== JSON.stringify(input))
        fail(409, 'Request key was already used.');
      return { body: prior.result, status: 201 };
    }
    const time = new Date().toISOString();
    let result;
    if (p === 'vote') {
      result = {
        questionId: question.id,
        version: question.version,
        choiceId: input.choiceId,
        votedAt: time,
      };
      learning.votes = learning.votes.filter(
        (v) => v.questionId !== question.id,
      );
      learning.votes.push(result);
    } else {
      const rubric = rubrics[question.id];
      if (!rubric) fail(503, 'This quiz rubric is not bundled.');
      result = {
        id: crypto.randomUUID(),
        questionId: question.id,
        version: question.version,
        choiceId: input.choiceId,
        correct: rubric.answer === input.choiceId,
        explanation: rubric.explanation,
        sourceRevision: question.source.revision,
        answeredAt: time,
      };
      learning.attempts.unshift(result);
    }
    requests[input.requestId] = { input, result };
    return { body: result, status: 201 };
  }
  return undefined;
}
