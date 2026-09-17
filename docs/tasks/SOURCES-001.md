# SOURCES-001 — Manage source ingestion and review

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - SOURCES-001 (DEV-005/015/016): Persist operator-managed source metadata, rights review status and revision history with public approved metadata. Prompt: strict contracts → migration 007 → authorized API → public/operator UI → regression tests and docs. No fetching arbitrary URLs or invented rights approval. Implemented.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **SOURCES-001 (DEV-005/015/016):** Persist operator-managed source metadata, rights review status and revision history with public approved metadata. Prompt: strict contracts → migration 007 → authorized API → public/operator UI → regression tests and docs. No fetching arbitrary URLs or invented rights approval. Implemented.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SOURCES-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789667338688-55776.
<!-- sdlc-validation:end -->
