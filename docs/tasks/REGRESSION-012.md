# REGRESSION-012 — formatting gate after roadmap authoring

- **Status:** Done (verified gate scope)
- **Implemented / recorded:** - Implementation: Whitespace corrections authored; user rerun pending. Verification: user reports format completed, then format:check rejected four files; later gates/commit/E2E were not reached. Inspect events.ts, operator-permissions.ts and the mapped/supplemental import helpers. Preserve all behavior and existing pending changes. Correct inconsistent wrapping without ignoring files, weakening format:check, adding repeated formatter passes or changing commit ordering. The existing runner invokes format and check sequentially with the same configuration; the precise cause of the reported divergence is not established without execution.
- **Pending:** None for this bounded compiler, formatter or tooling repair; functional stories own their application acceptance.
- **Next action / inputs:** No pickup needed for this recorded repair.
- **Verification:** The complete check at SDLC1789852776002-50046 passed at a9e4f43; this closes the recorded formatter/compiler/unit repair only. Product acceptance is separate.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### REGRESSION-012 — formatting gate after roadmap authoring

- **Implementation: Whitespace corrections authored; user rerun pending. Verification: user reports format completed, then format:check rejected four files; later gates/commit/E2E were not reached.** Inspect events.ts, operator-permissions.ts and the mapped/supplemental import helpers. Preserve all behavior and existing pending changes. Correct inconsistent wrapping without ignoring files, weakening format:check, adding repeated formatter passes or changing commit ordering. The existing runner invokes format and check sequentially with the same configuration; the precise cause of the reported divergence is not established without execution.
- **Reusable Codex prompt:** Read the user log, runner/configuration and four reported files. Author only the necessary formatting correction, update TODO/README/status and manual acceptance. No new API/browser test is needed for whitespace-only changes; existing event, named-role and import cases retain their behavior. User reruns the same pnpm sdlc command and original filters; agents do not run formatting/checks/tests or commit. Expected: format:check clears these warnings, remaining gates still apply, and any failure prevents staging/commit. Historical latest.md is the September14 08:28 UTC E2E run, not evidence for this pre-test failure.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REGRESSION-012 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

## Recorded gate acceptance — 20 September 2026

Scope: Whitespace corrections in events, operator permissions and mapped/supplemental import helpers.

User-authorized SDLC run `1789837762812-24470` completed formatting and the entire check stage successfully before connected acceptance began. The [check log](../../artifacts/sdlc/1789837762812-24470/02-pnpm-check.log) includes strict application/E2E compilation and contracts/API/tooling unit coverage; its final tooling suite reports72 passes, zero failures. Gated commit `4549ca1` records that source revision. This closes the bounded repair, not all application features or later source revisions. No fabricated E2E matrix is added for a compiler/formatting-only task.
