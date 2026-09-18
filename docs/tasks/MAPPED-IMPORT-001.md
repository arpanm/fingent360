# MAPPED-IMPORT-001 — explicit mapped imports and researched platform formats

- **Status:** Partial
- **Implemented / recorded:** - Implementation: Mapped flow and five-platform export help implemented; named adapters require documented formats. User validation pending. Parents: DEV008/SRC013 remain partial. Add a user-defined CSV column mapping with explicit quantity/cost units, declared source-total reconciliation, preview and exact owned replacement receipt. Preserve provenance of mapping choices without claiming a broker dialect. User subsequently authorizes choosing platform order and researching formats using official documentation/browser; implement documented platform exports one by one, with cited field provenance and synthetic test fixtures clearly distinct from actual private exports. Do not infer holdings export formats from trading API response fields. Keep exact unresolved sample/format gates visible and continue independent work.
- **Pending:** Developer: finish the remaining acceptance criteria in this task.
- **Next action / inputs:** Developer: finish verified broker formats under BROKER-PARSERS-002; mapped import already exists.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### MAPPED-IMPORT-001 — explicit mapped imports and researched platform formats

- **Implementation: Mapped flow and five-platform export help implemented; named adapters require documented formats. User validation pending. Parents: DEV008/SRC013 remain partial.** Add a user-defined CSV column mapping with explicit quantity/cost units, declared source-total reconciliation, preview and exact owned replacement receipt. Preserve provenance of mapping choices without claiming a broker dialect. User subsequently authorizes choosing platform order and researching formats using official documentation/browser; implement documented platform exports one by one, with cited field provenance and synthetic test fixtures clearly distinct from actual private exports. Do not infer holdings export formats from trading API response fields. Keep exact unresolved sample/format gates visible and continue independent work.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on MAPPED-IMPORT-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Follow child tasks
- **User input needed now:** No for the independent next step.
- **Decision:** This is a rollup. Advance the linked incomplete children rather than duplicating their code or requesting a parent-level approval.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** If a concrete private input or external authorization becomes necessary, record the exact evidence and question before asking.
- **Next action:** Developer: finish verified broker formats under BROKER-PARSERS-002; mapped import already exists.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789719717196-80383.
<!-- sdlc-validation:end -->
