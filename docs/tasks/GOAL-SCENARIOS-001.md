# GOAL-SCENARIOS-001 — Compare contribution and goal-date scenarios

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - GOAL-SCENARIOS-001 (DEV-009/019): Implemented and integration verified. Compare a saved goal with up to three explicit contribution/horizon alternatives without assumptions about investment returns. Dependencies: existing owned goals, ALLOCATIONS-001, privacy and local persistence. Detailed Codex prompt: specify baseline and alternative lifecycle before code; introduce strict exact-integer-paise, month and version contracts, additive migration025 for owned immutable comparison receipts and
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **GOAL-SCENARIOS-001 (DEV-009/019): Implemented and integration verified.** Compare a saved goal with up to three explicit contribution/horizon alternatives without assumptions about investment returns. Dependencies: existing owned goals, ALLOCATIONS-001, privacy and local persistence. Detailed Codex prompt: specify baseline and alternative lifecycle before code; introduce strict exact-integer-paise, month and version contracts, additive migration025 for owned immutable comparison receipts and idempotent adoption records. Capture an actual saved goal edition; retain unchanged baseline plus up to three user-entered monthly contribution/horizon alternatives, calculate exact contribution-only projected amounts/gaps with no growth or market values. Provide Goals → Compare plans → visible editable assumptions → compare with unchanged plan → save/reopen/history → explicit review/adopt alternative. Saving a comparison never mutates the goal. Adoption must check current goal ownership/version, use the normal immutable goal revision and allocation-review semantics, lock/recheck authorization after waits, and persist a same-request idempotent result; stale/deleted goals require visible recovery, and historical adoption receipts must not be presented as current after a failed refresh. Implement loading/empty/validation/error/retry/cancel/saved states, keyboard/Back/mobile, confirmation and exact persistence. Integrate private export/account deletion and the actual on-device equivalent with no network; no raw provider inputs, prices, recommendations or synthetic application defaults. Add actual isolated API/database and desktop/mobile/offline cases for exact extremes, baseline reconstruction, unchanged-plan comparison, concurrency/replay/foreign/stale/deleted targets, preservation of unrelated records, adoption and privacy. Reserve API280–289, WEB280–289, OFFLINE320–329. Agent owns feature spec/code/cases/handoff in isolated worktree; parent owns shared TODO/README/status/catalogue/matrix, installation/migration/execution and gated scoped commit. No automatic push. Wider suitability/return/tax/regulated recommendation gates remain open.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on GOAL-SCENARIOS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Current acceptance review — 20 September 2026

Reviewed scope: Saved-goal baseline plus up to three explicit contribution and horizon alternatives, exact no-growth comparisons, immutable receipts, explicit version-checked adoption, stale, replay and session recovery, unchanged unrelated finances, export, deletion and offline parity. Live source activation and physical-device release certification remain separate. Broader parent coverage is not completed.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926419995-75587.
<!-- sdlc-validation:end -->
