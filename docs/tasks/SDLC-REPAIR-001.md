# SDLC-REPAIR-001 — failure-scoped agent repair and exact-case retry

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - Implementation: Authored; user validation and gated commit pending. User explicitly requests an agent on any failing stage/test. Deterministic execution remains outside the repair agent.
- **Pending:** The implementation is recorded; user-run validation remains separate.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-REPAIR-001 — failure-scoped agent repair and exact-case retry

- **Implementation:** Authored; user validation and gated commit pending. User explicitly requests an agent on any failing stage/test. Deterministic execution remains outside the repair agent.
- **Scope / acceptance:** Stream and retain per-stage logs in ignored artifacts/sdlc; preserve format/check-before-commit and failed exit status; launch one configured local Codex CLI attempt with the exact failed stage/log; preserve completed commits and unrelated changes. Agent repairs only this failure, with no validation, commits, pushes or delegation. Parent script retries the exact failed case/project (rebuilding as a prerequisite), never the full E2E suite. Non-E2E failures retry their command. Default3 shared attempts; stop on exhaustion or missing exact report. Block recursive SDLC invocation. Respect SDLC_AUTO_REPAIR=0, preserve handoff if CLI is unavailable, and do not launch agents for argument errors or user cancellation. No new dependency, API, UI or migration.
- **Reusable Codex prompt:** Inspect scripts/sdlc.mjs and its injected-executor unit cases. Implement streaming command logs and one author-only failure handoff through the installed Codex CLI, without shell interpolation, model overrides, whole-suite retries or weakened gates. Add exact-case selection and bounded parent-controlled retry coverage. Add parser/gate/recursion/launch-failure cases. Update README, SDLC docs, catalog and status. Do not invoke tests or a real agent during authoring; the user runs the command manually.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-REPAIR-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
