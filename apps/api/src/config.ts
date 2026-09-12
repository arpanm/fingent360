import { z } from 'zod';
const ConfigSchema = z.object({
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
