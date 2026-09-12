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

// Financial domain contracts are the next delivery gate. Do not infer them
// from UI mockups or expose provider payloads as canonical domain records.
