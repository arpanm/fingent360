# GOAL-FEASIBILITY-001 — saved downside-capacity assessments

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented; user validation pending. Parent: DEV009. Complete explicit affordability/interruption/protected-reserve assessment of an actual owned saved goal, with exact no-growth baseline and stressed totals, unknown inputs, immutable goal-version receipt, retry/conflict handling, removal without replay resurrection, account export/deletion, offline parity and mobile/keyboard cases. Use migration037. Do not infer expected market returns, probabilities, subjective suitability or regulated advice. Detailed implementation and acceptance are in the feature specification/handoff; user owns migrations/gates.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### GOAL-FEASIBILITY-001 — saved downside-capacity assessments

- **Implementation: Implemented; user validation pending. Parent: DEV009.** Complete explicit affordability/interruption/protected-reserve assessment of an actual owned saved goal, with exact no-growth baseline and stressed totals, unknown inputs, immutable goal-version receipt, retry/conflict handling, removal without replay resurrection, account export/deletion, offline parity and mobile/keyboard cases. Use migration037. Do not infer expected market returns, probabilities, subjective suitability or regulated advice. Detailed implementation and acceptance are in the feature specification/handoff; user owns migrations/gates.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on GOAL-FEASIBILITY-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

## Saved full-inventory repair — 2026-09-19

The saved full run1789752953639-97020 includes failed cases tagged to this task. Confirmed causes, scoped authored repairs and remaining verification are recorded in [the full-audit RCA](../development/full-audit-2026-09-19.md). User runs `SDLC_AUTO_REPAIR=0 pnpm sdlc "Repair full audit failures" --story SDLC-REPAIR-016`. No new passing evidence or automatic bug resolution is claimed; this bounded repair does not remove broader source/device/functional requirements recorded above.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789836377279-19314.
<!-- sdlc-validation:end -->
