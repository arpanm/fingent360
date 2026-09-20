# PUBLISHING-QUEUE-001 — Paginated publishing review queue

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - PUBLISHING-QUEUE-001 (DEV-015): Implemented; user validation and commit pending. Detailed Codex prompt: replace the Operations screen's unbounded rendering of publication heads with a complete paginated review queue over actual stored heads. Preserve the legacy items endpoint for existing clients. Add strict protected source/status/text filters and bounded cursor pages with deterministic order and clear snapshot limitations; validate unknown/repeated fields, mismatched cursors and source l
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **PUBLISHING-QUEUE-001 (DEV-015): Implemented; user validation and commit pending.** Detailed Codex prompt: replace the Operations screen's unbounded rendering of publication heads with a complete paginated review queue over actual stored heads. Preserve the legacy items endpoint for existing clients. Add strict protected source/status/text filters and bounded cursor pages with deterministic order and clear snapshot limitations; validate unknown/repeated fields, mismatched cursors and source limits. Final post-storage wall-clock operator authorization; no private data after expiry or old-session responses. Build an extracted responsive Publishing queue with loading/empty/error/retry/reset/filter/next/back states, keyboard navigation, counts without false totals, and selection into the existing exact-head SourceReview dialog. After a saved review refresh the queue without discarding the historical receipt; do not leave old selected versions actionable. Reuse existing immutable source tables; no new source data, provider calls, migration or dependency unless justified. Keep source refresh/status separate and working. Author real isolated API560–579 and browser560–579 for actual multi-page/filter/stale-head/expiry/late-response behavior, plus connected-only offline acceptance if changed. Document every layer, precise compatibility changes and manual focused validation. Work in an isolated worktree; no deterministic execution or commit by agents. Main already has uncommitted SourceReview, BEA recovery and final read-admission changes; merge carefully and never replace them wholesale.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on PUBLISHING-QUEUE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

## Current acceptance review — 20 September 2026

Reviewed scope: Protected paginated publication heads, strict filters/cursors, final operator admission, exact-head review, stale-session clearing and responsive connected-only Operations. This covers only the recorded child, not broader parents or source activation.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926953092-78982.
<!-- sdlc-validation:end -->
