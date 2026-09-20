import { z } from 'zod';
import { ConsentViewSchema } from './consents.js';
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
  privateContextConsent: ConsentViewSchema.optional(),
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

// Authored educational field help. These are editable suggestions, not inferred
// user facts or provider-generated advice. Both server and offline clients use it.
export interface AssistanceTemplate {
  id: string;
  title: string;
  text: string;
  href: '#my-goals' | '#holdings' | '#learning';
  private: false;
  type: 'explanation' | 'goal_name';
}
const fieldHelp: Record<AssistanceInput['scope'], AssistanceTemplate[]> = {
  goals: [
    {
      id: 'field-target',
      title: 'Target amount',
      text: 'Your target is the amount you want to save for this goal. Enter your own estimate; you can change it later.',
      href: '#my-goals',
      private: false,
      type: 'explanation',
    },
    {
      id: 'field-monthly',
      title: 'Monthly contribution',
      text: 'Your monthly contribution is the amount you plan to add from your own budget. The illustration adds these contributions to your entered savings without assuming investment returns.',
      href: '#my-goals',
      private: false,
      type: 'explanation',
    },
  ],
  holdings: [
    {
      id: 'field-cost',
      title: 'Total purchase cost',
      text: 'Enter what you paid for the entire holding, not the price of one share. Use your statement to confirm the quantity and total purchase cost.',
      href: '#holdings',
      private: false,
      type: 'explanation',
    },
    {
      id: 'field-isin',
      title: 'Security ISIN',
      text: 'Copy the security ISIN from your statement. Its check digit catches typing errors; it does not verify that you own the holding.',
      href: '#holdings',
      private: false,
      type: 'explanation',
    },
  ],
  learning: [
    {
      id: 'field-learning',
      title: 'Learning activities',
      text: 'Choose a question, review its explanation and source, then return to the glossary when you want more context. Quiz answers are educational, not investment recommendations.',
      href: '#learning',
      private: false,
      type: 'explanation',
    },
  ],
};
export function assistanceTemplates(
  scope: AssistanceInput['scope'],
  query: string,
): AssistanceTemplate[] {
  const result = [...fieldHelp[scope]];
  if (scope === 'goals')
    for (const [word, name] of [
      ['education', 'Education goal'],
      ['retirement', 'Retirement goal'],
      ['home', 'Home purchase goal'],
      ['emergency', 'Emergency savings goal'],
    ] as const)
      if (query.toLocaleLowerCase().includes(word))
        result.push({
          id: `name-${word}`,
          title: 'Editable name based on your question',
          text: name,
          href: '#my-goals',
          private: false,
          type: 'goal_name',
        });
  return result;
}
