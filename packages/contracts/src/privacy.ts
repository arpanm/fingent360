import { GoalFeasibilityExportSchema } from './goal-feasibility.js';
import {
  ConsentPrivacySchema,
  CompleteConsentPrivacySchema,
} from './consents.js';
import {
  MaterialExportSchema,
  CompleteMaterialExportSchema,
} from './material-alerts.js';
import {
  ReadingFollowExportSchema,
  CompleteReadingFollowExportSchema,
} from './reading-follow.js';
import {
  CompleteScheduleExportSchema,
  ScheduleExportSchema,
} from './report-schedules.js';
import { GoalScenarioExportSchema } from './goal-scenarios.js';
import { ConnectionReviewExportSchema } from './connection-reviews.js';
import { z } from 'zod';
import { ResearchConnectionHistorySchema } from './research-connections.js';
import { LibrarySchema } from './library.js';
import { LearningAttemptSchema, LearningVoteSchema } from './learning.js';
import {
  HoldingsReconciliationSchema,
  HoldingsImportSchema,
  HoldingRowsSchema,
  HoldingsSnapshotSchema,
} from './holdings.js';
import { MacroIndicatorSchema } from './macro.js';
import { SavedGoalSchema } from './goals.js';
import { AccountSchema, WatchlistSchema } from './account.js';
import { AllocationHistorySchema } from './allocations.js';
import { ReportJobsSchema } from './reports.js';
export const PrivacySessionSchema = z.strictObject({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  current: z.boolean(),
});
export const SessionsSchema = z.strictObject({
  sessions: z.array(PrivacySessionSchema).max(10),
});
export const RevokeSessionSchema = z.strictObject({ sessionId: z.uuid() });
export const RevokeOthersSchema = z.strictObject({});
export const RevocationSchema = z.strictObject({
  revoked: z.number().int().nonnegative(),
});
export const PrivacyExportSchema = z.strictObject({
  formatVersion: z.literal('account-export-v1'),
  exportedAt: z.iso.datetime(),
  account: AccountSchema,
  watchlist: WatchlistSchema,
  acknowledgments: z.array(
    z.strictObject({
      observationId: z.uuid(),
      acknowledgedAt: z.iso.datetime(),
    }),
  ),
  sessions: z.array(PrivacySessionSchema).max(10),
  goals: z.strictObject({
    available: z.boolean(),
    revisions: z.array(
      z.strictObject({
        goal: SavedGoalSchema,
        deletedAt: z.iso.datetime().nullable(),
      }),
    ),
  }),
  alertPreferences: z.strictObject({
    available: z.boolean(),
    items: z
      .array(
        z.strictObject({
          indicator: MacroIndicatorSchema,
          muted: z.boolean(),
          updatedAt: z.iso.datetime(),
        }),
      )
      .max(2),
  }),
  holdings: z.strictObject({
    available: z.boolean(),
    currentVersion: z.number().int().nonnegative(),
    revisions: z.array(HoldingsSnapshotSchema),
    previews: z.array(
      z.strictObject({
        id: z.uuid(),
        expectedVersion: z.number().int().nonnegative(),
        holdings: HoldingRowsSchema,
        import: HoldingsImportSchema.optional(),
        reconciliation: HoldingsReconciliationSchema.optional(),
        expiresAt: z.iso.datetime(),
        confirmedVersion: z.number().int().positive().nullable(),
      }),
    ),
  }),
  library: z.strictObject({
    available: z.boolean(),
    data: LibrarySchema.nullable(),
  }),
  learning: z.strictObject({
    available: z.boolean(),
    attempts: z.array(LearningAttemptSchema),
    votes: z.array(LearningVoteSchema),
  }),
  exclusions: z.array(z.string()),
  allocations: AllocationHistorySchema,
  goalScenarios: GoalScenarioExportSchema,
  goalFeasibility: GoalFeasibilityExportSchema,
  connectionReviews: ConnectionReviewExportSchema,
  readingFollow: ReadingFollowExportSchema,
  materialAlerts: MaterialExportSchema,
  consents: ConsentPrivacySchema,
  reports: ReportJobsSchema,
  reportSchedules: ScheduleExportSchema,
  researchConnections: ResearchConnectionHistorySchema,
});
export type PrivacySession = z.infer<typeof PrivacySessionSchema>;

/** Download artifact after all bounded schedule and reading-history pages have been collected successfully. */
export const CompletePrivacyExportSchema = PrivacyExportSchema.extend({
  reportSchedules: CompleteScheduleExportSchema,
  readingFollow: CompleteReadingFollowExportSchema,
  materialAlerts: CompleteMaterialExportSchema,
  consents: CompleteConsentPrivacySchema,
});
