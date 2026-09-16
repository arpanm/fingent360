# ALERT-001 — Personal observation inbox and revision acknowledgments

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### ALERT-001 — Personal observation inbox and revision acknowledgments

- **Implementation:** Implemented
- **Verification:** Not run.
- **Scope:** An authenticated user's followed real indicators produce an in-app latest-observation inbox. Read receipts bind to exact observation IDs; a later revision remains unread. No email/push, invented materiality threshold or investment action.
- **Acceptance:** Real source values flow into personal inbox, acknowledgment persists across reload/login, another account retains independent read state, non-followed observations cannot be acknowledged, stale-source state and corrections are explicit.
- **Codex prompt:** Extend ACCOUNT-001/DATA-001 with strict inbox contracts, additive read-receipt storage, ownership-scoped GET and Origin-protected acknowledgment API, actionable React inbox and real-data API/browser cases. Do not fabricate events or run tests/services/migrations. Update TODO/README and commit locally, never push.

- **Delivery:** 004 inbox migration, strict shared contracts, session-owned inbox and acknowledgment endpoints, account UI and E2E-API-040/E2E-WEB-040. Source values come from DATA-001, not fixtures. No tests, migrations or service actions executed. Manual: format → check → db:migrate, then run @ALERT-001 in API/desktop/mobile with provider access.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ALERT-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
