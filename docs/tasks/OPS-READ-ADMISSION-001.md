# OPS-READ-ADMISSION-001 — Protect Operations reads

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - OPS-READ-ADMISSION-001 (DEV-017/021): Implemented; verification and commit await user-run SDLC. Detailed Codex prompt: inspect all existing protected Operations read paths for authentication performed only before potentially waiting storage queries. Bound this child to legacy discovery items/runs and source registry list/history, plus directly related protected read paths only if evidence identifies the same defect. Specify read→storage wait→session expiry/revocation→denial and preserved o
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **OPS-READ-ADMISSION-001 (DEV-017/021): Implemented; verification and commit await user-run SDLC.** Detailed Codex prompt: inspect all existing protected Operations read paths for authentication performed only before potentially waiting storage queries. Bound this child to legacy discovery items/runs and source registry list/history, plus directly related protected read paths only if evidence identifies the same defect. Specify read→storage wait→session expiry/revocation→denial and preserved original data. Add explicit post-storage wall-clock authorization before protected output, preserving source/publication locks and source-withdrawal policies; do not fetch providers, add identities/roles, broaden rights, mutate stored data or introduce a dataset/migration/dependency without justification. Reuse the existing operator UI and shared generation/request barrier: new UI is unnecessary unless recovery currently fails; ensure expired read clears protected content and presents sign-in, late old200 cannot restore it, and a newly authenticated session remains valid. Read source comparison/BEA pending integration interfaces and do not replace their code; focus changes on legacy list/history store methods/controllers. Author a product specification, meaningful actual isolated PostgreSQL storage-lock expiry/revocation API tests, browser recovery cases across Publishing/Source registry, and packaged device connected-only/noAPI acceptance. Stable ranges API520–539, WEB520–539, OFFLINE530–549. Existing data/ownership and public GET behavior must remain unchanged. Include explicit all-layer delivery matrix (existing UI/workflow/data reuse where appropriate), docs/handoff with exact manifest and limitations. No author execution, builds, dependencies, migrations, providers, main edits or commits; parent integrates, runs authorized gates/tests, updates README/TODO/catalog/coverage/status and makes a scoped local commit. No push. Broader roles, production and hardware acceptance remain separate.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on OPS-READ-ADMISSION-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Reviewed scope: Final wall-clock operator admission after legacy discovery items/runs and registry list/history storage waits; protected-content clearing, late-success barrier, recovered session and connected-only local behavior. Reuses existing UI/storage; no broader roles/source-rights/provider activation. Completion applies only to this bounded child.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789847379056-38783.
<!-- sdlc-validation:end -->
