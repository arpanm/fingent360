import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  BadRequestException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import type pg from 'pg';
import { z } from 'zod';
import {
  PrivacyExportSchema,
  storedHoldingsPreview,
  SessionsSchema,
  RevokeSessionSchema,
  RevokeOthersSchema,
  RevocationSchema,
} from '@fingent360/contracts';
import { AccountStore, STORE } from './accounts.js';
import { readLibrary } from './library.js';
import { sessionFromCookie } from './account-security.js';
import { exportResearchConnections } from './research-connections.js';
import { exportRecordReports } from './reports.js';

function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException('Invalid privacy request.');
  return parsed.data;
}
async function sessions(
  client: pg.PoolClient,
  userId: string,
  cookie?: string,
) {
  const result = await client.query<{
    public_id: string;
    created_at: Date;
    expires_at: Date;
    current: boolean;
  }>(
    'SELECT public_id, created_at, expires_at, token_hash=$2 AS current FROM app_sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC,public_id',
    [userId, sessionFromCookie(cookie)],
  );
  return SessionsSchema.parse({
    sessions: result.rows.map((row) => ({
      id: row.public_id,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      current: row.current,
    })),
  }).sessions;
}
@Controller('account/privacy')
export class PrivacyController {
  constructor(@Inject(STORE) private readonly store: AccountStore) {}
  @Get('sessions') list(@Headers('cookie') cookie?: string) {
    return this.store.transaction(async (client) => {
      const user = await this.store.require(client, cookie);
      return { sessions: await sessions(client, user.id, cookie) };
    });
  }
  @Post('sessions/revoke') @HttpCode(200) revoke(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    const request = input(RevokeSessionSchema, body);
    return this.store.transaction(async (client) => {
      const user = await this.store.require(client, cookie);
      const result = await client.query(
        'DELETE FROM app_sessions WHERE public_id=$1 AND user_id=$2 AND token_hash<>$3 AND expires_at>now()',
        [request.sessionId, user.id, sessionFromCookie(cookie)],
      );
      if (!result.rowCount)
        throw new NotFoundException(
          'Other active session not found. Use Sign out to end this session.',
        );
      return RevocationSchema.parse({ revoked: result.rowCount });
    });
  }
  @Post('sessions/revoke-others') @HttpCode(200) revokeOthers(
    @Body() body: unknown,
    @Headers('origin') origin?: string,
    @Headers('cookie') cookie?: string,
  ) {
    this.store.origin(origin);
    input(RevokeOthersSchema, body);
    return this.store.transaction(async (client) => {
      const user = await this.store.require(client, cookie);
      const result = await client.query(
        'DELETE FROM app_sessions WHERE user_id=$1 AND token_hash<>$2',
        [user.id, sessionFromCookie(cookie)],
      );
      return RevocationSchema.parse({ revoked: result.rowCount ?? 0 });
    });
  }
  @Get('export') download(
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
    @Headers('cookie') cookie?: string,
  ) {
    return this.store.transaction(async (client) => {
      // A single snapshot keeps account data consistent during concurrent edits.
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const user = await this.store.require(client, cookie);
      const list = await client.query<{ indicators: string[] }>(
        'SELECT indicators FROM app_watchlists WHERE user_id=$1',
        [user.id],
      );
      const receipts = await client.query<{
        observation_id: string;
        acknowledged_at: Date;
      }>(
        'SELECT observation_id,acknowledged_at FROM app_observation_receipts WHERE user_id=$1 ORDER BY acknowledged_at,observation_id',
        [user.id],
      );
      const tables = await client.query<{ available: boolean }>(
        "SELECT to_regclass('app_goals') IS NOT NULL AND to_regclass('app_goal_revisions') IS NOT NULL AS available",
      );
      const goalsAvailable = tables.rows[0]?.available ?? false;
      const goalRows = goalsAvailable
        ? (
            await client.query<{ payload: unknown; deleted_at: Date | null }>(
              'SELECT r.payload,g.deleted_at FROM app_goals g JOIN app_goal_revisions r ON r.goal_id=g.id WHERE g.user_id=$1 ORDER BY g.id,r.version',
              [user.id],
            )
          ).rows
        : [];
      const preferenceTable = await client.query<{ available: boolean }>(
        "SELECT to_regclass('app_alert_preferences') IS NOT NULL AS available",
      );
      const preferencesAvailable = preferenceTable.rows[0]?.available ?? false;
      const preferences = preferencesAvailable
        ? (
            await client.query<{
              indicator: string;
              muted: boolean;
              updated_at: Date;
            }>(
              'SELECT indicator,muted,updated_at FROM app_alert_preferences WHERE user_id=$1 ORDER BY indicator',
              [user.id],
            )
          ).rows
        : [];
      const holdingsTables = await client.query<{ available: boolean }>(
        "SELECT to_regclass('app_holdings') IS NOT NULL AND to_regclass('app_holdings_revisions') IS NOT NULL AND to_regclass('app_holdings_previews') IS NOT NULL AS available",
      );
      const holdingsAvailable = holdingsTables.rows[0]?.available ?? false;
      const currentHoldings = holdingsAvailable
        ? ((
            await client.query<{ version: number }>(
              'SELECT version FROM app_holdings WHERE user_id=$1',
              [user.id],
            )
          ).rows[0]?.version ?? 0)
        : 0;
      const holdingsRevisions = holdingsAvailable
        ? (
            await client.query<{ payload: unknown }>(
              'SELECT payload FROM app_holdings_revisions WHERE user_id=$1 ORDER BY version',
              [user.id],
            )
          ).rows
        : [];
      const holdingsPreviews = holdingsAvailable
        ? (
            await client.query<{
              id: string;
              expected_version: number;
              payload: unknown;
              expires_at: Date;
              confirmed_version: number | null;
            }>(
              'SELECT id,expected_version,payload,expires_at,confirmed_version FROM app_holdings_previews WHERE user_id=$1 ORDER BY expires_at,id',
              [user.id],
            )
          ).rows
        : [];
      const libraryTables = await client.query<{ available: boolean }>(
        "SELECT to_regclass('library_notifications') IS NOT NULL AS available",
      );
      const libraryAvailable = libraryTables.rows[0]?.available ?? false;
      const libraryData = libraryAvailable
        ? await readLibrary(client, user.id)
        : null;
      const learningTables = await client.query<{ available: boolean }>(
        "SELECT to_regclass('app_learning_attempts') IS NOT NULL AND to_regclass('app_learning_votes') IS NOT NULL AS available",
      );
      const learningAvailable = learningTables.rows[0]?.available ?? false;
      const learningAttempts = learningAvailable
        ? (
            await client.query<{ payload: unknown }>(
              'SELECT payload FROM app_learning_attempts WHERE user_id=$1 ORDER BY created_at,id',
              [user.id],
            )
          ).rows
        : [];
      const learningVotes = learningAvailable
        ? (
            await client.query<{
              question_id: string;
              question_version: number;
              choice_id: string;
              voted_at: Date;
            }>(
              'SELECT question_id,question_version,choice_id,voted_at FROM app_learning_votes WHERE user_id=$1 ORDER BY voted_at,question_id',
              [user.id],
            )
          ).rows
        : [];
      const exported = PrivacyExportSchema.parse({
        allocations: {
          revisions: (
            await client.query<{ payload: unknown }>(
              'SELECT payload FROM app_goal_allocation_revisions WHERE user_id=$1 ORDER BY version',
              [user.id],
            )
          ).rows.map((r) => r.payload),
        },
        reports: await exportRecordReports(client, user.id),
        researchConnections: await exportResearchConnections(client, user.id),
        formatVersion: 'account-export-v1',
        exportedAt: new Date().toISOString(),
        account: {
          id: user.id,
          username: user.username,
          consentVersion: user.consent_version,
          createdAt: user.created_at.toISOString(),
        },
        watchlist: { indicators: list.rows[0]?.indicators ?? [] },
        acknowledgments: receipts.rows.map((row) => ({
          observationId: row.observation_id,
          acknowledgedAt: row.acknowledged_at.toISOString(),
        })),
        sessions: await sessions(client, user.id, cookie),
        goals: {
          available: goalsAvailable,
          revisions: goalRows.map((row) => ({
            goal: row.payload,
            deletedAt: row.deleted_at?.toISOString() ?? null,
          })),
        },
        alertPreferences: {
          available: preferencesAvailable,
          items: preferences.map((row) => ({
            indicator: row.indicator,
            muted: row.muted,
            updatedAt: row.updated_at.toISOString(),
          })),
        },
        holdings: {
          available: holdingsAvailable,
          currentVersion: currentHoldings,
          revisions: holdingsRevisions.map((row) => row.payload),
          previews: holdingsPreviews.map((row) => ({
            id: row.id,
            expectedVersion: row.expected_version,
            ...storedHoldingsPreview(row.payload),
            expiresAt: row.expires_at.toISOString(),
            confirmedVersion: row.confirmed_version,
          })),
        },
        library: { available: libraryAvailable, data: libraryData },
        learning: {
          available: learningAvailable,
          attempts: learningAttempts.map((row) => row.payload),
          votes: learningVotes.map((row) => ({
            questionId: row.question_id,
            version: row.question_version,
            choiceId: row.choice_id,
            votedAt: row.voted_at.toISOString(),
          })),
        },
        exclusions: [
          'Password material, recovery codes/hashes, abuse counters and session credentials',
          'Public provider data (available separately through source evidence)',
          'Separate anonymous virtual exercise workspaces',
        ],
      });
      response.setHeader(
        'Content-Disposition',
        'attachment; filename="fingent360-account.json"',
      );
      response.setHeader('Cache-Control', 'no-store');
      return exported;
    });
  }
}
