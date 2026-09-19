# AUTH-WAIT-001 — Recheck authorization after storage waits

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** Production authorization-after-wait behavior retains its earlier recorded evidence. The API304 fixture now observes recovery through owned blocker relationships and allows bounded pre-lock password derivation.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** Not run for this repair. Earlier AUTH-WAIT-001 evidence applies only to its recorded revision.

## Scoped API304 fixture repair — 2026-09-17

- **Input:** User-operated E2E-API-304 timed out at `auth-wait.ts:139` because the recovery reset was not observed waiting on the owned account row within 2.5 seconds. The supplied command selected only API304. The latest saved handoff instead records an unrelated passing API1504 run started 2026-09-16T23:12:31.880Z, so it is not validation evidence for this repair.
- **Cause:** Recovery derives the replacement password before opening the transaction that locks `app_users`. The fixture started its 2.5-second database-wait poll as soon as the HTTP promise was created, so scheduler/cryptographic delay could exhaust the poll before the reset reached PostgreSQL. The observer also depended on the exact rendered recovery SQL text even though the owned `pg_blocking_pids` relationship already identifies the waiter.
- **Specification / acceptance:** Preserve the actual recovery request, isolated PostgreSQL blocker, allocation GET/PUT paths,401 response, unchanged private digest and recovered-session positive controls. Observe reset admission for a bounded eight seconds, retain the 2.5-second private-operation deadline, and select waiters by their relationship to owned blocker PIDs rather than query text. API304's read and save iterations are the regression cases. Do not weaken application authorization or replace storage with mocks.
- **Layers:** E2E fixture timing/lock observation and documentation only. Production API/contracts, allocation functionality, database schema/migrations, UI/UX (including loading/empty/error/saved, keyboard, mobile and visual behavior), offline mode, automation, financial calculations and real-source ingestion are unchanged.
- **Implemented:** Authored the bounded recovery-specific observer window and semantic blocker detection. API304 now reports its real allocation-read and allocation-save regressions as separate steps while retaining the same requests and assertions. Updated catalogue/coverage and the account-lock specification. No dependency, service, migration or UI URL change.
- **Verification / commit:** Not run; this scoped repair is authored only. No commit created. The parent script owns the exact failed-case retry.
- **Smallest user-run validation:** `pnpm e2e:run 'tests/e2e/cases/api/auth-wait\.spec\.ts' --project=api --grep 'E2E-API-304 allocation reads and writes reject recovery-revoked account waiters @AUTH-WAIT-001$'`. Prerequisites remain current dependencies, the built application, available local PostgreSQL/MongoDB and the configured running web application; the case launches its own isolated API/schema. No manual UI URL is used by this API-only command. Expected: both allocation read and save branches observe the real reset/private wait, return401 without digest changes, then succeed under the recovered session. On failure report the command, exit status, case/project, timestamp and assertion/stack; do not include cookies, passwords, recovery codes or database URLs.
- **Remaining:** User-run API304 evidence only. Historical AUTH-WAIT-001 evidence remains bounded to its earlier revision and does not validate this fixture repair.
- **Reusable repair prompt:** Inspect only the supplied API304 lock-observation failure. Preserve actual recovery, PostgreSQL locks,401/unchanged-state assertions and positive controls. Fix bounded fixture admission timing without sleeps, SQL-text coupling, mocks or product guard changes; update task/index/README/spec/catalog/coverage and leave execution/commit to the user.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **AUTH-WAIT-001 (DEV-017/007): Implemented and integration verified.** Requests admitted before waiting for account/report row locks can otherwise proceed after recovery revokes their session. Detailed Codex prompt: specify revocation/admission ordering, then recheck require(cookie) immediately after existing account locks in holdings preview/confirm, goal create/update/delete, allocation current/save and report request/delete before private reads/replay/writes. Report cancel/retry must acquire account lock, recheck, then lock job; preserve canonical account→report lock order and session-independent workers. Keep positive workflows, ownership, idempotent receipts, exact values and all retention/XLSX/new research behavior unchanged. Add real isolated API cases using owned-schema blockers and observed pg_blocking_pids: queue actual recovery/reset ahead of old-cookie operations, release in controlled order, expect401 and unchanged private revisions/previews/job/tombstone/budget data. Include replay paths and actual cancel/retry wait variant; always release/drain owned resources. Add browser regression if needed to prove revoked-session UI clears private state and can sign in again, without fabricated successful API responses. Reserve API300–309 and WEB300–309. Existing table/session model is reused; no migration/provider work. On-device mode has serialized local state rather than PostgreSQL row locks, so document why this server race does not apply and retain existing local auth coverage. Agent authors isolated spec/code/tests/handoff only; parent updates shared trackers and gates/commits after prerequisite integrations. No permission/guard weakening, no user-data reset and no push.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on AUTH-WAIT-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Reviewed acceptance scope — 20 September 2026

Reauthorization after actual PostgreSQL account/report waits, recovery and wall-clock expiry, unchanged owned state on rejection, replay paths and browser recovery with keyboard sign-in. Serialized on-device storage has no PostgreSQL lock wait; native certification is outside this server race.

The complete required case/project matrix is now recorded in `acceptance.json`. This review is not a test pass; actual current-revision receipts determine validation.

Remaining gates: None for this bounded functional scope.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: outage-final-1789852687840.
<!-- sdlc-validation:end -->
