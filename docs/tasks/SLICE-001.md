# SLICE-001 — Working educational portfolio journey

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - Implementation: Implemented
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
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

## Reviewed acceptance scope — 20 September 2026

Explicitly synthetic educational virtual workspace, catalog/event/company navigation, exact quantities/valuation, CSV preview/reconciliation, revision/idempotency/ownership, repeated goals, immutable review and persisted responsive journey.

The complete required case/project matrix is now recorded in `acceptance.json`. This review is not a test pass; actual current-revision receipts determine validation.

Remaining gates: Full virtual-journey keyboard acceptance is authored as E2E-WEB-2315 below; desktop/mobile execution remains unrecorded. Earlier connected cases cover click controls and mobile width.

## Remaining completion gates — 20 September 2026

The matrix recorded at the earlier reconciliation passed. The newly authored keyboard case has no execution receipt; rerunning older passing cases does not satisfy it:

- E2E-WEB-2315 must pass in desktop and mobile before the full virtual-journey keyboard requirement can close.

## Keyboard journey authoring — 20 September 2026

**Authority and scope:** The subsequent instruction to finish agent-actionable acceptance authorizes this bounded case despite the earlier validation-only pickup record. No new feature input or external account is needed. This is authored coverage, not a pass or physical assistive-technology certification.

**Acceptance:** [journey-keyboard.spec.ts](../../tests/e2e/cases/browser/journey-keyboard.spec.ts), E2E-WEB-2315, uses the actual isolated API and synthetic persisted workspace. It traverses the brief, event and company using Tab/Enter; edits and saves holdings; rejects an unreconciled import without changing storage; corrects and confirms the import; saves two same-type goals and checks exact funding; issues and reconstructs an immutable review; exercises the stale-input assessment block; reloads and reopens saved history; then deletes through keyboard UI and verifies the old capability is rejected for workspace and history. Both browser projects use a 360px viewport. Every activated or edited control must be reached through actual Tab traversal and pass the existing viewport/occlusion assertion; no programmatic focus or successful-response mock is used.

**Layers:** Specification, UI/UX and workflow are the acceptance sequence above. Contracts/API, exact valuation, persistence and immutable records reuse the existing implementation and are asserted against real API responses. Provenance remains explicitly fictional fixture-v1; live data, broker layouts and regulated advice are outside this slice. No production, database, dependency, worker or offline behavior changes are introduced. Existing API010–013 and WEB010–012 retain the other scope requirements; this case supplements them.

**Manual validation:** Dependencies are unchanged. Use the existing documented PostgreSQL/MongoDB test prerequisites and web development service (the user starts them if needed); the fixture starts its isolated API only during the user-invoked run. Open the printed web URL at `/#brief` for manual inspection. Run:

```bash
pnpm sdlc "Validate full keyboard virtual journey" -- --project=desktop --project=mobile --grep 'E2E-WEB-2315 '
```

Expected: both project receipts pass, including real saved revisions 1–3, retained review after reload and unauthorized reads after deletion. For failure report the saved run ID, project, case and safe assertion/error; do not disclose the workspace capability. Trace/video/automatic screenshots are disabled for this capability-bearing workflow. Tags: `@SLICE-001 @TEST-SIMULATION`. No format/check, tests, builds, services, migrations or commit were executed while authoring. Local HEAD at handoff is `c7874a5`; unrelated authoring changes remain uncommitted and untouched. User-run gates own the next verified commit.

## Integration handoff — 20 September 2026

Continuation is reconciled in the unwatched `fingent360-continuation-20260920`
checkout against user commit `c99d62b` and newer saved validation records. The
main checkout and those records are preserved. Use the continuation-only patch
and commands in [the current handoff](../development/nondeferred-authoring-2026-09-20.md).
No new tests/gates/migrations/services or commit were run by the agent. Earlier
base hashes above identify authoring history, not the current integration base.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926419995-75587.
<!-- sdlc-validation:end -->
