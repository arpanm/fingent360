# SLICE-001 — Working educational portfolio journey

- **Status:** Needs repair
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

## Keyboard route-synchronization repair — 20 September 2026

User-operated run `1789927816761-ebb24ad7-e27e-40cd-9387-da4aa0e80c9e` started at `2026-09-20T18:10:16.761Z` against API `http://127.0.0.1:4104` and web `http://127.0.0.1:5176`. Its only selected case was E2E-WEB-2315 on desktop. The run reached the Import CSV keyboard step but could not find the `CSV content` textarea. This is failure evidence, not a pass for any other case or project.

The outer application router and `Journey` previously maintained separate state for the same hash: the app accepted the learning-lab route while a second `hashchange` listener independently selected the inner panel. Those two asynchronously updated copies could disagree, leaving the prior portfolio panel rendered after keyboard navigation even though the route activation had completed.

`Journey` now receives the application router's accepted base route directly, leaving one owner for the URL, selected navigation state and rendered panel. E2E-WEB-2315 retains the actual Tab/Enter path and now asserts `#import`, the Import CSV `aria-current` state and the import heading before editing the textarea. This makes a route/panel disagreement fail at the navigation boundary rather than as an unexplained missing field; no assertion, storage path or API behavior is removed or mocked.

The focused user rerun `1789927946774-3cdd2116-3aab-4317-a1da-225cad78263a` started at `2026-09-20T18:12:26.774Z` against the same targets and again selected only desktop E2E-WEB-2315. It passed the newly preceding URL, current-link and import-heading assertions, then failed resolving the implicitly labelled `CSV content` textarea at line 115. The assertion order narrows the remaining failure to the rendered import form's label/control association rather than panel routing. This remains failure evidence, not a pass.

All four import inputs now have stable IDs and explicit `htmlFor` associations. The regression keeps `getByLabel('CSV content', { exact: true })`, additionally requires its exact control ID, and then uses that same locator for the keyboard edit. This verifies the user-facing accessible association instead of selecting the textarea through an implementation-only CSS path.

The repair changes UI routing, import form semantics and the existing browser case only. Contracts, API, database, provenance, automation and dependencies are unchanged. Loading, saved, invalid-import, corrected-import, repeated-goal, review, reload and deletion coverage remain in E2E-WEB-2315. Validation was not run and no commit was created. With the existing PostgreSQL/MongoDB and user-started web service available, rerun the exact reported desktop case first:

```bash
pnpm e2e:run '/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/journey-keyboard\.spec\.ts' --project=desktop --grep 'E2E-WEB-2315 full keyboard virtual journey edits imports allocates reviews reloads and deletes actual synthetic workspace @SLICE-001 @TEST-SIMULATION$'
```

Expected: keyboard activation selects and renders Import CSV, then the case completes revisions 1–3, review reload and keyboard deletion. On failure, report the saved run ID, project, case and safe first assertion/error without the workspace capability. Mobile remains unverified and should be exercised by the documented full story command after the focused desktop repair passes.

## Integration handoff — 20 September 2026

Continuation is reconciled in the unwatched `fingent360-continuation-20260920`
checkout against user commit `c99d62b` and newer saved validation records. The
main checkout and those records are preserved. Use the continuation-only patch
and commands in [the current handoff](../development/nondeferred-authoring-2026-09-20.md).
No new tests/gates/migrations/services or commit were run by the agent. Earlier
base hashes above identify authoring history, not the current integration base.

## Saved-run diagnosis and label repair — 20 September 2026

Run `1789928159261-b4661b68-a4ba-4588-9bd4-bea3b8e70254`, started
2026-09-20T18:15:59.261Z, selected only desktop WEB2315 against web5176/API4104.
Its saved error-context shows both the Import heading and textbox named CSV content.
Thus the latest failure is not evidence that routing failed. The previous route
and explicit-ID repairs did not resolve the exact label selector.

The textarea was still nested inside its label. A textarea's initial text is a
DOM text child; label-text lookup can include it even when the accessibility tree
correctly names the control. The authored repair makes the label a sibling of the
textarea, retaining explicit htmlFor/id and grouping the pair in a div. Label text
is now independent of the CSV value. WEB2315 retains exact getByLabel lookup and
adds accessible-name and edited-value assertions before exercising reconciliation.

Specification/acceptance: the prepopulated and edited CSV control must remain
resolvable by its exact visible label and usable with Tab/keyboard editing on both
projects. Shared React supplies web/mobile-shell semantics; no API, contracts,
database, source, dependency or automation changes are needed. Existing invalid
preview, correction, persistence, review and deletion assertions remain intact.
Reusable prompt: use the saved snapshot to distinguish label-text lookup from
panel routing; separate textarea and label without removing keyboard assertions.

