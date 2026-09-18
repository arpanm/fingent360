# FEEDBACK-TEST-001 — Repeatable real feedback tests without shared quota exhaustion

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Complete. Connected feedback API/browser tests use a per-test temporary PostgreSQL schema and real API process with existing application code/migrations and unchanged production rate limits. Only feedback/operations browser requests are forwarded to that owned API; the actual running web/content remains. Fixtures are created only when a case runs, never during discovery; cleanup settles startup cancellation and independently closes the API/drops the exact owned schema/ends its pool. Real POST/receipt/attachment/review/deletion assertions remain. Receipt checks surface visible delivery failures; redundant cleanup DELETE requests no longer replace primary errors. Reports include temporary targets, and API193 expiry setup cannot fall back to the app database.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### FEEDBACK-TEST-001 — Repeatable real feedback tests without shared quota exhaustion

- **Request/evidence:** Fix all seven feedback failures in user run `2026-09-13T17-22-11-309Z-16823`, started17:22:12.095Z, web5175/API4103:147 completed,139 passed,7 failed,1 intentional outage skip. WEB190/192/194/195 hit HTTP429 after earlier runs used the shared hourly quota; failed cleanup obscured the original submission error. Previous focused passes did not establish repeatable full-suite behavior.
- **Implementation:** Complete. Connected feedback API/browser tests use a per-test temporary PostgreSQL schema and real API process with existing application code/migrations and unchanged production rate limits. Only feedback/operations browser requests are forwarded to that owned API; the actual running web/content remains. Fixtures are created only when a case runs, never during discovery; cleanup settles startup cancellation and independently closes the API/drops the exact owned schema/ends its pool. Real POST/receipt/attachment/review/deletion assertions remain. Receipt checks surface visible delivery failures; redundant cleanup DELETE requests no longer replace primary errors. Reports include temporary targets, and API193 expiry setup cannot fall back to the app database.
- **Layers/acceptance:** Existing UI, APK, contracts, database model, feedback workflow, limits and privacy policy are reused unchanged; this correction concerns test infrastructure and diagnostics. Real Postgres migrations/API persistence and real browser screenshot/audio continue. Add a real quota-boundary case proving20 accepted/21st rejected, idempotent retries and owned deletion still succeed, while repeated independent cases/runs remain isolated. No production bypass, fake-success response, source refresh, app-data reset or quota reset. Update catalogue, coverage, README/TODO/status and runner docs.
- **Codex prompt:** Read the exact report and cleanup errors, feedback limiter/transaction/ownership, current API creation/migration code and Playwright fixtures. Build bounded loopback-only per-test schemas and real ephemeral API startup, with safe owned teardown and no import/discovery side effects. Keep connection secrets out of output, traces and artifacts; do not change global env/production quotas. Preserve browser-to-operator-to-receipt flows against the isolated actual API, and point retention setup only at the owned schema. Capture delivery failures before cleanup; do not treat429 or skipped assertions as a pass. Run focused feedback twice consecutively, then an integrated suite if warranted, final format/check gates and scoped local commit; never push. Existing databases/app/data stay intact.
- **Verification:** Consecutive feedback runs `2026-09-13T17-39-43-757Z-18148` and `2026-09-13T17-41-07-366Z-18359` each passed **21/21** across API/desktop/mobile, including the real quota boundary. Full integrated run **`2026-09-13T17-43-32-847Z-19192`** then completed149 cases: **148 passed, zero failed, one intentional API004 outage skip**, including all seven reported failures and new cancellation API195. Read-only before/after comparison confirmed55 main feedback records and unchanged hourly bucket rows at20; no temporary PostgreSQL schemas or MongoDB databases remain. Discovery listed22 cases with deliberately unreachable database overrides and no fixture startup. Format/check passed with85 unit tests; final documentation is included in pre-commit gates. Clean starting commit cce3b82; no production quota/data reset or app/APK changes.
- **Manual next actions:** With existing local web/API/databases running and compiled API current, use `E2E_BROWSER=chrome pnpm e2e:ui` and Run all or @FEEDBACK-001 twice, watch off. Expect independent passes without an hourly wait; API004 remains opt-in for a deliberate database outage. Send artifacts/e2e/latest.md for any failure. No new dependencies/migration/APK install; commit locally only after final format/check, never push.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on FEEDBACK-TEST-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Validation only
- **User input needed now:** No for the independent next step.
- **Decision:** No new feature input needed. Implementation is already recorded; do not put this in the implementation queue solely because tests are unrun. Match saved failures to this task before authoring a repair.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** User-owned SDLC/test evidence is needed for verification. The report observed during triage is incomplete; no new full run is requested.
- **Next action:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789719520254-79325.
<!-- sdlc-validation:end -->
