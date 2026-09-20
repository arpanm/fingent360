# READINESS-RECOVERY-001 — Mongo readiness remains down after database restoration

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** API004 passes outage reporting. On two authorized local checks, MongoDB was restarted and healthy, but the API continued reporting MongoDB down. Restarting only the existing API watcher child restored readiness200.
- **Pending:** Run authored API2302 restoration acceptance against the current build. The exact original driver rejection remains uncaptured; earlier outage-only receipts do not establish recovery.
- **Next action / inputs:** Agent-ready. No new credential, database reset or user decision is needed. Preserve existing data and runtime/owner separation.
- **Verification:** Outage receipts2026-09-19T21-18-08-742Z-49882 and2026-09-19T22-31-20-475Z-56976 passed their existing down-state assertion. They do not test restoration. Following each, the observed readiness response remained unavailable with postgres up and mongodb down after the container became healthy; an API watcher-child restart restored both up. Direct configured Mongo ping also succeeded during the first occurrence. No original driver rejection class was captured.

## Specification and reusable prompt

Read DatabaseProbe in apps/api/src/readiness.ts and the installed Mongo driver before changing behavior. Preserve health200/readiness503 contracts during genuine outages and suppress credential-bearing errors. Prove whether a failed first connection leaves a closed topology, whether an established connection also fails to recover, and whether a watcher restart occurred between probes. The installed driver can retain a closed topology after a failed initial connect, but that is a candidate cause, not a proven incident diagnosis. Cover first-connect failure, restoration, established-client outage, recovery without API restart and graceful shutdown. Use bounded probes and the existing local databases; no volume removal. No UI or data migration is expected unless the confirmed fix requires one. Add/update the foundation API regression and task/index/docs; execute only under current user authorization. Keep this issue open until saved restoration evidence demonstrates the fix.

## 2026-09-20 authored recovery

Specification: the same DatabaseProbe must report PostgreSQL up/Mongo down on a
failed initial connection, recover when that connection is restored, report a
later established-connection outage, and recover again without restarting the API.
Concurrent readiness requests share a bounded probe; shutdown drains that probe,
closes both pools once and rejects future reconnect attempts. Public health and
readiness schemas, databases and mobile/web consumers are unchanged. No migration,
provider data, new UI, credentials or database reset is needed.

Implementation: each Mongo probe explicitly calls the driver's idempotent
`connect()` before pinging. This addresses the driver path that retains a closed
topology after initial connection failure. The prior incident did not capture the
original rejection type, so this is a source-supported recovery fix, not a claim
that its precise incident cause was captured.

E2E-API-2302 exercises the actual compiled DatabaseProbe and local databases through
an isolated loopback TCP gate: initial refusal, restoration, established socket
loss, restoration, concurrent callers and shutdown. Only this test's sockets are
interrupted; shared services and application records are untouched. API002/004
continue to cover the HTTP contract. Offline clients have no server readiness probe.

**Implementation status:** Authored; validation pending. **Verification:** not run.
User next action: `pnpm sdlc "Repair Mongo readiness recovery" --story READINESS-RECOVERY-001`
with local PostgreSQL and MongoDB available. Report the saved run ID and exact
API2302 stage on failure. Existing outage-only receipts are not recovery passes.
