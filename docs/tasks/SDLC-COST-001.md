# SDLC-COST-001 — keep deterministic validation user-operated and scoped

- **Status:** Done (verified gate scope)
- **Implemented / recorded:** Explicit checks-only mode preserves format/check/gated commit and refuses E2E/filter conflicts.
- **Pending:** No remaining launcher-option acceptance; application E2E remains separately selected.
- **Next action / inputs:** No new run is required for this bounded historical scope. Follow the named child/source gates for broader delivery.
- **Verification:** Saved artifacts/sdlc/1789852776002-50046/02-pnpm-check.log records successful format validation, lint, application/E2E typechecks, builds and unit suites; final tooling summary is 72 passed, zero failed. Stage05 records gated commit a9e4f43. Full E2E completion is not inferred from those gates. Log lines1059–1060; tests/unit/sdlc.test.mjs:315–367 explicitly checks gate order, no E2E/push, contradictory filters and failed-check stop.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-COST-001 — keep deterministic validation user-operated and scoped

- **Implementation:** Authored; validation and commit pending user-run gates. The user reinstated the manual execution boundary after the expensive full run. No agent-driven checks/tests/builds/commits for this optimization.
- **Acceptance:** Existing full SDLC and selected-filter semantics remain unchanged. Explicit `--checks-only` performs format/check and gated commit, never E2E or push, rejects contradictory test filters and clearly states no fresh E2E evidence. Regression cases cover parsing, gate failure and commit ordering.
- **Reusable Codex prompt:** Read the saved REGRESSION-015 run timings. Preserve full manual validation but author an explicit checks-only option; document affected-case handoffs and E2E-only reruns to avoid repeating gates when code is unchanged. Keep test isolation and assertions; do not raise concurrency or remove coverage without measured evidence. Update tests, README, SDLC docs and status; leave execution to the user.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-COST-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Explicit checks-only mode preserves format/check/gated commit and refuses E2E/filter conflicts.

Saved artifacts/sdlc/1789852776002-50046/02-pnpm-check.log records successful format validation, lint, application/E2E typechecks, builds and unit suites; final tooling summary is 72 passed, zero failed. Stage05 records gated commit a9e4f43. Full E2E completion is not inferred from those gates. Log lines1059–1060; tests/unit/sdlc.test.mjs:315–367 explicitly checks gate order, no E2E/push, contradictory filters and failed-check stop.

No remaining launcher-option acceptance; application E2E remains separately selected. This scope does not require an invented API/browser acceptance matrix. Existing generated functional validation, if present, remains verbatim and refers only to its explicit matrix. Historical authored/unrun statements below describe their original dates.
