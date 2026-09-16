export * from './bond-evidence.js';
export * from './filing-watch.js';
export * from './filing-discovery.js';
export * from './ccil-zero-curve.js';
export * from './corporate-rating.js';
export * from './eia-spot.js';
export * from './equity-action-terms.js';
export * from './sovereign-bond.js';
export * from './fund-factsheet-workflow.js';
export * from './fund-factsheet.js';
export * from './fund-mergers.js';
export * from './reading-calendar.js';
export * from './india-gdp-archive.js';
export * from './equity-price-history.js';
export * from './equity-consolidation.js';
export * from './commodity-benchmarks.js';
export * from './axis-portfolio-parser.js';
export * from './transmission-context.js';
export * from './whatsapp-schedule.js';
export * from './regulatory-sources.js';
export * from './cpi-expectations.js';
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

export * from './source-review.js';

export * from './bea-quarantine.js';

export * from './domain-records.js';
export * from './mapped-holdings.js';
export * from './publishing-queue.js';

export * from './goal-feasibility.js';
export * from './evidence-explanations.js';

export * from './quality-overview.js';

export * from './named-operators.js';
export * from './material-alerts.js';
export * from './ecb-rates.js';
export * from './ecb-rate-parser.js';

export * from './events.js';
export * from './consents.js';

export * from './oil-benchmarks.js';
export * from './oil-benchmark-parser.js';
export * from './event-lineage.js';

export * from './ecb-fx.js';
export * from './ecb-fx-parser.js';
export * from './identity-selection.js';

export * from './event-extraction.js';

export * from './equity-coverage.js';
export * from './broker-parsers.js';
export * from './impact-trace.js';

export * from './research-auto.js';

export * from './funds-bonds.js';

export * from './action-centre.js';

export * from './eval-lineage.js';

export * from './event-scenarios.js';

export * from './research-auto-policy.js';

export * from './deployment-monitoring.js';

export * from './bls-calendar.js';

export * from './fed-target-range.js';

export * from './public-reading-link.js';

export * from './action-plan.js';

export * from './research-governance.js';

export * from './company-news.js';

export * from './account-mfa.js';

export * from './action-tax.js';

export * from './india-macro.js';

export * from './impact-calibration.js';
export * from './equity-adjustments.js';
export * from './classification-crosswalk.js';
export * from './bea-gdp-vintage.js';
export * from './participant-positioning.js';
export * from './kite-connection.js';
export * from './institutional-flows.js';
export * from './company-event-packs.js';

export * from './policy-calendar.js';
export * from './upstox-connection.js';
export * from './bea-gdp-original.js';
export * from './oil-education.js';
export * from './angel-connection.js';
export * from './intelligence-brief.js';
export * from './sbi-portfolio.js';
export * from './sbi-portfolio-parser.js';
export * from './amfi-history.js';
export * from './rbi-calendar.js';
export * from './ccil-yields.js';
export * from './sbi-portfolio-structural-parser.js';
export * from './whatsapp-channel.js';
export * from './gdp-expectations.js';
