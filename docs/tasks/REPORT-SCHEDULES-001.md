# REPORT-SCHEDULES-001 — Schedule saved reports

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - REPORT-SCHEDULES-001 (DEV-011/017/021): Implemented and selected verification passed; physical/production acceptance remains separate. Opt-in daily or weekly saved-record reports, generated in app from existing owned financial snapshots. Dependencies: REPORTS-001/002/003, current account/privacy and workers. Detailed Codex prompt: specify consent, IANA timezone/local time/day, next occurrence, immutable configuration editions, pause/edit/delete and missed-run policy before code. Add strict
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **REPORT-SCHEDULES-001 (DEV-011/017/021): Implemented and selected verification passed; physical/production acceptance remains separate.** Opt-in daily or weekly saved-record reports, generated in app from existing owned financial snapshots. Dependencies: REPORTS-001/002/003, current account/privacy and workers. Detailed Codex prompt: specify consent, IANA timezone/local time/day, next occurrence, immutable configuration editions, pause/edit/delete and missed-run policy before code. Add strict contracts and additive migration029 for owned bounded schedules, occurrence uniqueness and durable attempt/history receipts. Multiple workers/restarts must claim each occurrence once, preserve report idempotency/capacity/new-request limits/tombstones, and never recreate a deleted scheduled report. Capture actual owned records at execution with an explicit actual capture time; do not backdate missed reports. Create/edit/resume starts at the next future occurrence; ordinary missed-run catch-up while active is bounded to one latest due occurrence on worker execution/device open. Record skipped/capacity/failed outcomes honestly, and never introduce email/push/provider calls or regulated advice. Report creation must reuse exact existing v1/v2 capture and worker issuance; choose and visibly document whether automatic reports include research receipts and never silently add private data. Build Reports → Schedules → configure/review/consent/save → next run/history/open issued report → pause/resume/edit/delete, with loading/empty/error/retry/conflict/keyboard/Back/mobile and current context distinct from replay receipts. Device mode materializes due work only while open/next visit using actual local accounts/storage and no API; explain background limits. Account export/deletion includes all owned schedule data. Test actual isolated workers/API/database for DST, duplicate workers, missed times, capacity, session reset during user edits, deleted accounts/reports, deterministic exact snapshots, version/replay and privacy; browser and offline cases exercise the entire real workflow. Reserve API330–349, WEB330–349, OFFLINE360–379. Author only in isolated worktree; parent owns shared trackers, execution, integration and gated scoped commit. This child does not complete scheduled market research, external notifications or material-event policy.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REPORT-SCHEDULES-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Current acceptance review — 20 September 2026

Reviewed scope: Explicit daily or weekly v1 saved-record schedules, timezone and DST policy, immutable edits and consent, unique latest-due capture, worker, capacity and tombstone behavior, pause, resume and delete, complete paginated export and on-device next-open execution. No closed-app background guarantee or external notifications. Live source activation and physical-device release certification remain separate. Broader parent coverage is not completed.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926419995-75587.
<!-- sdlc-validation:end -->
