# SETUP-001 — Local development foundation

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SETUP-001 — Local development foundation

- **Implementation:** Implemented
- **Verification:** Historical checks recorded in docs/development/status.md; new E2E cases not run
- **Dependencies:** Accepted plan
- **Context:** README.md sections 19–25; docs/product/decisions.md
- **Scope and acceptance:** Files local; documented bootstrap/dev; strict checks; real DB smoke; Git commit
- **E2E cases:** E2E-API-001–004, E2E-WEB-001–004; runner manual acceptance in CATALOG.md
- **Evidence / blockers:** See historical foundation evidence in docs/development/status.md.
- **Manual next actions:** After implementation, user runs relevant checks and selected E2E cases listed in the handoff; attach evidence before marking verified.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SETUP-001, README.md sections 19–25; docs/product/decisions.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Local development foundation. Scope and acceptance: Files local; documented bootstrap/dev; strict checks; real DB smoke; Git commit Dependencies: Accepted plan. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Leave the local commit to the user-run pnpm sdlc format/check gate; never push. Give exact manual next actions.

<a id="sdlc-001"></a>

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SETUP-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789711405725-75316.
<!-- sdlc-validation:end -->
