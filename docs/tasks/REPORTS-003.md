# REPORTS-003 — Saved report comparisons and lifecycle

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - REPORTS-003 (DEV-011/016/021): Implemented and integration verified. Extend saved record reports with explicitly selected owned research connections. Dependencies: REPORTS-001/002, EVIDENCE-LINKS-001 and privacy. Detailed Codex prompt: inspect immutable v1 reports and the authored connection schema/workflow; specify opt-in selection and versioned v2 snapshots without rewriting any v1 record. Capture selected owned connection editions, personal reasons, minimal source receipts and review fl
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **REPORTS-003 (DEV-011/016/021): Implemented and integration verified.** Extend saved record reports with explicitly selected owned research connections. Dependencies: REPORTS-001/002, EVIDENCE-LINKS-001 and privacy. Detailed Codex prompt: inspect immutable v1 reports and the authored connection schema/workflow; specify opt-in selection and versioned v2 snapshots without rewriting any v1 record. Capture selected owned connection editions, personal reasons, minimal source receipts and review flags under consistent account/source locks; never invent impact/price/exposure links or include withdrawn source text. Keep current goals/holdings/allocation arithmetic unchanged. Implement select/review/request/status/open/JSON/print, clear immutable-issued-time context versus current-source availability, loading/empty/error/cancel/retry, mobile/keyboard/Back. Reuse worker leases/idempotency/capacity/new-request limits and individual report deletion/tombstone/late-worker fences; support old requests/reports/history/export untouched. Same request ID plus different connection selection conflicts; retries reconstruct the captured edition. Add additive migration026 only if required; no mutable historical report rewrites. Local mode captures actual packaged evidence/owned connections with no network and preserves reload, deletion and privacy. Test real isolated APIs/database for ownership, changed/withdrawn sources during capture/issue, exact v1/v2 reconstruction, stable request replay and altered-payload rejection, late worker/cancel/delete, private export/account cascade. Browser cases cover opt-in selection, readable report/print, navigation and desktop/mobile; packaged cases prove persistence and zero network. Reserve API290–299, WEB290–299, OFFLINE330–339. Agent authors its spec/code/cases/handoff in isolated worktree and reads frozen sibling connection implementation as dependency; root integrates that prerequisite first, merges shared files, runs gates and creates a scoped local commit. No provider calls, advice, pushes or deterministic agent execution.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REPORTS-003 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Current acceptance review — 20 September 2026

Reviewed scope: Explicitly selected owned research-connection editions in immutable v2 saved reports, preserving v1 and exact financial arithmetic; minimal dated source receipts and personal reasons, opt-in review, issuance and worker retry, JSON and print, ownership and stale-source admission, replay, cancellation, deletion and late-worker fences, privacy lifecycle and no-network offline persistence. Historical captures never imply current source availability. Physical-device release certification and wider parent requirements remain separate.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789927529684-81206.
<!-- sdlc-validation:end -->
