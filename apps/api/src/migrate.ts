import { readFile } from 'node:fs/promises';
import pg from 'pg';
import {
  DatabaseRoleError,
  migrationDatabaseUrl,
  refreshRuntimeGrants,
} from './database-roles.js';
import { storageErrorMessage } from './storage-error.js';
import { applyMigration } from './migration-ledger.js';
const pool = new pg.Pool({
  connectionString: migrationDatabaseUrl(process.env),
  connectionTimeoutMillis: 5000,
});
let client: pg.PoolClient | undefined;
try {
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(360001)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const filename of [
    '001_virtual_journey.sql',
    '002_macro.sql',
    '003_accounts.sql',
    '004_inbox.sql',
    '005_goals.sql',
    '006_privacy.sql',
    '007_sources.sql',
    '008_alert_preferences.sql',
    '009_holdings.sql',
    '010_discovery.sql',
    '011_library.sql',
    '012_learning.sql',
    '013_media.sql',
    '014_media_attempts.sql',
    '015_source_runs.sql',
    '016_feedback.sql',
    '017_goal_allocations.sql',
    '018_account_recovery.sql',
    '019_record_reports.sql',
    '020_security_identities.sql',
    '021_report_deletions.sql',
    '022_retention.sql',
    '024_research_connections.sql',
    '025_goal_scenarios.sql',
    '027_connection_reviews.sql',
    '029_report_schedules.sql',
    '030_worker_health.sql',
    '032_reading_follow.sql',
    '035_bea_quarantine.sql',
    '036_publishing_queue_indexes.sql',
    '037_goal_feasibility.sql',
    '038_named_operators.sql',
    '039_material_alerts.sql',
    '040_ecb_rates.sql',
    '041_reviewed_events.sql',
    '042_oil_benchmarks.sql',
    '043_consent_lifecycle.sql',
    '044_material_automatic.sql',
    '045_ecb_fx.sql',
    '046_event_lineage.sql',
    '047_event_extraction.sql',
    '048_identity_adjudication.sql',
    '049_equity_coverage.sql',
    '051_impact_trace.sql',
    '052_action_centre.sql',
    '053_event_scenarios.sql',
    '054_research_automation.sql',
    '055_funds_bonds.sql',
    '056_evaluation_lineage.sql',
    '057_story_images.sql',
  ]) {
    await applyMigration(
      client,
      filename,
      await readFile(
        new URL(`../../../infra/migrations/${filename}`, import.meta.url),
        'utf8',
      ),
    );
  }
  await refreshRuntimeGrants(client, process.env);
  await client.query('COMMIT');
  console.log(
    'Application schemas are ready. Applied migration checksums recorded; existing data preserved.',
  );
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  const detail =
    error instanceof DatabaseRoleError ||
    (error instanceof Error &&
      error.message.startsWith('Applied migration changed:'))
      ? error.message
      : storageErrorMessage(error);
  console.error(`Migration failed: ${detail}`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
