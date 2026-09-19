# REGRESSION-013 — roadmap lint gate corrections

- **Status:** Done (verified gate scope)
- **Implemented / recorded:** - Implementation: Corrections authored; user verification pending. User confirms format:check passed, then lint stopped on11 errors before typechecks, commit or E2E. Remove dead initial/reset assignments without removing rollback or post-commit state guards; retain caught provisioning failure as Error.cause while keeping CLI output redacted; replace the CSV control-character regex with equivalent character-code validation; correct the consent-worker exit branch and immutable test receipt declaration. Preserve all prior roadmap changes and the gated SDLC sequence.
- **Pending:** None for this bounded compiler, formatter or tooling repair; functional stories own their application acceptance.
- **Next action / inputs:** No pickup needed for this recorded repair.
- **Verification:** Actual format/check/unit gates passed in SDLC1789837762812-24470, gated commit4549ca1; see recorded gate acceptance below.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### REGRESSION-013 — roadmap lint gate corrections

- **Implementation: Corrections authored; user verification pending.** User confirms format:check passed, then lint stopped on11 errors before typechecks, commit or E2E. Remove dead initial/reset assignments without removing rollback or post-commit state guards; retain caught provisioning failure as Error.cause while keeping CLI output redacted; replace the CSV control-character regex with equivalent character-code validation; correct the consent-worker exit branch and immutable test receipt declaration. Preserve all prior roadmap changes and the gated SDLC sequence.
- **Reusable Codex prompt:** Inspect all11 reported sites and their enclosing control flow. Fix the lint causes without disables or weaker input/error handling. Extend CSV regression coverage for forbidden control ranges versus allowed tab/newline/CRLF. Existing real rollback/auth/provider and consent cases remain applicable. Update TODO/README/status/catalog. Do not execute format/check/tests/migrations/services or commit; user reruns the original pnpm sdlc invocation with its original filters. Report authored versus verified status and unchanged HEAD.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REGRESSION-013 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Scope: Eleven lint repairs preserving rollback/state guards, redacted Error.cause, CSV control-range validation and consent-worker exit.

User-authorized SDLC run `1789837762812-24470` completed formatting and the entire check stage successfully before connected acceptance began. The [check log](../../artifacts/sdlc/1789837762812-24470/02-pnpm-check.log) includes strict application/E2E compilation and contracts/API/tooling unit coverage; its final tooling suite reports72 passes, zero failures. Gated commit `4549ca1` records that source revision. This closes the bounded repair, not all application features or later source revisions. No fabricated E2E matrix is added for a compiler/formatting-only task.
