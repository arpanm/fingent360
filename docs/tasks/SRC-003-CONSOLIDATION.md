# SRC-003-CONSOLIDATION — Reviewed share-consolidation bridge

- **Status:** Done (accepted scope)
- **Parent:** [SRC-003](SRC-003.md). This completed scope does not complete its broader parent.
- **Implemented:** Original notices, old/new security identities, exact nominal comparison, suspension-aware calibration exclusion and independent review. Holdings are unchanged.
- **Specification and source evidence:** Use the dated implementation specification, original-source research and detailed handoff in the parent task. This child makes the finished scope visible in the task index; it does not replace or duplicate that evidence.
- **Layers:** Contracts, API/source persistence, shared web/app workflow and offline behavior are implemented or reused as documented in the parent. Operations requires a connected API. Navigation-only changes reuse existing source APIs and schemas.
- **Authored acceptance:** API1780–1783, WEB1780, OFFLINE1780. Cases cover the specified behavior, not live provider permissions or physical-device acceptance.
- **Migration:** 110. No dependency added for this child.
- **Remaining:** User-run validation and applicable source/device activation. Original-data access and wider source coverage remain explicit in the parent.
- **Verification:** The user-operated run `1789709825376-80015a7a-8b3d-4394-a62a-7c6567ea9582` reported API1783 failing before consolidation preparation because the synthetic equity prerequisite returned400. After the date repair, a user-operated `pnpm check` reached E2E typechecking and reported TS2322 at the fixture-date assignment. The typing repair below is not executed. No check/build/E2E, migration, service change, commit or push was run by the repair agent. Inspected HEAD `4774895`.

## API1783 edition-date repair — 2026-09-18

`consolidationActors` replaced the generic equity fixture body with old/new identity and price observations dated 24 June and 11 July2025, but retained the generic edition date 31 January2025. The strict equity-import boundary correctly rejects any observation after its declared source date, so the prerequisite import returned400 before API1783 could exercise the published suspension window.

The helper now declares each synthetic edition effective on its corresponding boundary date. Its shared prerequisite regression also inspects the201 response and requires both retained observations and the edition to preserve that same date before independent publication. Production validation and suspension-window logic are unchanged; no assertion was removed and no provider path was mocked. This strengthens API1780–1783 and WEB1780 setup while the supplied retry remains API1783 only.

The initial implementation represented the two five-field fixture rows as a mutable array of arrays. With repository-wide `noUncheckedIndexedAccess`, TypeScript therefore inferred every destructured cell as `string | undefined`, although both authored rows contain all five values. The rows are now an immutable tuple collection, making their completeness part of the static fixture contract without a cast at the assignment or weaker input typing. The admitted-edition response assertions above remain the meaningful runtime regression.

Smallest validation for the supplied check-stage failure: `pnpm e2e:typecheck`. Expected: the E2E TypeScript project completes without TS2322 in `equity-consolidation.ts`. If it fails, report the exact diagnostic and file/line. This command needs no services, migrations or UI URL. The parent repair workflow owns the exact `pnpm check` retry; API1783 runtime validation remains separately pending.

Smallest validation, with the existing migrated databases and current API process available:

`pnpm e2e:run '/Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/equity-consolidation\.spec\.ts' --project=api --grep 'E2E-API-1783 actual published suspension blocks daily-window qualification only across its transition @SRC-003 @IMPACT-TRACE-001 @TEST-SIMULATION$'`

Expected: both dated prerequisite editions import and publish, the transition window is blocked for both identities, and windows wholly before/after it remain eligible. On failure report the exact status/assertion and saved run artifact. No UI URL is needed for this API-only retry; dependencies and migration110 are unchanged.

## Reusable implementation prompt

Read AGENTS.md and the linked parent specification before changing this workflow. Preserve the exact source/identity/unit and review invariants described above. Address a concrete reported gap or saved failing case through contracts, backend, shared web/app and offline behavior as applicable; update authored tests and this record plus TODO. Do not rerun deterministic gates or expand the supported source claim without evidence.

## Manual acceptance

With the documented database/API/web setup and required migrations, run `pnpm sdlc "Validate SRC-003-CONSOLIDATION" -- --grep "E2E-(API|WEB|OFFLINE)-178[0-3]"`. Use the web URL printed by `pnpm dev`; keep test watch mode off. Check the corresponding Operations/reader flow documented in the parent. Installed Android/iOS bundles require the documented rebuild/reinstall. Report the exact failed case, saved artifact run and error. The user-operated SDLC command owns gated commit and execution.

## Current acceptance review — 20 September 2026

Reviewed scope: Original consolidation notices, independently reviewed old and new security identities, exact nominal comparison, immutable source histories, paginated review queue, withdrawal, suspension-aware calibration exclusion, shared company readers and downloaded admission. User holdings remain unchanged. Actual source permission and activation, independent operational original review and physical-device release certification remain separate. This does not complete wider parent scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Passed — automated acceptance. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789848189876-42077.
<!-- sdlc-validation:end -->
