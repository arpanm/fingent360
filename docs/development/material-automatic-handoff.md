# MATERIAL-AUTO-001 handoff

Implementation authored; user execution pending. No test, build, format, check, migration, provider request, service or commit was run. Shared uncommitted work is preserved; inspected HEAD was b5cfcd0.

## Files and integration

- `packages/contracts/src/material-alerts.ts`: backward-compatible default manual state, explicit automatic settings action, exact due reducer and automatic/paused immutable receipt kinds, consent-version binding, strict health response.
- `infra/migrations/044_material_automatic.sql`: indexed due/retry columns on owned heads and aggregate observation row; no existing account enabled and no history rewritten.
- `apps/api/src/material-alerts.ts`, `material-alert-store.ts`: account-serialized opt-in, current permission disclosure, due persistence and existing complete history export.
- `apps/api/src/material-worker.ts`:30-second timer, at most10 account transactions per tick, account SKIP LOCKED,5-second statement deadline,15-minute failure retry, completion+due atomicity and final expiry check after last storage wait. Only stored annual observations are read. Separate ops health GET has initial/final named-compatible authorization.
- `apps/web/src/MaterialAlerts.tsx`, `MaterialWorkerHealth.tsx`: explicit review/consent/back/enable/disable, current permission block/resume, dated next/last check and historical receipts; aggregate operations refresh.
- `apps/web/src/offline/material-alerts.ts`: same reducer and consent version, one signed-in account per serialized app-open transaction, dated installed evidence, no network.
- `tests/e2e/helpers/worker-health-process.mjs`: explicit isolated material action, no import-time execution.

Parent registered controller/provider, migration044, manual-worker fixture shutdown, Operations health component and local initial/visible/page-show hooks. Consent author adds the fourth independent purpose in043 with no legacy grant. No privacy field is needed: all automatic state and receipts are in existing complete paginated material history; owned head/event cascade already applies. Automatic grant receipts also appear in consent export.

## Authored acceptance

- API790: default manual, future first check, two actual worker instances, exactly one due receipt, restarted worker, disable, old enabling receipt replay cannot reenable, export and actual account cascade.
- API791: actual purpose revoke stops due evaluation, no false notice, manual check still works.
- API792: actual owned insert-trigger failure rolls back, defers one account, allows another due account, then recovery finishes exactly once.
- WEB790: mobile/desktop enable review/back/unchecked prohibition, actual saved state/reload/disable and retained manual controls.
- OFFLINE790: actual on-device UI persistence, dated bundle and zero network requests.
- OFFLINE791: local due handler once-only persistence, unchanged installed source provenance, denied-purpose pause, no network.
- `packages/contracts/test/material-automatic.test.mjs`: exact24-hour boundary, missed-day coalescing, missing evidence, denied-purpose baseline preservation and mandatory opt-in.

Existing MATERIAL-ALERTS cases continue to cover threshold exactness, correction/no-action, history pagination, receipt recovery and financial preservation. These are authored assertions, not passing results.

## User next actions

No dependency installation added. Run `pnpm db:up`, `pnpm db:migrate`, then `pnpm dev` using the printed web URL. Run `pnpm format` and `pnpm check` manually or the requested `pnpm sdlc "automatic stored material checks"` workflow. In a separate terminal run `E2E_BROWSER=chrome pnpm e2e:ui`; select `@MATERIAL-AUTO-001` in API/desktop/mobile projects and existing `@MATERIAL-ALERTS-001`. Keep watch/eye off. For installed local parity, rebuild the offline bundle/app through the documented Android workflow and select OFFLINE790–791 in `pnpm android:test:ui`.

Review Account → Material changes: save thresholds, review explicit automatic permission, enable; first eligible check is24h later. Privacy → Purpose consent can revoke; renewal alone cannot revive an old consent-version binding: explicitly resume in Material changes to establish a new baseline. Operations → Workers exposes real aggregate material health. Actual external providers, OS background scheduling and email/push are outside this feature. Capture `artifacts/e2e/latest.md` with run time/projects/cases and any failure details. Do not infer verification or commit inclusion from the authored state.
