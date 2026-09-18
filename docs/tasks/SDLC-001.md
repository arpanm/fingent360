# SDLC-001 — Manual SDLC and reusable API/browser test dashboard

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-001 — Manual SDLC and reusable API/browser test dashboard

- **Implementation:** Implemented
- **Verification:** Awaiting user verification; no install, test, build, lint or UI execution performed
- **Dependencies:** SETUP-001
- **Context:** Current user request; tests/e2e/README.md; docs/development/sdlc.md
- **Scope and acceptance:** Maintain TODO and detailed task prompts for every request; author/update E2E cases; provide the manual Playwright UI, partial/full selection and detailed errors; preserve the README blueprint; remove the requested duplicate; document manual-only checks and local commits with no automatic push.
- **E2E cases:** E2E-API-001–004, E2E-WEB-001–004; runner manual acceptance in CATALOG.md
- **Evidence / blockers:** Current change authored only; user installation and acceptance pending.
- **Manual next actions:** Follow tests/e2e/README.md and CATALOG.md; report run ID and failures.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SDLC-001, Current user request; tests/e2e/README.md; docs/development/sdlc.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on Manual SDLC and reusable API/browser test dashboard. Scope and acceptance: Maintain TODO and detailed task prompts for every request; author/update E2E cases; provide the manual Playwright UI, partial/full selection and detailed errors; preserve the README blueprint; remove the requested duplicate; document manual-only checks and local commits with no automatic push. Dependencies: SETUP-001. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Leave the local commit to the user-run pnpm sdlc format/check gate; never push. Give exact manual next actions.

<a id="sdlc-002"></a>

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789709592634-72179.
<!-- sdlc-validation:end -->
