# SDLC-002 — User acceptance of the SDLC tool

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - Implementation: Implemented handoff/evidence tooling; user acceptance remains pending
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-002 — User acceptance of the SDLC tool

- **Implementation:** Implemented handoff/evidence tooling; user acceptance remains pending
- **Verification:** Not run
- **Dependencies:** SDLC-001
- **Context:** tests/e2e/CATALOG.md runner acceptance; tests/e2e/README.md
- **Scope and acceptance:** The user installs the pinned dependencies/browser, launches the app and test UI, runs the runner acceptance steps in tests/e2e/CATALOG.md, and provides case results. Codex records supplied evidence and opens linked defect tasks for failures; it does not execute those steps.
- **E2E cases:** E2E-API-001–004, E2E-WEB-001–004; runner manual acceptance in CATALOG.md
- **Evidence / blockers:** Current change authored only; user installation and acceptance pending.
- **Manual next actions:** Follow tests/e2e/README.md and CATALOG.md; report run ID and failures.

**Codex prompt**

> Read AGENTS.md, README.md, TODO.md task SDLC-002, tests/e2e/CATALOG.md runner acceptance; tests/e2e/README.md, and the linked E2E coverage plan. Follow the standard task prompt contract in TODO.md. Work on User acceptance of the SDLC tool. Scope and acceptance: The user installs the pinned dependencies/browser, launches the app and test UI, runs the runner acceptance steps in tests/e2e/CATALOG.md, and provides case results. Codex records supplied evidence and opens linked defect tasks for failures; it does not execute those steps. Dependencies: SDLC-001. Do not invent missing domain/provider fields or claim future functionality. If a product decision is unresolved, record it as a blocker and progress independent authored work. Add/update API and/or browser acceptance cases (or manual document-review scenarios if there is no executable behavior), including prerequisites and meaningful failures. Update this task, test catalogue and relevant README details. Do not run installation, formatting, lint, builds, tests, browser checks, service changes or migrations. Leave the local commit to the user-run pnpm sdlc format/check gate; never push. Give exact manual next actions.

<a id="dev-001"></a>

### SDLC-002 continued — implemented handoffs and readable evidence; user acceptance remains separate

- **Commit completion follow-up:** User explicitly requests committing the remaining working-tree changes. Reviewed the pending source diff and included the existing API/web/contracts/scripts/test formatting edits in a local commit without running hooks or checks. Prompt: preserve and commit all remaining tracked changes, update this record and README, confirm Git status, and never push. No new runtime behavior or test cases authored for this commit-only request; existing checks and acceptance cases remain pending manual execution.

- **Implementation:** Implemented; manual verification pending.
- **Request/context:** User reports missing commits/SDLC steps and difficulty copying Playwright UI failures. Existing fixes are committed as 8cb2a1d, 1e6adab and d596552; remaining working-tree edits require review and preservation.
- **Scope:** Audit local change records; correct stale testing documentation; add a local Markdown reporter for manually initiated UI/CLI test runs, retaining per-run evidence and a latest-result pointer. No automatic tests, uploads, pushes or service actions.
- **Dependencies:** Existing Playwright runner and local artifact directory; no new packages.
- **Acceptance:** Every manual run records selected cases, outcomes, failures, locations and run identity; repeat runs do not present old failures as current; sensitive configuration values are redacted; imports/discovery do not create artifacts. User can ask Codex to read the latest report without copying browser errors. Source changes, cases, README and TODO are committed locally.
- **Codex prompt:** Inspect Git history and pending changes without executing gates. Implement a reusable Playwright reporter that writes human-readable failure evidence during manual execution, covers pass/fail/skip/interruption/global errors, preserves historical run files and publishes a latest summary. Avoid attachments/response dumps and redact known secrets. Add isolated reporter tests and manual UI acceptance cases, update coverage and SDLC guidance, inspect the diff, and commit scoped work without hooks or push. Keep authored and verified statuses separate; report remaining working-tree changes explicitly.
- **Manual next actions:** pnpm format, pnpm check, reopen E2E UI, manually run selected cases, then ask Codex to read artifacts/e2e/latest.md. Verify the acceptance cases linked in CATALOG.md.
- **Delivery/evidence:** Added handoff reporter, isolated regression definitions and SDLC-UI-001–005/SDLC-DOC-001 acceptance cases; corrected stale port/report guidance and clarified commit audits. No tests, formatting, builds or services run. Pre-existing app/API/contracts and other test/script edits remain outside this scoped change; they are preserved, not claimed committed by this task.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-002 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
