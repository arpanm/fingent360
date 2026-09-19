# TEAM-008 — complete protected read admission

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - LEGACY-FIXTURE-ISOLATION-001 (DEV-021): Implemented for API070/WEB070/WEB181; verification and commit await user-run SDLC. Detailed Codex prompt: audit legacy tests importing the global Playwright fixture for mutations to configured normal application data. At minimum move stable API070/WEB070 source-registry and WEB181 glossary operations to the existing actual isolated PostgreSQL/MongoDB/API fixture; include related source-registry cases and provider-triggering tests only where needed to
- **Pending:** Protected-read and fixture-isolation child cases await their recorded validation.
- **Next action / inputs:** OPS-READ-ADMISSION-001 passes; retain LEGACY-FIXTURE-ISOLATION-001 normal-data and cleanup acceptance.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### TEAM-008 — complete protected read admission

- **LEGACY-FIXTURE-ISOLATION-001 (DEV-021): Implemented for API070/WEB070/WEB181; verification and commit await user-run SDLC.** Detailed Codex prompt: audit legacy tests importing the global Playwright fixture for mutations to configured normal application data. At minimum move stable API070/WEB070 source-registry and WEB181 glossary operations to the existing actual isolated PostgreSQL/MongoDB/API fixture; include related source-registry cases and provider-triggering tests only where needed to preserve safe full-suite behavior. Preserve meaningful successful API/UI/history/publication assertions; never replace successful stores with mocked responses or skip cases to pass. Extend fixture interception to the exact required public/protected source paths, preserving app route origins and authenticated sessions; lazy setup only, no discovery/import effects. Provider refresh fixtures must use captured permitted source evidence/explicit synthetic faults through actual isolated ingestion, or remain honestly labelled separately gated real-provider checks; never run providers during authoring. Tests must clean up only their owned schema/database/accounts and prove unchanged configured normal records; no test may delete global sources as cleanup. Write a bounded specification/handoff, preserve stable IDs, add regression IDs API540–559/WEB540–559 only when a missing ownership/teardown behavior needs coverage. Shared test runner UI/API/app schema is reused; no new product UI/database/dependency needed. No author tests/builds/install/service/provider/main edits/commit; parent reviews integration, runs authorized gates/full regression, updates README/TODO/catalog/coverage/status and commits locally without push. Communicate fixture route changes with OPS-READ-ADMISSION author; keep their source behavior changes independent.

- **OPS-READ-ADMISSION-001 (DEV-017/021): Implemented; verification and commit await user-run SDLC.** Detailed Codex prompt: inspect all existing protected Operations read paths for authentication performed only before potentially waiting storage queries. Bound this child to legacy discovery items/runs and source registry list/history, plus directly related protected read paths only if evidence identifies the same defect. Specify read→storage wait→session expiry/revocation→denial and preserved original data. Add explicit post-storage wall-clock authorization before protected output, preserving source/publication locks and source-withdrawal policies; do not fetch providers, add identities/roles, broaden rights, mutate stored data or introduce a dataset/migration/dependency without justification. Reuse the existing operator UI and shared generation/request barrier: new UI is unnecessary unless recovery currently fails; ensure expired read clears protected content and presents sign-in, late old200 cannot restore it, and a newly authenticated session remains valid. Read source comparison/BEA pending integration interfaces and do not replace their code; focus changes on legacy list/history store methods/controllers. Author a product specification, meaningful actual isolated PostgreSQL storage-lock expiry/revocation API tests, browser recovery cases across Publishing/Source registry, and packaged device connected-only/noAPI acceptance. Stable ranges API520–539, WEB520–539, OFFLINE530–549. Existing data/ownership and public GET behavior must remain unchanged. Include explicit all-layer delivery matrix (existing UI/workflow/data reuse where appropriate), docs/handoff with exact manifest and limitations. No author execution, builds, dependencies, migrations, providers, main edits or commits; parent integrates, runs authorized gates/tests, updates README/TODO/catalog/coverage/status and makes a scoped local commit. No push. Broader roles, production and hardware acceptance remain separate.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on TEAM-008 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Follow child tasks
- **User input needed now:** No for the independent next step.
- **Decision:** This is a rollup. Advance the linked incomplete children rather than duplicating their code or requesting a parent-level approval.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** If a concrete private input or external authorization becomes necessary, record the exact evidence and question before asking.
- **Next action:** User: validate OPS-READ-ADMISSION-001 and LEGACY-FIXTURE-ISOLATION-001.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.
