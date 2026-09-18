# SLICE-001 — Working educational portfolio journey

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SLICE-001 — Working educational portfolio journey

- **Implementation:** Implemented
- **Verification:** Awaiting user verification; source and executable cases written, not run.
- **Request:** User clarified that document-only delivery is insufficient and requested end-to-end development.
- **Dependencies:** DEV-001; implement the necessary bounded portions of DEV-002–DEV-010 together without marking their broader production scope complete.
- **Scope:** Synthetic public event/evidence/company details; isolated persisted virtual workspace; strict contracts and exact decimal valuation; manual holdings and standard CSV preview/reconciliation/idempotent confirmation; multiple goals and allocations; deterministic educational review with saved input revision and history; responsive UI; real API/browser E2E cases. No live-source approval, broker formats, XLSX, real-account authentication or regulated advice is implied.
- **Acceptance:** Complete the journey in browser; reload preserves saved data; malformed/duplicate/unreconciled imports never mutate holdings; stale/conflicting inputs block assessment; allocations cannot exceed available capital; another workspace cannot read records; replayed commits do not duplicate; failures render actionable messages.
- **Codex prompt:** Read AGENTS.md, README, DEV-001 artifacts and SLICE-001. Implement a working synthetic educational first slice across contracts, PostgreSQL migration, deterministic domain services, Nest API and responsive React UI. Keep fictional evidence explicit. Use exact integer/decimal arithmetic, validate all boundaries, persist immutable revisions and scope every private query to the workspace capability. Add substantive API/browser cases, document the manual migration/check/test commands, update affected task progress honestly, and commit locally with hooks disabled. Do not execute deterministic checks/services or push.

- **Files:** packages/contracts/src/journey.ts; apps/api/src/journey*.ts; infra/migrations/001_virtual_journey.sql; apps/web/src/Journey.tsx; tests/e2e/cases/{api,browser}/journey.spec.ts.
- **Cases:** E2E-API-010–013, E2E-WEB-010–012 plus domain golden/negative tests. Existing foundation browser case updated to the working landing page.
- **Manual next actions:** Follow [working journey](../development/working-journey.md): db:up → format → check → db:migrate → dev; launch Chrome E2E UI and run @SLICE-001 in API/desktop/mobile. Report failures by case/project/trace. No dependency changes. No commands/tests/services executed by Codex; no push.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SLICE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789709592634-72179.
<!-- sdlc-validation:end -->
