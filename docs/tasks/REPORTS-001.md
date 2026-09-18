# REPORTS-001 — Saved research reports

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - REPORTS-001 (DEV-011/016/021): Implemented and verified for the bounded scope. Request and reopen an immutable record review of actual owned goals/holdings, with provenance and missing-market-data boundaries. Prompt: specify report inputs/output and deterministic no-growth policy; implement migration019 with PostgreSQL jobs, leases, bounded retries, idempotency, cancellation and immutable issued snapshots; real account-scoped status/history/download API, mobile/keyboard UI and retry/recove
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Reviewed functional closure — 2026-09-17

The complete required API/browser/offline matrix is recorded in `docs/tasks/acceptance.json`. Implementation of its supported functional scope is complete; the new repairs remain unvalidated. User command: `pnpm sdlc "Complete REPORTS-001" --story REPORTS-001`. SDLC may mark the accepted functional scope Done only after all required current cases and checks pass. Live-source/editorial activation and native production release remain separate operational prerequisites, not permissions inferred from these tests. See [consolidated commands and completed scope](../development/core-journey-acceptance.md). Existing failure records stay open until observed passing reruns.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **REPORTS-001 (DEV-011/016/021):** Implemented and verified for the bounded scope. Request and reopen an immutable record review of actual owned goals/holdings, with provenance and missing-market-data boundaries. Prompt: specify report inputs/output and deterministic no-growth policy; implement migration019 with PostgreSQL jobs, leases, bounded retries, idempotency, cancellation and immutable issued snapshots; real account-scoped status/history/download API, mobile/keyboard UI and retry/recovery, offline local equivalent that resumes on next open, export/deletion integration, and meaningful API/browser/offline tests including worker crash/expired lease, duplicate request, ownership and unchanged issued output after edits. No trades, fabricated prices, scheduled external delivery or investment recommendation. Reserved API/WEB220–229, OFFLINE260–269.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REPORTS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Worker phase isolation — 2026-09-17

Input: the user authorized continuing functional repairs and parallel authoring. Saved run1789569622822-36573 records WEB425 remaining queued and WEB224 lacking an Open report button; its page snapshot confirms queued preparation. WEB295's checkbox was present and enabled when actionability timed out, so no checkbox defect is established. The latest handoff1789668985904-90b04bf6-b668-4e6f-8631-f2152cfa5af8 began2026-09-17T18:16:25.904Z against API4104/web5176 and passed eight unrelated selected attempts; it does not validate these report journeys.

Concrete defect found during inspection: a scheduled-capture exception skips already-captured report preparation because both phases share one try block. Scope: isolate preparation from that failure, retain storage observations, sequential phases, the existing one-active-tick guard, worker pause admission, leases and immutable snapshots. This explains one possible queued-report failure mode; the saved run does not prove it was the original cause.

Reusable repair prompt: read report worker/store/schedule lifecycle, preserve authorization and lease semantics, independently attempt preparation after a scheduler exception, and author an actual isolated-API regression. Temporarily rename only the fixture-owned schedule table with bounded database operations and guaranteed restoration/connection closure. Do not manufacture a successful report or change timeouts to conceal a queue failure. Do not run any deterministic commands.

Acceptance: API227 must record a real scheduler storage failure while a captured report still reaches succeeded, then reconstruct the same snapshot from the download with exactly one issued row. After restoring the table, a later report must also issue. Existing API220–222 retain ownership, request identity, cancellation, exhausted-attempt and lease recovery coverage. Browser WEB224/295/425 must still exercise deletion/stale reads, selected research revision recovery and foreign deep links on desktop/mobile; no pass is claimed from this repair.

Layer record: specification/automation/functionality changed as described; tests add API227 using actual PostgreSQL and API requests. API/contracts and data model are reused unchanged; database migration is not applicable. UI/UX/keyboard/mobile/offline behavior is unchanged and retains the existing cases; this connected worker cannot run in packaged local mode. Provenance remains the actual immutable owned snapshot, using synthetic test records only. Documentation records the bounded scope and unconfirmed saved-run diagnosis.

Manual handoff: with existing dependencies, migrated PostgreSQL/MongoDB and the API/web services started by the user at the printed `pnpm dev` origins, run `pnpm sdlc "Isolate queued reports from scheduler failures" -- --grep 'E2E-API-22[0127] |E2E-WEB-(224|295|425) '`. Use the printed web URL plus `/#reports` for keyboard/mobile review. Expect API227 to issue during a recorded schedule-storage fault and preserve exact downloaded snapshot/one issued row; browser cases must pass their original assertions. No dependency installation or migration is added. On failure share the case/project, saved `artifacts/e2e/latest.md` run ID and failed-stage report/error context. No tests, formatting, checks, builds, services or commits were run by the authoring agent; commit awaits user gates. Existing generated validation records are retained unchanged.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789751750850-92480.
<!-- sdlc-validation:end -->
