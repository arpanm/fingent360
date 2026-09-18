# LEGACY-FIXTURE-ISOLATION-001 — Isolate legacy test data

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - LEGACY-FIXTURE-ISOLATION-001 (DEV-021): Implemented for API070/WEB070/WEB181; verification and commit await user-run SDLC. Detailed Codex prompt: audit legacy tests importing the global Playwright fixture for mutations to configured normal application data. At minimum move stable API070/WEB070 source-registry and WEB181 glossary operations to the existing actual isolated PostgreSQL/MongoDB/API fixture; include related source-registry cases and provider-triggering tests only where needed to
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **LEGACY-FIXTURE-ISOLATION-001 (DEV-021): Implemented for API070/WEB070/WEB181; verification and commit await user-run SDLC.** Detailed Codex prompt: audit legacy tests importing the global Playwright fixture for mutations to configured normal application data. At minimum move stable API070/WEB070 source-registry and WEB181 glossary operations to the existing actual isolated PostgreSQL/MongoDB/API fixture; include related source-registry cases and provider-triggering tests only where needed to preserve safe full-suite behavior. Preserve meaningful successful API/UI/history/publication assertions; never replace successful stores with mocked responses or skip cases to pass. Extend fixture interception to the exact required public/protected source paths, preserving app route origins and authenticated sessions; lazy setup only, no discovery/import effects. Provider refresh fixtures must use captured permitted source evidence/explicit synthetic faults through actual isolated ingestion, or remain honestly labelled separately gated real-provider checks; never run providers during authoring. Tests must clean up only their owned schema/database/accounts and prove unchanged configured normal records; no test may delete global sources as cleanup. Write a bounded specification/handoff, preserve stable IDs, add regression IDs API540–559/WEB540–559 only when a missing ownership/teardown behavior needs coverage. Shared test runner UI/API/app schema is reused; no new product UI/database/dependency needed. No author tests/builds/install/service/provider/main edits/commit; parent reviews integration, runs authorized gates/full regression, updates README/TODO/catalog/coverage/status and commits locally without push. Communicate fixture route changes with OPS-READ-ADMISSION author; keep their source behavior changes independent.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on LEGACY-FIXTURE-ISOLATION-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789719717196-80383.
<!-- sdlc-validation:end -->
