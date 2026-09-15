# SDLC-REPAIR-003 — Feedback inbox nullable selection

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - Implementation: Authored; scoped repair of user-reported pnpm check TS18047 at FeedbackInbox.tsx:114/118.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-REPAIR-003 — Feedback inbox nullable selection

- **Implementation:** Authored; scoped repair of user-reported `pnpm check` TS18047 at FeedbackInbox.tsx:114/118.
- **Verification:** Pending parent/user execution; no checks or tests run by the repair agent.
- **Scope/dependencies:** Existing feedback list context and E2E-WEB-195 real feedback sandbox. List cards must use their own item context before selection, during review and after closing; the detail dialog keeps its guarded selected report. No API/contracts, database, provenance or automation change is needed.
- **Acceptance:** Web typecheck accepts nullable selection without assertions or weakened validation; populated inbox remains usable with no selected report; per-card trace availability matches that card's context; close/reopen preserves the same receipt and saved status. Existing keyboard/mobile/browser projects apply; visual acceptance remains manual.
- **Reusable prompt:** Repair only the supplied FeedbackInbox nullable-report compiler failure. Inspect list and selected-detail data ownership, use each list item's validated context, extend E2E-WEB-195 through initial render and close/reopen, and update README/catalogue/coverage/status. Preserve unrelated changes and commits. Author only; do not run gates, services, tests, commit or delegate. Return `pnpm check` for the parent/user retry.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-REPAIR-003 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