Implementation is supplied in `../fingent360-keyboard-label-repair.patch` relative
to the repository, against the existing uncommitted repairs. Stop the user dev
session before applying it; restart afterward. No gates, tests or services were
run by the agent. No commit: new changes require user-run format/check gates.
Run `pnpm sdlc "Repair keyboard CSV label" -- --project=desktop --project=mobile --grep 'E2E-WEB-2315 '`
with the existing database/web prerequisites. Expected: both complete keyboard
journeys pass. Report artifacts/e2e/latest.md and the error-context on failure;
never share private workspace capabilities. Generated failure records stay intact
until a passing user-run receipt resolves them.

## CSV editor occlusion repair — 20 September 2026

User-operated run `1789928424949-4e074e31-bac3-4b96-bbe6-9ff8e100274a` started
at `2026-09-20T18:20:24.950Z` against API `http://127.0.0.1:4104` and web
`http://127.0.0.1:5176`. This repair uses only its supplied desktop WEB2315
failure. The textarea was found, enabled, reached by Tab and focused at line 121;
the failure was the real viewport hit test, not routing, labelling or editing.

At the forced 360×800 viewport, the CSV textarea consumed the import field's
full width while the persistent feedback launcher occupied the right-hand lane.
Native focus scrolling could therefore leave part of the editor under that fixed
control. The CSV field wrapper now reserves the established 76px launcher lane
at narrow widths while retaining a 550px maximum at wider widths. This is a UI
layout repair only; contracts, API, data model, provenance, automation,
dependencies and other journey states are unchanged.

WEB2315 remains the regression case. It still uses actual Tab traversal and the
nine-point viewport/hit-target assertion, and now also requires the focused CSV
editor's right edge to finish before the visible `Give feedback` button begins.
It retains exact labelling, edited value, invalid/corrected import, revisions,
reviews, reload and deletion. No assertion, real request or persistence path was
removed or mocked.

The latest repair is authored only. Existing PostgreSQL and MongoDB plus the
user-started web service are required. Run the exact desktop case documented
below; expected behavior is that the CSV control remains fully reachable and the
complete keyboard journey finishes. On failure, report the saved run ID, project,
case and safe first assertion/error without any workspace capability. Mobile and
the wider story matrix remain unverified rather than implied by this retry.

```bash
pnpm e2e:run '/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/journey-keyboard\.spec\.ts' --project=desktop --grep 'E2E-WEB-2315 full keyboard virtual journey edits imports allocates reviews reloads and deletes actual synthetic workspace @SLICE-001 @TEST-SIMULATION$'
```

## Review condition label repair — 20 September 2026

User-operated run `1789928630682-e080c076-41b1-44f4-a369-f6db64d6e131`
started at `2026-09-20T18:23:50.682Z` against API
`http://127.0.0.1:4104` and web `http://127.0.0.1:5176`, selecting only the
desktop WEB2315 case. The run reached the saved baseline review and expanded its
reconstructed inputs, then timed out because the exact
`Exercise input condition` label locator returned no element.

The case-specific failure snapshot contains the rendered review panel and a
combobox with that accessible name. This rules out a missing panel for this
failure and isolates the remaining difference from the already repaired import
controls: the review select still relied on an implicit wrapping label. It now
has the stable `journey-review-scenario` ID and an explicit `htmlFor`
association. Contracts, API, database, provenance, automation, dependencies,
offline behavior and other journey states are unchanged.

WEB2315 remains the regression case and now checks the select ID and exact
accessible name before using the existing real Tab traversal. It continues to
exercise the baseline and stale reviews, persisted inputs, reload and deletion
through actual UI/API/storage paths. No assertion was removed, no mock replaced
a real path and no test was run by the agent.

The existing PostgreSQL and MongoDB services plus the user-started web service
are required. The smallest validation is the exact desktop command below.
Expected behavior is that the explicitly labelled select is found and reached
by Tab, changes to `stale`, and the complete journey deletes its synthetic
workspace. On failure, report the saved run ID, project, case, and safe first
assertion/error; do not include workspace capabilities or private data.

```bash
pnpm e2e:run '/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/journey-keyboard\.spec\.ts' --project=desktop --grep 'E2E-WEB-2315 full keyboard virtual journey edits imports allocates reviews reloads and deletes actual synthetic workspace @SLICE-001 @TEST-SIMULATION$'
```

## Review condition commit repair — 20 September 2026

