import { z } from 'zod';
export interface AssistanceConfig {
  AI_PROVIDER?:
    'auto' | 'query' | 'openai' | 'gemini' | 'anthropic' | undefined;
  OPENAI_API_KEY?: string | undefined;
  OPENAI_MODEL?: string | undefined;
  GEMINI_API_KEY?: string | undefined;
  GEMINI_MODEL?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  ANTHROPIC_MODEL?: string | undefined;
}
export type RemoteProvider = 'openai' | 'gemini' | 'anthropic';
export function configuredProviders(config: AssistanceConfig) {
  return (['openai', 'gemini', 'anthropic'] as const).flatMap((provider) => {
    const prefix = provider.toUpperCase() as 'OPENAI' | 'GEMINI' | 'ANTHROPIC';
    const key = config[`${prefix}_API_KEY`];
    const model = config[`${prefix}_MODEL`];
    return key && model ? [{ provider, model }] : [];
  });
}
const OpenAIResponse = z.object({
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional() }))
        .optional(),
    }),
  ),
});
const GeminiResponse = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        parts: z.array(
          z.object({
            text: z.string().optional(),
            thought: z.boolean().optional(),
          }),
        ),
      }),
    }),
  ),
});
const AnthropicResponse = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});
async function boundedJson(response: Response) {
  if (!response.ok) throw new Error('Provider request failed.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Provider response missing.');
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 65536) throw new Error('Provider response too large.');
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
/** Fixed provider hosts; never a user-supplied URL, no tools, retries or chat storage. */
export async function generateAssistance(
  config: AssistanceConfig,
  provider: RemoteProvider,
  instructions: string,
  input: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const prefix = provider.toUpperCase() as 'OPENAI' | 'GEMINI' | 'ANTHROPIC';
  const key = config[`${prefix}_API_KEY`];
  const model = config[`${prefix}_MODEL`];
  if (!key || !model) throw new Error('Provider not configured.');
  let url: string;
  let body: unknown;
  let auth: Record<string, string>;
  if (provider === 'openai') {
    url = 'https://api.openai.com/v1/responses';
    auth = { Authorization: `Bearer ${key}` };
    body = { model, instructions, input, max_output_tokens: 700, store: false };
  } else if (provider === 'gemini') {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    auth = { 'x-goog-api-key': key };
    body = {
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: {
        maxOutputTokens: 700,
        responseMimeType: 'application/json',
      },
    };
  } else {
    url = 'https://api.anthropic.com/v1/messages';
    auth = { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    body = {
      model,
      system: instructions,
      max_tokens: 700,
      messages: [{ role: 'user', content: input }],
    };
  }
  const data = await boundedJson(
    await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
      redirect: 'error',
    }),
  );
  if (provider === 'openai')
    return OpenAIResponse.parse(data)
      .output.flatMap((value) =>
        value.type === 'message' ? (value.content ?? []) : [],
      )
      .filter((value) => value.type === 'output_text')
      .map((value) => value.text ?? '')
      .join('');
  if (provider === 'gemini')
    return (
      GeminiResponse.parse(data)
        .candidates[0]?.content.parts.filter((value) => !value.thought)
        .map((value) => value.text ?? '')
        .join('') ?? ''
    );
  return AnthropicResponse.parse(data)
    .content.filter((value) => value.type === 'text')
    .map((value) => value.text ?? '')
    .join('');
}
