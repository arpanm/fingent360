# Current publication quality

QUALITY-OVERVIEW-001 contributes to DEV021. Operations → Data quality reads actual current reading-publication heads (discovery_items/discovery_versions) and the latest20 ingestion run outcomes. The response includes no article text, raw error messages, credentials or account information. Operator authorization is checked again after storage reads. Existing runtime SELECT grants suffice; no migration, dependency, provider request or background job is introduced.

Strict contracts distinguish malformed data, missing head editions, publication states, missing review/evidence and future retrieval timestamps. News older than seven days since retrieval is flagged for triage; this is an explicit initial operational budget, not an assertion that historical reporting is wrong. Annual series and glossary terms have different semantics and are excluded. Queries inspect at most1,001 heads ordered by ID and return counts for the first1,000, explicitly indicating truncation. Counts are not whole-database metrics if truncated. The page clears old results while refreshing, supports retry and opens existing publishing review. Device-only Operations continues to make no network requests; the dashboard needs a connected API.

## Request diagnostics

Every API request receives a server-generated X-Request-ID and one structured completion or disconnect log containing only that ID, an allowlisted route family, bounded method, status and duration. Reviewed events, policy rates, oil benchmarks and reference FX have fixed family labels; IDs and queries are never labels. URLs, query strings, cookies, headers, body and account IDs are excluded. This is local request correlation; no distributed trace or measured uptime is claimed. Unit cases cover duplicate finish/close events, disconnects and secret omission. Operational log storage/access/retention must be configured by the deployment owner; do not ship stdout to third parties automatically.

## Operational objectives and incident workflow

Initial objectives for user acceptance: zero published malformed heads, zero missing current editions, zero published external records without an evidence hash, zero unreviewed publications, and zero future retrieval timestamps. These are triage objectives, not observed service-level attainment. An old news retrieval counter prompts source/run review, not automatic withdrawal. Annual freshness requires the individual source's release cadence. Worker heartbeat and due-job diagnostics remain in Worker health; pause controls are explicit and preserve admitted work.

On a quality breach, inspect Publishing and protected original evidence before any correction. Publish a new reviewed edition rather than modifying immutable history. For storage failure, inspect readiness and database configuration; do not reset volumes. Before a schema release, obtain owner-managed PostgreSQL and Mongo backups plus protected configuration, record migration checksums and application revision, and test restore into a separate owned environment. Never restore over live data as a diagnostic step. Roll back application code only when compatible with the applied schema; prefer additive forward repair and preserve receipts. Process-scoped completed/disconnected/error counters and fixed latency buckets are available in this view, resetting on restart. Production retention/alerting and measured restore/performance/security acceptance remain open. The [operational release plan](../evaluations/operational-release.md) defines objectives, rollback, restore and evaluation scenarios; no drill or SLA attainment is claimed.

## Authored acceptance

API630 uses an isolated database, actual stored published source, malformed head and missing edition; it checks authentication, exact counters and absence of raw data. WEB630 runs on desktop/mobile for actual empty state, simulated storage503, retry and Publishing navigation. No execution is claimed.

With the existing databases and API/web services running, invoke:

```bash
E2E_BROWSER=chrome pnpm sdlc "Add operations quality overview" -- --grep 'E2E-(API|WEB)-630'
```

Expected selection: API630 and WEB630 desktop/mobile. Report artifacts/e2e/latest.md on failure. No agent checks, migrations, builds, tests or commit; user-run gates own the commit. Rebuild/reinstall APK for changed bundled web code; no new APK is claimed.
