# SDLC-AFFECTED-001 — deterministic impacted E2E selection

- **Status:** Done (verified gate scope)
- **Implemented / recorded:** Conservative changed-file/layer selection, baseline/preview, unknown fallback and rebuilt offline selections.
- **Pending:** No remaining implemented selector acceptance. It is not semantic dependency proof or a way to carry old source fingerprints forward.
- **Next action / inputs:** No new run is required for this bounded historical scope. Follow the named child/source gates for broader delivery.
- **Verification:** Saved artifacts/sdlc/1789852776002-50046/02-pnpm-check.log records successful format validation, lint, application/E2E typechecks, builds and unit suites; final tooling summary is 72 passed, zero failed. Stage05 records gated commit a9e4f43. Full E2E completion is not inferred from those gates. Log lines1021–1028; tests/unit/sdlc-impact.test.mjs and scripts/sdlc-impact.mjs. Reviewed README option/reference alignment. Unit cases preserve selection after gated commit and exact escaped file filters.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-AFFECTED-001 — deterministic impacted E2E selection

- **Implementation:** Authored; verification pending. Added conservative layer/file selection, explicit baseline and preview. No formatter/check/build/tests/commit executed. Feature-level backend dependency selection remains a documented limitation; shared/unknown changes run full coverage. User requests an option selecting tests affected by current changes rather than always executing all E2E.
- **Spec/dependencies:** Add `--affected`, optional `--base <git-ref>` and read-only `--affected-plan`. Capture baseline before format/check/commit; include staged, unstaged, untracked and deleted paths, including repairs. Conservative layer selection: individual changed specs, browser/offline for shared web, full fallback for shared/unknown code. Keep all existing checks/unit tests and gated commit. No LLM used for selection.
- **Acceptance:** Preview shows reasons, changed paths and exact selections without tests/commit. Empty/unknown impact never silently passes; documentation-only skips E2E explicitly. Offline selections rebuild packaged web before offline tests; do not claim native APK validation. Author injected unit cases for CLI conflicts, baselines, deleted paths, selections and commit ordering; document manual acceptance in catalogue/coverage plan. No product UI/API/DB change is needed for this CLI feature.
- **Reusable prompt:** Implement deterministic conservative E2E impact selection in the user-operated SDLC launcher with explicit baseline and preview, preserving full check gates, failure-scoped repairs and unrelated working changes. Author tests/docs without running deterministic commands. Record limitations and user-run commands.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-AFFECTED-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

## Bounded evidence reconciliation — 20 September 2026

Conservative changed-file/layer selection, baseline/preview, unknown fallback and rebuilt offline selections.

Saved artifacts/sdlc/1789852776002-50046/02-pnpm-check.log records successful format validation, lint, application/E2E typechecks, builds and unit suites; final tooling summary is 72 passed, zero failed. Stage05 records gated commit a9e4f43. Full E2E completion is not inferred from those gates. Log lines1021–1028; tests/unit/sdlc-impact.test.mjs and scripts/sdlc-impact.mjs. Reviewed README option/reference alignment. Unit cases preserve selection after gated commit and exact escaped file filters.

No remaining implemented selector acceptance. It is not semantic dependency proof or a way to carry old source fingerprints forward. This scope does not require an invented API/browser acceptance matrix. Existing generated functional validation, if present, remains verbatim and refers only to its explicit matrix. Historical authored/unrun statements below describe their original dates.
