# SDLC-REPAIR-002 — formatting-only retry and repair CLI discovery

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Status: Fix authored, execution validation pending; user run1789445576136-52339 stopped at format:check before lint/tests. Installed CLI responds as codex-cli 0.153.4; no repair agent, formatter, checks or tests were run. Commit remains gated on user-run format/check.
- **Pending:** The implementation is recorded; user-run validation remains separate.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-REPAIR-002 — formatting-only retry and repair CLI discovery

- **Status:** Fix authored, execution validation pending; user run1789445576136-52339 stopped at format:check before lint/tests. Installed CLI responds as codex-cli 0.153.4; no repair agent, formatter, checks or tests were run. Commit remains gated on user-run format/check.
- **Scope/spec:** Keep deterministic whitespace recovery in the user-run launcher, formatting only safely resolved warning paths and retrying the stopped check, with a bounded retry. Resolve explicit CLI override, PATH and installed macOS app binary; preserve launch error code and executable path. Never launch an LLM for whitespace-only failure or bypass commit gates.
- **Acceptance:** Authored injected tests cover safe path rejection, zero agent calls for whitespace, repeated drift stops, executable precedence/missing executable. No app/API/DB change; harness tests replace browser cases for this launcher-only fix.
- **Reusable prompt:** Fix only the reported SDLC formatting/CLI launch failures; preserve the pending feature batch. Author launcher and focused tests/docs without running formatting/checks/tests or launching a repair agent. User pnpm sdlc owns execution and gated commit.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-REPAIR-002 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
