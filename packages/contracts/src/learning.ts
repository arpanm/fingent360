import { z } from 'zod';
import { SavedGoalInputSchema } from './goals.js';
import { AccountHoldingSchema } from './holdings.js';
export const LearningChoiceSchema = z.strictObject({
  id: z.string().min(1).max(30),
  text: z.string().min(1).max(300),
});
export const LearningQuestionSchema = z.strictObject({
  id: z.string().min(1).max(60),
  version: z.literal(1),
  kind: z.enum(['quiz', 'poll']),
  title: z.string(),
  prompt: z.string(),
  choices: z.array(LearningChoiceSchema).min(2).max(5),
  source: z.strictObject({
    title: z.string(),
    revision: z.literal('glossary-dev001-v1'),
    excerpt: z.string(),
  }),
});
export const LearningCatalogSchema = z.strictObject({
  items: z.array(LearningQuestionSchema),
});
export const LearningSubmitSchema = z.strictObject({
  questionId: z.string().min(1).max(60),
  version: z.literal(1),
  choiceId: z.string().min(1).max(30),
  requestId: z.uuid(),
  consent: z.literal(true),
});
export const LearningAttemptSchema = z.strictObject({
  id: z.uuid(),
  questionId: z.string(),
  version: z.literal(1),
  choiceId: z.string(),
  correct: z.boolean(),
  explanation: z.string(),
  sourceRevision: z.literal('glossary-dev001-v1'),
  answeredAt: z.iso.datetime(),
});
export const LearningVoteSchema = z.strictObject({
  questionId: z.string(),
  version: z.literal(1),
  choiceId: z.string(),
  votedAt: z.iso.datetime(),
});
export const LearningPollResultSchema = z.strictObject({
  questionId: z.string(),
  version: z.literal(1),
  total: z.number().int().nonnegative(),
  counts: z.array(
    z.strictObject({
      choiceId: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});
export const LearningStateSchema = z.strictObject({
  attempts: z.array(LearningAttemptSchema),
  votes: z.array(LearningVoteSchema),
  polls: z.array(LearningPollResultSchema),
});
export const LearningSuggestionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('goal'),
    sourceId: z.uuid(),
    sourceVersion: z.number().int().positive(),
    sourceName: z.string(),
    savedAt: z.iso.datetime(),
    values: SavedGoalInputSchema.pick({
      type: true,
      monthlyMinor: true,
      horizonMonths: true,
    }),
  }),
  z.strictObject({
    kind: z.literal('holding'),
    sourceId: z.string(),
    sourceVersion: z.number().int().positive(),
    sourceName: z.string(),
    savedAt: z.iso.datetime(),
    values: AccountHoldingSchema,
  }),
]);
export const LearningSuggestionsSchema = z.strictObject({
  suggestions: z.array(LearningSuggestionSchema).max(4),
  basis: z.literal('your-saved-input-only'),
});
export type LearningSuggestion = z.infer<typeof LearningSuggestionSchema>;
export type LearningQuestion = z.infer<typeof LearningQuestionSchema>;
export type LearningState = z.infer<typeof LearningStateSchema>;
