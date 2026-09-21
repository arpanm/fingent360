# GOALS-001 — Create and manage goals

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - GOALS-001 (DEV-009): Persist authenticated account-owned repeatable financial goals, exact amounts, visible/versioned assumptions, CRUD UI and ownership/conflict tests. Prompt: deliver contracts → additive migration 005 → API → responsive Goals UI → API/browser cases and docs. No invented returns or investment recommendations. Implemented.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** User-run SDLC1789667338688-55776 passed the reviewed connected and offline acceptance matrix on2026-09-17. Gated implementation commit846e990; final offline report `artifacts/e2e/offline-1789667442248-57214/results.json`. This accepts that scope/revision, not later unrelated changes.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **GOALS-001 (DEV-009):** Persist authenticated account-owned repeatable financial goals, exact amounts, visible/versioned assumptions, CRUD UI and ownership/conflict tests. Prompt: deliver contracts → additive migration 005 → API → responsive Goals UI → API/browser cases and docs. No invented returns or investment recommendations. Implemented.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on GOALS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

## Functional closure review — 2026-09-16

- **Specification:** Complete the existing saved-goal scope before starting another functional story. Review confirms real authenticated/versioned PostgreSQL CRUD, encrypted revisions, exact contribution arithmetic and the corresponding on-device implementation already exist. No new migration or contract is needed for the remaining UI lifecycle defect.
- **Gap found:** Removing the goal currently being edited clears its fields but leaves the editor open at its previous wizard step. After confirmed removal, close that editor, clear its draft guard and restore focus; cancelling removal must preserve the draft. Removing a different goal must preserve the open draft. Prevent overlapping actions while a request is pending.
- **Acceptance:** Author shared real-storage desktop/mobile/offline removal cases, preserving exact goal-list checks and original API conflict/ownership cases. No mocks for account or goal storage. Add required IDs to the acceptance matrix and opt this bounded story into closure only on actual full passing evidence. Keep physical-device release acceptance separate.
- **Reusable prompt:** Finish GOALS-001's saved-goal CRUD and draft lifecycle using existing API/contracts/database and offline handlers. Fix only demonstrated gaps, author end-to-end regression coverage, update task/TODO/README and closure requirements. Do not execute deterministic commands; user-run SDLC owns validation and the gated commit.
- **Current evidence:** ACCOUNT-001 passed user-run acceptance1789569346007-35322. GOALS-001 has no new passing run. Do not relabel authored goal fixes as verified.

- **Authored fix:** Confirmed deletion calls the common editor-close path only when it removes the currently edited goal. Cancelling deletion and removing another goal preserve that draft. A synchronous action guard prevents overlapping submissions, and read generations prevent an earlier list response or error from overwriting a later reload/write. Existing encrypted server rows and on-device storage are reused.
- **New cases:** WEB068 (desktop/mobile) and OFFLINE068 verify cancellation, other-goal removal, deletion from review, keyboard focus, draft-guard cleanup and durable empty list with actual storage. WEB069 delays a real old server response until after actual deletion and ensures it cannot restore the removed goal. Existing API060/061, WEB060/062/066/067 and OFFLINE010 remain required.
- **Scope review:** This bounded saved-goal story has no remaining implementation/input gate. Its full current matrix and check gate must pass before automatic Done; broader forecasting, investment advice and native release acceptance are separate tasks.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789929280500-88238.
<!-- sdlc-validation:end -->
