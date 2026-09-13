import { z } from 'zod';
export const AssistanceProviderSchema = z.enum([
  'auto',
  'query',
  'openai',
  'gemini',
  'anthropic',
]);
export const AssistanceInputSchema = z.strictObject({
  query: z.string().trim().min(2).max(500),
  provider: AssistanceProviderSchema,
  scope: z.enum(['goals', 'holdings', 'learning']),
  useHistory: z.boolean(),
});
export const AssistanceOptionsSchema = z.strictObject({
  defaultProvider: AssistanceProviderSchema,
  providers: z.array(
    z.strictObject({
      provider: z.enum(['openai', 'gemini', 'anthropic']),
      model: z.string().min(1).max(150),
    }),
  ),
});
export const AssistanceSuggestionSchema = z.strictObject({
  text: z.string().min(1).max(700),
  type: z.enum(['explanation', 'goal_name']),
  source: z.strictObject({
    id: z.string(),
    title: z.string(),
    href: z
      .string()
      .regex(/^#(?:read\/[a-z0-9-]+|my-goals|holdings|learning)$/),
    private: z.boolean(),
  }),
});
export const AssistanceResultSchema = z.strictObject({
  provider: z.enum(['query', 'openai', 'gemini', 'anthropic']),
  model: z.string().nullable(),
  fallback: z.boolean(),
  message: z.string(),
  suggestions: z.array(AssistanceSuggestionSchema).max(5),
  usedHistory: z.boolean(),
});
export const AssistanceModelOutputSchema = z.strictObject({
  suggestions: z
    .array(
      z.strictObject({
        sourceId: z.string().min(1).max(150),
        text: z.string().min(1).max(700),
        type: z.enum(['explanation', 'goal_name']),
      }),
    )
    .max(5),
});
export type AssistanceInput = z.infer<typeof AssistanceInputSchema>;
export type AssistanceResult = z.infer<typeof AssistanceResultSchema>;
