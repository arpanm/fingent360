import {
  AssistanceInputSchema,
  AssistanceResultSchema,
} from '@fingent360/contracts';
import {
  requireUser,
  type OfflineRequest,
  type OfflineResult,
  type LocalState,
  type OfflineBundle,
} from './types';
import { published } from './content';
import { localGoals } from './finance';
export function handleAssistance(
  req: OfflineRequest,
  state: LocalState,
  bundle: OfflineBundle,
): OfflineResult | undefined {
  if (!req.path.startsWith('/api/v1/account/assistance')) return undefined;
  const user = requireUser(state);
  if (req.method === 'GET' && req.path.endsWith('/options'))
    return { body: { defaultProvider: 'query', providers: [] } };
  if (req.method !== 'POST' || req.path !== '/api/v1/account/assistance')
    return undefined;
  const input = AssistanceInputSchema.parse(req.body),
    words = input.query.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const records = published(bundle)
    .filter(
      (v) =>
        v.kind === 'term' && v.summary.length > 0 && v.summary.length <= 700,
    )
    .map((v) => ({
      text: v.summary,
      type: 'explanation' as 'explanation' | 'goal_name',
      source: {
        id: v.id,
        title: v.title,
        href: `#read/${v.id}`,
        private: false,
      },
    }));
  if (input.useHistory && input.scope === 'goals')
    for (const goal of localGoals(state, user.id))
      records.push({
        text: goal.name,
        type: 'goal_name',
        source: {
          id: goal.id,
          title: goal.name,
          href: '#my-goals',
          private: true,
        },
      });
  const suggestions = records
    .map((v) => ({
      v,
      score: words.filter((w) =>
        `${v.source.title} ${v.text}`.toLocaleLowerCase().includes(w),
      ).length,
    }))
    .filter((v) => v.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.v.source.id.localeCompare(b.v.source.id),
    )
    .slice(0, 5)
    .map((v) => v.v);
  return {
    body: AssistanceResultSchema.parse({
      provider: 'query',
      model: null,
      fallback: !['query', 'auto'].includes(input.provider),
      message: `Offline query matches from the ${bundle.generatedAt.slice(0, 10)} snapshot. No cloud AI request was made.`,
      suggestions,
      usedHistory: suggestions.some((v) => v.source.private),
    }),
  };
}
