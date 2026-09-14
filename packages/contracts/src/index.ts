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

export * from './discovery.js';
export * from './library.js';
export * from './learning.js';
export * from './media.js';
export * from './assistance.js';

export * from './journey-domain.js';
export * from './research.js';
export * from './research-enrichment.js';
export * from './learning-content.js';
export * from './feedback.js';
export * from './allocations.js';
export * from './recovery.js';
export * from './reports.js';
export * from './securities.js';

export * from './workbook.js';
export * from './retention.js';
export * from './research-connections.js';

export * from './goal-scenarios.js';

export * from './connection-reviews.js';
export * from './bea.js';
export * from './worker-health.js';

export * from './report-schedules.js';
export * from './publication.js';

export * from './report-comparison.js';

export * from './reading-follow.js';
export * from './operator-audit.js';
