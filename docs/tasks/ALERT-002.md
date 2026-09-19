# ALERT-002 — Alert delivery controls

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - ALERT-002 (DEV-018): Persist account-owned indicator mute preferences and integrate actual inbox filtering/unmute restoration without deleting evidence or receipts. Prompt: contracts/migration008/API/UI, ownership and not-followed rejection, real inbox tests and privacy export integration. Implemented.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **ALERT-002 (DEV-018):** Persist account-owned indicator mute preferences and integrate actual inbox filtering/unmute restoration without deleting evidence or receipts. Prompt: contracts/migration008/API/UI, ownership and not-followed rejection, real inbox tests and privacy export integration. Implemented.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ALERT-002 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Reviewed scope: Account-owned original-observation indicator mute preferences, ownership and non-followed/Origin admission, actual inbox filtering, unmute restoring the identical observation and its read receipt, reload durability, privacy export, and no-network installed-bundle original inbox parity. Does not substitute material-alerts policy settings for original observation preferences.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789847379056-38783.
<!-- sdlc-validation:end -->

## Visual acceptance repair — 20 September 2026

Actual focused screenshots exposed controls under persistent navigation/feedback and colliding wrapped action buttons. Preserve all controls; reserve native focus scroll space and wrap affected action rows with gaps and a feedback lane. Existing browser cases now require focused controls to be actual visible hit targets, without forced scrolling. Shared web/Android presentation changes only; no API, contract, database or migration change. Current user authorization covers focused execution; saved post-repair visual and test evidence remains required.
