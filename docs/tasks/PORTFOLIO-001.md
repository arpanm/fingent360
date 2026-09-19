# PORTFOLIO-001 — Manage portfolio holdings

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - PORTFOLIO-001 (DEV-007/008): Account-owned, user-entered Indian-equity holdings with exact quantities/cost basis and strict CSV preview/confirmation, independent of fictional virtual exercise. Prompt: contracts/migration009/API/UI, revision conflicts, validation/isolation/persistence tests and privacy export. No live valuations or verified-source claims. Implemented.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** User: run `SDLC_AUTO_REPAIR=0 pnpm sdlc "Complete PORTFOLIO-001" --story PORTFOLIO-001`. Complete current-revision passing evidence now permits automatic Done for the reviewed scope.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **PORTFOLIO-001 (DEV-007/008):** Account-owned, user-entered Indian-equity holdings with exact quantities/cost basis and strict CSV preview/confirmation, independent of fictional virtual exercise. Prompt: contracts/migration009/API/UI, revision conflicts, validation/isolation/persistence tests and privacy export. No live valuations or verified-source claims. Implemented.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on PORTFOLIO-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Selected cases passed — acceptance matrix needed. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789752953639-97020.
<!-- sdlc-validation:end -->

## Main functional module closure — 2026-09-19

Review the implemented manual/standard-CSV portfolio workflow end to end. Existing connected cases cover exact accounting, ownership, consent, preview/confirmation, replay/conflict, history/export and removal. Existing offline cases use actual handlers but do not exercise the full guided manual-entry UI. Add that missing offline UI acceptance using the shared app and real local storage, then define the complete case/project matrix and conditional completion metadata. No runtime or DB change is justified by an unrun status alone; broker-specific parsers and market valuations remain their own requirements. Completion requires the current gates and all matrix cases, never a manual status promotion.

Latest user clarification: “I m not sure I ran whatever command you shared... it started yesterday nicght”. The latest available artifacts remain the September18 full inventory; no newer retry result is assumed. User execution remains required.

## Reviewed completion definition — 2026-09-19

Owned user-entered Indian-equity holdings: manual and standard CSV preview/consent, exact quantities and acquisition costs, encrypted connected records, guarded replacement/replay, history/export, account isolation/deletion, guided shared offline UI and durable local storage. Named broker formats and market valuation remain separate tasks; physical APK certification remains under Android/device acceptance.

The reviewed case/project requirements and conditional completion metadata are now in `docs/tasks/acceptance.json`. [Layer review, coverage and manual commands](../development/main-module-closure-2026-09-19.md). This is not a test pass: generated validation blocks and bug states are preserved. No runtime/API/database rewrite is justified for an already implemented workflow solely because its acceptance mapping was missing. The new portfolio guided offline UI case closes a coverage gap; existing connected/private/offline cases are reused.
