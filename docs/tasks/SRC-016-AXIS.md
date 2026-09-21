# SRC-016-AXIS — Axis ETF original portfolio disclosure

- **Status:** Implementation complete; validation pending
- **Parent:** [SRC-016](SRC-016.md). This completed scope does not complete its broader parent.
- **Implemented:** Verified original workbook layout, equity/TREPS/current-assets reconciliation, independent AMFI identity mapping and downloaded NAV admission.
- **Specification and source evidence:** Use the dated implementation specification, original-source research and detailed handoff in the parent task. This child makes the finished scope visible in the task index; it does not replace or duplicate that evidence.
- **Layers:** Contracts, API/source persistence, shared web/app workflow and offline behavior are implemented or reused as documented in the parent. Operations requires a connected API. Navigation-only changes reuse existing source APIs and schemas.
- **Authored acceptance:** API1720–1721, WEB1720, OFFLINE1720. Cases cover the specified behavior, not live provider permissions or physical-device acceptance.
- **Migration:** None. No dependency added for this child.
- **Remaining:** User-run validation and applicable source/device activation. API1720 passed in saved run `1789707784553-ad429c5e-f13e-4018-988a-6a99aa642f20`; API1721 then exposed the same empty-shared-string rejection through the running capture API, which returned its specified quarantined `portfolio: null` receipt. The scoped repair below is authored and must be loaded by the API process before the exact API1721 rerun. Original-data access and wider source coverage remain explicit in the parent.
- **Verification:** API1720 passed the repaired parser path. API1721 has not passed: its supplied failure stopped at the capture receipt before mapping/review. No format/check/build/E2E, migration, service change, commit or push was run for this repair attempt. Current local baseline is a664dfd with unrelated working-tree changes preserved.

## Scoped API1720 parser repair — 2026-09-18

The synthetic original uses inline strings and therefore has a valid empty `xl/sharedStrings.xml` root (`<sst/>`). `fast-xml-parser` represents that root as an empty string, but the Axis XML helper previously accepted only object-valued roots, so parsing stopped before the workbook grammar and lexical checks ran. The helper now permits an empty scalar only when the caller explicitly allows an empty `sst` root; missing, renamed, array-shaped and other invalid roots remain rejected. API1720 retains its quantity, fractional-weight, yield, reconciliation and lexical-proof assertions and now also rejects a renamed shared-string root.

No product surface, API, data model, database, source permission or automation behavior changes. UI, mobile, keyboard, loading, empty, error, recovery and saved-state acceptance are not applicable to this parser-only correction and remain covered by the unchanged WEB1720/OFFLINE1720 workflow cases. No dependency or migration changed.

Smallest validation for this reported failure (user-operated; API/web services are not required):

`pnpm e2e:run "/Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/axis-portfolio\\.spec\\.ts" --project=api --grep "E2E-API-1720 original Axis grammar preserves quantity fractional weights yield and rejects tampered lexical proof @FUNDS-BONDS-001 @TEST-SIMULATION$"`

Expected: API1720 accepts the inline-string workbook with an empty shared-string table, preserves exact parsed values, rejects tampered lexical proof/source URL, and rejects a renamed shared-string root. On failure, report the run ID, exact case/project, first error and stack, and whether the failure occurred before or after the parser result assertions.

## Scoped API1721 capture repair — 2026-09-18

The supplied API1721 failure is the connected capture form of the API1720 parser defect. The import endpoint intentionally retains an unsupported or inconsistent workbook as a quarantined `201` receipt with `portfolio: null`; dereferencing `portfolio.parser` therefore produced a secondary `TypeError` and concealed the actual state. The parser correction above is the product fix. API1721 now parses the response through `SbiPortfolioEditionSchema` and requires the valid Axis original to be a `draft` with the exact parser, scheme/date identity and `error: null` before attempting independent mapping. This preserves quarantine behavior for genuinely invalid originals and makes any parser/runtime regression report the contract mismatch rather than a null dereference.

Because the connected API imports `@fingent360/contracts` from its built package, the API process used for validation must have loaded the repaired contracts output. Restart the existing user-operated development session if it predates the repair; no database migration or dependency action is needed.

Smallest validation for this reported failure (user-operated; configured PostgreSQL, MongoDB and a freshly loaded API process are required):

`pnpm e2e:run "/Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/axis-portfolio\\.spec\\.ts" --project=api --grep "E2E-API-1721 Axis capture independent exact-AMFI mapping and NAV withdrawal use retained original receipts @FUNDS-BONDS-001 @TEST-SIMULATION$"`

Expected: the valid original capture is a parsed draft with no error, self-review remains forbidden, an independent exact-AMFI mapping publishes, retained bytes are returned unchanged, and withdrawing the mapped NAV removes public admission. On failure, report the run ID, case/project, first error and stack, plus the parsed capture `state` and redacted `error` fields; do not include retained workbook bytes.

## Reusable implementation prompt

Read AGENTS.md and the linked parent specification before changing this workflow. Preserve the exact source/identity/unit and review invariants described above. Address a concrete reported gap or saved failing case through contracts, backend, shared web/app and offline behavior as applicable; update authored tests and this record plus TODO. Do not rerun deterministic gates or expand the supported source claim without evidence.

## Manual acceptance

With the documented database/API/web setup and required migrations, run `pnpm sdlc "Validate SRC-016-AXIS" -- --grep "E2E-(API|WEB|OFFLINE)-172[01]"`. Use the web URL printed by `pnpm dev`; keep test watch mode off. Check the corresponding Operations/reader flow documented in the parent. Installed Android/iOS bundles require the documented rebuild/reinstall. Report the exact failed case, saved artifact run and error. The user-operated SDLC command owns gated commit and execution.

## Current acceptance review — 20 September 2026

Reviewed scope: Verified original Axis ETF workbook grammar, exact equity, TREPS and current-assets reconciliation, independent exact AMFI mapping, retained originals, fund reader and downloaded NAV-identity admission. Actual source permission and activation, independent operational original review and physical-device release certification remain separate. This does not complete wider parent scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789929280500-88238.
<!-- sdlc-validation:end -->
