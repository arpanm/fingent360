import { z } from 'zod';
const ConfigSchema = z.object({
  STORY_IMAGE_PROVIDER: z.enum(['off', 'openai', 'gemini']).optional(),
  STORY_IMAGE_MODEL: z.string().min(1).max(120).optional(),
  RESEARCH_AUTO_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  OPS_AUTH_MODE: z.enum(['bootstrap', 'named']).default('bootstrap'),
  AI_PROVIDER: z
    .enum(['auto', 'query', 'openai', 'gemini', 'anthropic'])
    .default('auto'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  RESEARCH_ADMIN_TOKEN: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  API_HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
});
export type AppConfig = z.infer<typeof ConfigSchema>;
export function readConfig(env: NodeJS.ProcessEnv): AppConfig {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    // Do not include values: connection strings may contain credentials.
    throw new Error(
      `Invalid configuration: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  }
  return result.data;
}
