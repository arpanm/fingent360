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
    '058_feedback_support_access.sql',
    '059_deployment_monitoring.sql',
    '061_private_history_encryption.sql',
    '062_bls_release_calendar.sql',
    '063_feedback_encryption.sql',
    '064_research_governance.sql',
    '065_company_news_policy.sql',
    '066_account_mfa.sql',
    '067_action_plan_encryption.sql',
    '068_india_macro_vintages.sql',
    '069_impact_calibrations.sql',
    '070_goal_encryption.sql',
    '071_holdings_encryption.sql',
    '072_goal_derivative_encryption.sql',
    '073_allocation_encryption.sql',
    '074_report_encryption.sql',
    '075_connection_encryption.sql',
    '076_equity_adjustment_windows.sql',
    '077_classification_crosswalks.sql',
    '079_bond_receipt_encryption.sql',
    '080_virtual_journey_encryption.sql',
    '081_account_identity_encryption.sql',
    '082_participant_positioning.sql',
    '083_kite_connection.sql',
    '084_institutional_flows.sql',
    '085_policy_calendar.sql',
    '086_upstox_connection.sql',
    '088_oil_education_source.sql',
    '089_angel_connection.sql',
    '091_intelligence_briefs.sql',
    '092_sbi_portfolio.sql',
    '093_amfi_history.sql',
    '094_rbi_calendar.sql',
    '095_ccil_yields.sql',
    '096_gdp_expectations.sql',
    '098_whatsapp_channel.sql',
    '100_cpi_expectations.sql',
    '101_regulatory_sources.sql',
    '102_whatsapp_schedules.sql',
    '104_commodity_benchmarks.sql',
    '109_india_gdp.sql',
    '110_equity_consolidations.sql',
    '119_fund_mergers.sql',
    '120_fund_factsheets.sql',
    '121_sovereign_bond.sql',
    '122_equity_action_terms.sql',
    '123_eia_spot.sql',
    '125_corporate_rating.sql',
    '126_ccil_zero_curve.sql',
    '127_filing_watch.sql',
    '128_filing_discovery.sql',
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
