# Deployment monitoring — DEV-021

Implementation is authored; no format/check/build/migration/test/device acceptance was run by the agent. This is in-app monitoring of participating API processes sharing the configured PostgreSQL database, not an external uptime service or a launch-ready claim.

## Operator workflow

Operations → Data quality → Deployment monitoring works in responsive web and the connected Android shell using shared React UI. The first sample appears after approximately one minute of API uptime. Refresh reads persisted 15-minute aggregates across processes. Empty samples mean availability is unknown. A database/API outage displays unavailable with retry and clears stale values.

Server errors open an incident when at least 20 requests completed and at least 5% returned server errors in the retained 15-minute sample window. A registered process with no persisted heartbeat for three minutes opens a missing-heartbeat incident. Administrator acknowledgment survives reload and does not resolve an active condition. Recovery resolves the episode; recurrence creates a fresh unacknowledged episode. Latest 100 incidents are shown, with active incidents first and a truncation notice when needed.

After intentionally replacing/shutting down a crashed process, an administrator can confirm that **all currently missing processes have been decommissioned**, then retire them. Never use that control to conceal an unexplained outage. Its actor and time are stored. A process that returns registers again. Normal graceful shutdown retires itself. Incident acknowledgment and retirement require the normal origin check and named administrator permission; readers cannot mutate. Session admission is checked again after storage waits.

Device-only mode returns an explicit connected-server requirement for monitoring reads/writes and does not queue fabricated server state. Native APK changes require the existing manual web-build/Capacitor/APK packaging workflow; an installed offline APK does not update by itself.

## Data and automation

Migration059 adds process heartbeats, anonymous request samples and incident episodes. Each API process samples its existing real counters every minute. A stable sample UUID plus unique database key makes ambiguous commit retries idempotent. Successful capture advances the in-memory counter baseline; failed storage retains the pending receipt. SQL sums across every registered process, uses exact integer threshold arithmetic, and serializes incident transitions under a transaction advisory lock. No URLs, request bodies, account IDs or provider secrets are recorded. Existing process logs/request correlation and worker health remain available.

Samples are retained seven days, resolved incidents ninety days, and retired processes are removed after seven days once no samples reference them. Open incidents remain until recovery. Minute deltas are grouped by database persistence time, not individual request completion time; delayed recovery samples can shift the measurement window. Requests after the last successful sample can be lost on a hard process crash. These limits are visible operational counters, not SLA or billing measurements. If the entire deployment is down, it cannot notify itself: independently hosted uptime/restore/performance/security/device acceptance remains a release input.

## API and acceptance

- GET `/api/v1/ops/monitoring`: strict validated aggregate/current incident projection.
- POST `/api/v1/ops/monitoring/acknowledge` `{ "id": "incident-uuid" }`: idempotent durable acknowledgment; unknown fields rejected.
- POST `/api/v1/ops/monitoring/retire-missing` `{ "confirm": true }`: administrator confirmation of decommissioned stale processes; active heartbeat processes unaffected.

Authored cases: E2E-API-1270/1271 (actual owned-database multi-process aggregation, thresholds, recurrence, acknowledgment replay, origin/input denial and decommission); E2E-WEB-1270 (desktop/mobile incident lifecycle and unavailable recovery); E2E-OFFLINE-1270 (no server-state writes in device mode); API unit case covers uncertain persistence retry identity. Synthetic SQL fixtures are explicitly labelled and never represented as real operational measurements.

User-run next actions: no new dependencies. With configured PostgreSQL/MongoDB, apply `pnpm db:migrate`, restart the existing app with `pnpm dev` only when needed, then run `pnpm sdlc "Add deployment monitoring" --checks-only` and `pnpm e2e:run --grep @DEV-021`. Use the UI URL printed by `pnpm dev`, open `/#ops`, and use an administrator session. Browser cases apply to desktop/mobile; offline case to offline project. Keep watch/eye mode off. Expected results: actual stored aggregates, durable independent acknowledgment, retirement confirmation, unavailable retry and zero offline API traffic. For failures share the saved run directory, failed test ID/project, error and error-context file. Restore, security, load, native-device and external uptime acceptance remain separate; no tests were run or passes inferred here.
