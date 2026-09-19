# MATERIAL-AUTO-001 — opt-in durable stored-observation checks

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - Implementation: Implemented; user validation pending. Parents: DEV011/018 retain release-calendar and wider evidence-pipeline scope; extends MATERIAL-ALERTS-001. Complete automatic checking of already stored annual observations with an explicit opt-in, visible cadence and dated receipts. Never imply provider refresh, release calendar knowledge, email/push or investment advice. Existing manual checks and thresholds remain. Default existing accounts to manual; enable/resume starts a fresh baseline without backlog. Persist due state and perform bounded account-serialized checks that survive process restart and avoid duplicate notices across API instances; pause/disable/unfollow takes effect against the same account lock. Use the shared exact material reducer and public-source freshness policy, with actual receipt provenance distinguishing automatic versus manual checks. Do not silently turn a storage checkbox into background-use permission. Provide responsive settings/review/disable/loading/error/retry UI and current next-check/last-result information. Offline performs only due checks while the app is open using its dated installed bundle, no background OS/network promise. Include private export/delete and meaningful actual database concurrency/restart/no-duplicate plus browser/offline cases. Design against existing material state/receipt structures; reserve migration044 only if needed and API/WEB/OFFLINE790–809. User runs all deterministic gates, migrations/services and the conditional commit via pnpm sdlc; agents only author and review.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### MATERIAL-AUTO-001 — opt-in durable stored-observation checks

- **Implementation: Implemented; user validation pending. Parents: DEV011/018 retain release-calendar and wider evidence-pipeline scope; extends MATERIAL-ALERTS-001.** Complete automatic checking of already stored annual observations with an explicit opt-in, visible cadence and dated receipts. Never imply provider refresh, release calendar knowledge, email/push or investment advice. Existing manual checks and thresholds remain. Default existing accounts to manual; enable/resume starts a fresh baseline without backlog. Persist due state and perform bounded account-serialized checks that survive process restart and avoid duplicate notices across API instances; pause/disable/unfollow takes effect against the same account lock. Use the shared exact material reducer and public-source freshness policy, with actual receipt provenance distinguishing automatic versus manual checks. Do not silently turn a storage checkbox into background-use permission. Provide responsive settings/review/disable/loading/error/retry UI and current next-check/last-result information. Offline performs only due checks while the app is open using its dated installed bundle, no background OS/network promise. Include private export/delete and meaningful actual database concurrency/restart/no-duplicate plus browser/offline cases. Design against existing material state/receipt structures; reserve migration044 only if needed and API/WEB/OFFLINE790–809. User runs all deterministic gates, migrations/services and the conditional commit via pnpm sdlc; agents only author and review.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on MATERIAL-AUTO-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Reviewed scope: Explicit background-purpose opt-in and future-baseline cadence over stored annual observations, bounded concurrent worker/restart/failure isolation, immutable dated receipts and local checks while app open. No provider refresh, release predictions, OS scheduling, external notifications or advice. Completion applies only to this bounded child.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Blocked — workflow failure. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789846657524-36112.
<!-- sdlc-validation:end -->
