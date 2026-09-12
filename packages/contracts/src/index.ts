import { z } from 'zod';

export const HealthSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('fingent360-api'),
  timestamp: z.iso.datetime(),
});
export type Health = z.infer<typeof HealthSchema>;

export const ReadinessSchema = z.strictObject({
  status: z.enum(['ready', 'unavailable']),
  dependencies: z.strictObject({
    postgres: z.enum(['up', 'down']),
    mongodb: z.enum(['up', 'down']),
  }),
});
export type Readiness = z.infer<typeof ReadinessSchema>;

// The journey contracts describe the bounded synthetic slice; live provider
// and full canonical domain contracts remain separate delivery tasks.

export * from './journey.js';
export * from './macro.js';
export * from './account.js';
export * from './goals.js';
export * from './privacy.js';
export * from './sources.js';
export * from './alert-preferences.js';
export * from './holdings.js';

export * from './overview.js';
