import type { FeedItem, ResearchCatalog } from '@fingent360/contracts';

export interface OfflineRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Headers;
}
export interface OfflineResult {
  body: unknown;
  status?: number;
  headers?: Record<string, string>;
}
export interface LocalUser {
  id: string;
  username: string;
  createdAt: string;
  consentedAt: string;
  passwordHash: string;
  passwordSalt: string;
}
export interface LocalState {
  schemaVersion: 1;
  revision: number;
  users: Record<string, LocalUser>;
  sessionUserId: string | null;
  data: Record<string, unknown>;
}
export interface OfflineBundle {
  generatedAt: string;
  feed: FeedItem[];
  histories: Record<string, FeedItem[]>;
  evidence: Record<string, unknown>;
  macro: unknown;
  macroHistory: Record<string, unknown>;
  macroEvidence: Record<string, unknown>;
  sources: unknown;
  researchCatalog?: ResearchCatalog;
  learningCatalog: unknown;
  journeyCatalog: unknown;
  media: Record<string, unknown>;
  equityCoverage?: unknown;
  eventScenarios?: unknown;
  fundsBonds?: unknown;
  researchCalendar?: unknown;
  securities?: unknown;
  securityHistories?: Record<string, unknown>;
  securityEvidence?: Record<string, unknown>;
  events?: unknown[];
  eventHistories?: Record<string, unknown>;
  identitySelections?: Record<string, unknown>;
  identitySelectionHistories?: Record<string, unknown>;
  eventLineage?: Record<string, unknown>;
  policyRates?: unknown;
  policyRateHistory?: unknown[];
  policyRateAdmittedEditions?: number[];
  oilBenchmarks?: unknown;
  oilBenchmarkHistory?: unknown[];
  oilBenchmarkAdmittedEditions?: number[];
  ecbFx?: unknown;
  ecbFxHistory?: unknown[];
  ecbFxAdmittedEditions?: number[];
}
export class OfflineError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new OfflineError(status, message);
}
export function requireUser(state: LocalState): LocalUser {
  const user = state.sessionUserId
    ? state.users[state.sessionUserId]
    : undefined;
  if (!user) fail(401, 'Sign in to an account stored on this device.');
  return user;
}
export type OfflineHandler = (
  request: OfflineRequest,
  state: LocalState,
  bundle: OfflineBundle,
) =>
  OfflineResult | null | undefined | Promise<OfflineResult | null | undefined>;
