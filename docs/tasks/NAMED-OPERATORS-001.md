# NAMED-OPERATORS-001 — identities, permissions and independent publication approval

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented; user validation pending. Parents: DEV015/017 retain broader gaps. Explicit named authentication mode with hashed personal operator credentials, role/session version admission, disable/revoke, default-deny server permissions on all operations and legacy protected mutation paths, and two distinct named identities for material publication/source-rights/media decisions. Preserve bootstrap local mode explicitly until named mode is configured. No shared-key bypass under named mode. Version-bound immutable proposals/receipts commit with their approved action, stale-head conflict and self-approval rejection even across two sessions. Add safe user-invoked first-admin setup, migration038, roster/review UI, actual role/lock/replay cases and documentation. Code must enforce controls, not merely hide UI. No agent provisioning or service/test execution.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### NAMED-OPERATORS-001 — identities, permissions and independent publication approval

- **Implementation: Implemented; user validation pending. Parents: DEV015/017 retain broader gaps.** Explicit named authentication mode with hashed personal operator credentials, role/session version admission, disable/revoke, default-deny server permissions on all operations and legacy protected mutation paths, and two distinct named identities for material publication/source-rights/media decisions. Preserve bootstrap local mode explicitly until named mode is configured. No shared-key bypass under named mode. Version-bound immutable proposals/receipts commit with their approved action, stale-head conflict and self-approval rejection even across two sessions. Add safe user-invoked first-admin setup, migration038, roster/review UI, actual role/lock/replay cases and documentation. Code must enforce controls, not merely hide UI. No agent provisioning or service/test execution.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on NAMED-OPERATORS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789711405725-75316.
<!-- sdlc-validation:end -->
