import { z } from 'zod';
import { AccountSchema, WatchlistSchema, InboxSchema } from './account.js';
import { SavedGoalsSchema } from './goals.js';
import { HoldingsSnapshotSchema } from './holdings.js';

// A read model of existing owned records, never a valuation or allocation.
export const OverviewSchema = z.strictObject({
  user: AccountSchema,
  goals: SavedGoalsSchema.shape.goals,
  holdings: HoldingsSnapshotSchema,
  watchlist: WatchlistSchema,
  inbox: InboxSchema,
  evaluatedAt: z.iso.datetime(),
});
export type Overview = z.infer<typeof OverviewSchema>;
