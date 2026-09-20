import { z } from 'zod';
const ConfigSchema = z.object({
  REGULATORY_SOURCES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  REGULATORY_SOURCES_PERMISSION_REFERENCE: z
    .string()
    .trim()
    .min(10)
    .max(2000)
    .optional(),
  WHATSAPP_AUTOMATIC_DISPATCH: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  WHATSAPP_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  WHATSAPP_ACCESS_TOKEN: z.string().max(10000).default(''),
  WHATSAPP_APP_SECRET: z.string().max(1000).default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().max(1000).default(''),
  WHATSAPP_PHONE_NUMBER_ID: z
    .string()
    .regex(/^(?:[0-9]{1,30})?$/)
    .default(''),
  WHATSAPP_BUSINESS_NUMBER: z
    .string()
    .regex(/^(?:[1-9][0-9]{5,14})?$/)
    .default(''),
  WHATSAPP_GRAPH_VERSION: z
    .string()
    .regex(/^v[0-9]+\.[0-9]+$/)
    .default('v23.0'),
  WHATSAPP_TEMPLATE_NAME: z
    .string()
    .regex(/^[a-z0-9_]{0,512}$/)
    .default(''),
  WHATSAPP_TEMPLATE_LANGUAGE: z
    .string()
    .regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/)
    .default('en_US'),
  WHATSAPP_PUBLIC_ORIGIN: z.union([z.literal(''), z.url()]).default(''),
  WHATSAPP_APPROVAL_REFERENCE: z.string().max(2000).default(''),
  WHATSAPP_ALLOWED_SOURCE_IDS: z.string().max(10000).default(''),

  CCIL_LIQUIDITY_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CCIL_LIQUIDITY_PERMISSION_REFERENCE: z
    .string()
    .trim()
    .min(10)
    .max(2000)
    .optional(),
  CCIL_ZERO_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CCIL_ZERO_PERMISSION_REFERENCE: z
    .string()
    .trim()
    .min(10)
    .max(2000)
    .optional(),
  CCIL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  CCIL_PERMISSION_REFERENCE: z.string().trim().min(10).max(2000).optional(),
  PRIVATE_DATA_KEYS: z.string().optional(),
  PRIVATE_DATA_ACTIVE_KEY: z.string().optional(),
  PRIVATE_IDENTITY_LOOKUP_KEY: z.string().optional(),
  ANGEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  ANGEL_API_KEY: z.string().min(1).optional(),
  ANGEL_REDIRECT_URL: z.url().optional(),
  ANGEL_PERMISSION_REFERENCE: z.string().min(1).optional(),
  ANGEL_CLIENT_LOCAL_IP: z.string().min(1).optional(),
  ANGEL_CLIENT_PUBLIC_IP: z.string().min(1).optional(),
  ANGEL_MAC_ADDRESS: z.string().min(1).optional(),
  UPSTOX_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  UPSTOX_API_KEY: z.string().min(1).optional(),
  UPSTOX_API_SECRET: z.string().min(1).optional(),
  UPSTOX_REDIRECT_URL: z.url().optional(),
  UPSTOX_PERMISSION_REFERENCE: z.string().min(1).optional(),
  KITE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  KITE_API_KEY: z.string().min(1).optional(),
  KITE_API_SECRET: z.string().min(1).optional(),
  KITE_REDIRECT_URL: z.url().optional(),
  KITE_PERMISSION_REFERENCE: z.string().min(1).optional(),
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