User-operated run `1789928814882-63218119-cfe7-4160-9644-857bf3b877d5`
started at `2026-09-20T18:26:54.882Z` against API
`http://127.0.0.1:4104` and web `http://127.0.0.1:5176`, selecting only desktop
WEB2315. It passed the explicit review-control ID/name checks and reached the
controlled select. After `Home`, `ArrowDown` and `Tab`, the expected `stale`
value was still `baseline`.

This is a native keyboard-commit issue, not a missing label or application-state
reset. Desktop Chromium on macOS keeps arrow-key movement inside the native
select popup; Tab dismisses an unconfirmed highlight, so no change event reaches
the controlled React select. WEB2315 now presses Enter to confirm the highlighted
`stale` option, asserts that value before focus leaves the select, and then tabs
onward. It still reaches the control through actual Tab traversal and uses the
real UI, API and persisted workspace; no selection API, mock, skipped assertion
or production workaround is introduced.

The repair changes only the browser regression and its acceptance records.
Specification, UI, contracts, API, data model, database, provenance, automation,
dependencies and offline behavior are unchanged. Existing coverage for labels,
occlusion, revisions, stale assessment, reload, ownership and deletion remains.
No validation was run and no commit was created.

**Reusable repair prompt:** Read the saved single-case WEB2315 evidence and the
existing native-select keyboard precedent. Preserve real Tab traversal and the
controlled journey select; explicitly commit its keyboard-highlighted stale
option, assert the committed value before focus leaves, retain all downstream
real API/storage assertions, update scoped acceptance records, and do not run or
weaken validation.

With the existing PostgreSQL and MongoDB services plus the user-started web
service, rerun the exact desktop case below. Expected: Enter commits `stale`,
the stale review is blocked as `Unable to assess`, and the journey completes
reload and deletion. On failure, report the saved run ID, project, case and safe
first assertion/error without workspace capabilities or private data. Mobile
and the broader story matrix remain unverified.

```bash
pnpm e2e:run '/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/journey-keyboard\.spec\.ts' --project=desktop --grep 'E2E-WEB-2315 full keyboard virtual journey edits imports allocates reviews reloads and deletes actual synthetic workspace @SLICE-001 @TEST-SIMULATION$'
```

## Review-condition radio repair — 21 September 2026

**Evidence:** saved run `1789928977101-955760b9-f7f6-4035-bae0-fbc1c80c4810`
started 2026-09-20T18:29:37.101Z, one desktop WEB2315 case, web5176/API4104.
CSV import and goal allocation were passed before the failure. The snapshot shows
an active review-condition combobox with Baseline selected; the value assertion
still received baseline after the authored Home/ArrowDown/Enter sequence. This
supersedes the earlier claim that adding Enter would resolve the selection.
There is no saved evidence of an API scenario-calculation failure.

**Specification:** expose all three synthetic review conditions as native labelled
radio choices in a named fieldset. Baseline is initially checked; Tab enters the
group and ArrowDown selects stale, then conflicting; ArrowUp returns to stale.
Pointer/touch users can activate the entire label. Retain visible keyboard focus
and 44px targets at 360px width. Preserve busy/unsaved gating on Create review,
actual scenario submission, immutable review records, reload and deletion.

**Implementation:** shared React web/mobile-shell controls replace the OS-native
select popup. Scoped CSS sizes native radios and targets without changing other
forms. WEB2315 exercises all three choices using actual Tab/arrow keys, asserts
the stale POST receipt via ReviewSchema, and retains all persistence checks.
WEB010 uses the stale radio through its accessible label. Existing API/contracts,
DB schema, provenance and automation are reused unchanged; no dependencies,
migrations, source fetches or offline API capabilities are added. Acceptance IDs
and desktop/mobile matrix remain unchanged. Manual visual acceptance: check the
three labels wrap at 360px, focus remains visible, and tapping labels changes only
the chosen condition in web and the next rebuilt Android bundle.

**Reusable prompt:** use the saved baseline-selected snapshot, replace the bounded
three-choice select with native radios, verify real keyboard and touch selection
and actual review scenario receipt, preserve all storage checks, do not run gates.

**Pending:** patch application and user validation. Active main-checkout watchers
were left untouched; this delta is in `../fingent360-review-condition-repair.patch`.
No commands/tests/builds/services or commit were executed. Existing automatic
repair edits and generated failure records were preserved. After stopping dev,
apply that patch and restart dev; databases must already be available. Run:

```bash
pnpm sdlc "Repair review condition keyboard controls" -- --project=desktop --project=mobile --grep 'E2E-WEB-(2315|010) '
```

Expected: four selected browser cases pass; report latest.md and saved error
context if they fail. User-run SDLC owns gated commit and bug/status reconciliation.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789928359149-84609.
<!-- sdlc-validation:end -->
