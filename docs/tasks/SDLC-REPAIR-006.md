# SDLC-REPAIR-006 — event scenario callback type narrowing

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Authored: captured and narrowed a local constant model, preserving all golden and rejection assertions; extended the case to confirm negative variants leave the original comparison unchanged.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-REPAIR-006 — event scenario callback type narrowing

- **Context/scope:** Supplied `pnpm check` exits 2 at E2E typechecking: OFFLINE1021 accesses numeric-only observed/reference fields through a mutable union property inside assertion callbacks. Repair only this test and its documentation; preserve unrelated pending work and completed commits.
- **Implementation:** Authored: captured and narrowed a local constant model, preserving all golden and rejection assertions; extended the case to confirm negative variants leave the original comparison unchanged.
- **Verification:** Pending parent/user retry. No validation, services, commits or delegation authorized or performed. Supplied output reports preceding gates passed for that earlier revision only; no whole-suite report inspected.
- **Dependencies/layers:** Existing contracts and synthetic fixture reused; no dependency changes. Specification/test acceptance: callbacks compile without casts or suppression, invalid numeric tokens and same-release expectations still reject, original prior comparison remains intact. Product UI/UX, API/contracts, workflow, database, provenance and automation changes are not applicable to this test-only narrowing repair.
- **Acceptance:** `pnpm e2e:typecheck` exits 0; E2E-OFFLINE-1021 under @EVENT-SCENARIOS-001 retains all family, regulatory, no-reference and hypothetical assertions plus fixture-preservation coverage. Parent retries exact `pnpm check`. No services or UI URL needed for typechecking. On failure report command, exit status and compiler diagnostics.
- **Reusable prompt:** Repair only the supplied event-scenarios.spec.ts callback union errors using a stable narrowed model binding. Preserve strict schemas and all real calculation assertions; extend existing regression coverage without mocks, casts, skips or weaker validation. Update TODO, README and relevant scenario/test documentation. Author and inspect only; do not execute checks, tests, SDLC, commits or delegate.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-REPAIR-006 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
