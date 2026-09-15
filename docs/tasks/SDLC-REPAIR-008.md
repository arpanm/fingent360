# SDLC-REPAIR-008 — media reservation fixture and evaluation recording

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - Implementation: Authored the missing pool query surface and explicit recording-order, source-binding, completion and immutable-replay assertions in the existing durable reservation case.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-REPAIR-008 — media reservation fixture and evaluation recording

- **Context/scope:** Supplied `pnpm check` failed at media.test.mjs:175 with a missing concurrent-request rejection. The existing pool fixture lacks the pool-level query method now required by evaluation recording, causing an immediate template fallback before the second request. Repair this fixture only; retain production paths and all assertions.
- **Implementation:** Authored the missing pool query surface and explicit recording-order, source-binding, completion and immutable-replay assertions in the existing durable reservation case.
- **Verification:** Pending parent/user retry; no commands for validation, services, commits or delegation executed. No suite report inspected.
- **Dependencies/layers:** Existing synthetic media fixture and compiled API; no dependency changes. Test specification/workflow and documentation apply. Production UI/UX, contracts, database schema, provenance policy and automation remain unchanged; new browser/API E2E cases are not applicable to this unit-fixture defect.
- **Acceptance:** Concurrent generation still rejects with409, exactly one provider call occurs, its evaluation reservation precedes invocation, raw and selected output are retained under the same call ID, and replay reuses the immutable asset without another evaluation call. See docs/development/media-reservation-repair.md for the focused command and failure evidence.
- **Reusable prompt:** Repair only the supplied durable media reservation unit failure by tracing the real recording/provider path and updating the existing synthetic pool fixture to its required interface. Preserve rejection and provider-count assertions; add recording lifecycle and replay regression coverage. Update TODO/README and relevant documentation. Author/read only; do not execute validation, commit, delegate or expand scope.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-REPAIR-008 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
