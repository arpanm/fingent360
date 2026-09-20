# SDLC-REPAIR-013 — Web compiler boundary repair

- **Status:** Implementation complete; validation pending
- **Input (2026-09-16):** User supplied the web TypeScript failure from `pnpm check` (exit 2) and authorized only scoped authoring/read-only inspection. No suite report was read. No private input or new decision is needed.
- **Scope:** Repair explicit undefined request bodies/forwarded props, narrow UUID state inference and nullable governance selection. Preserve strict compiler settings and runtime schemas.
- **Dependencies:** Existing workspace dependencies and generated contracts; no dependency or migration changes.
- **Acceptance:** Supplied compiler diagnostics disappear; bodyless requests remain bodyless; optional filters/callbacks preserve defaults; brief corrections accept validated receipt IDs; initial governance rendering with no selection never dereferences null.
- **Layers:** Web types and initial governance rendering affected. API/contracts, database, source/provenance, automation and navigation unchanged; no new controls or layout. Existing loading/empty/error/recovery/saved states remain. Keyboard/mobile/visual acceptance reuses the existing governance browser case and requires user execution.
- **Verification:** Not run. Preserve pre-existing tracked/untracked work and completed commits.

## Reusable prompt

Repair only the supplied web compiler diagnostics, author a meaningful regression for initial null governance selection, and update README/TODO and coverage documentation. Do not execute deterministic commands, commit, delegate or inspect unrelated failures. Return to the parent for its exact check retry.

## Implementation and remaining gaps

### Native bridge declaration follow-up — 2026-09-16

Input: the user supplied only TS4058 at `apps/web/src/broker-native.ts:3` from `pnpm check` and authorized one authoring-only repair attempt. No suite report inspection, execution, commit or delegation is permitted. No additional private input is needed. Scope: make the inferred public broker bridge return type nameable across modules without changing runtime selection or compiler settings.

Root cause: `NativeBridge` was module-private in `runtime.ts`, while exported `brokerBridge()` inferred a union containing it. The web project inherits declaration checking. Export that existing interface; retain the inferred iOS/Android/undefined union. Add a compile-time regression in `apps/web/src/broker-native.type-test.ts`, included by the existing web tsconfig, asserting the exact return union and all three callback payloads without executing browser code or introducing mocks.

Acceptance SDLC-REPAIR-013-G: `pnpm --filter @fingent360/web typecheck` exits 0 with no TS4058 and all compile-time assertions satisfied. Existing dependencies and contracts built by the supplied run suffice; no services, UI URL, E2E project or tags apply. Parent retries the exact `pnpm check`. On failure report command, exit status and compiler diagnostics without private data.

Specification, TypeScript module contract, regression authoring and documentation apply. UI/UX, loading/empty/error/recovery/saved states, navigation, keyboard/mobile/visual behavior, API/runtime schemas, database, source/provenance and automation are unchanged; new API/browser E2E cases and fixtures are not applicable to this type-only repair. Broader parent feature statuses remain unchanged. Validation remains pending; no checks or tests were run. All pre-existing work stays uncommitted under the explicit boundary; existing HEAD `a2c53a0` is preserved.

Reusable follow-up prompt: repair only the supplied native bridge TS4058, expose the existing interface without weakening types, author compile-time regression cases, and update this task, README and TODO. Perform read-only inspection and authoring only, then return control for the parent's exact check retry.

### Assertion formatting follow-up — 2026-09-16

The latest supplied `pnpm check` failure again names only the governance browser file in Prettier output. The previous single-line review-reason call is already present. This scoped attempt moves the two initial/reset empty-event assertions to multiline `expect(...)` calls with single-line `.toHaveValue('')` suffixes. All locators, values, assertions and fixture operations are preserved. No suite report was read, and no deterministic command or commit is authorized.

Manual regression SDLC-REPAIR-013-E: run `pnpm exec prettier --check tests/e2e/cases/browser/research-governance.spec.ts`; expect exit 0 and no warnings. Manual regression SDLC-REPAIR-013-F: inspect both initial/reset assertions and confirm identical empty-string expectations and adjacent disabled-save assertions. These cases reuse the existing formatter gate and E2E-WEB-1290; whitespace introduces no new application behavior requiring another executable test. README and TODO record this follow-up. All product layers remain unchanged; dependencies, services and UI URL are not applicable. Validation is pending, and the parent owns the exact `pnpm check` retry. Report command, exit status and flagged-file diagnostics on failure. Pre-existing changes and HEAD `a2c53a0` remain untouched by commits.

### Formatting follow-up — 2026-09-16

The user supplied a subsequent `pnpm check` failure that stopped at Prettier for `tests/e2e/cases/browser/research-governance.spec.ts`. Scope is only the unnecessarily multiline `.fill(...)` argument; collapse it to the single line that fits the configured width. Preserve all E2E-WEB-1290 assertions and fixture behavior. This follow-up authorizes read-only inspection and authoring only; no report inspection, execution, commit or delegation. No new input is needed, and the existing validation-only pickup remains appropriate.

Manual regression SDLC-REPAIR-013-C: run `pnpm exec prettier --check tests/e2e/cases/browser/research-governance.spec.ts` and expect exit 0 with no formatting warnings. Manual regression SDLC-REPAIR-013-D: inspect the scoped repair and confirm only call wrapping changed, including identical review text, initial/reset selection assertions and release/history/withdrawal assertions. The existing formatter is the regression gate; no additional executable test, fixture or API/browser behavior case is warranted for whitespace alone. Existing dependencies suffice; no services, UI URL, migrations or E2E project are required. Specification/test layout and documentation apply; UI/UX, contracts, workflow, data/provenance and automation behavior are unchanged.

Implementation: manually collapsed the review-reason call. Validation remains pending; the parent owns the exact `pnpm check` retry. On failure provide the command, exit status and flagged-file diagnostics without private data. All pre-existing changes remain uncommitted; no new commit was made.

Four fetch helpers use the standard null body for bodyless requests. Funds/bonds and GDP callers omit absent optional props; factsheet plan explicitly accepts undefined because absent plan means all disclosed plans. Brief ID state is string, matching the validated contract receipt rather than the narrower randomUUID return type. Governance fallback now requires a selected revision before reading its event: two absent IDs can no longer compare equal and dereference null.

E2E-WEB-1290 now checks the initial form and resetting an opened revision to a new draft, including empty event and disabled save. Existing server-backed fixture and workflow assertions remain; no new mock, fixture, dependency, API case or schema is needed for this web-only repair. Existing E2E-WEB-1522 covers brief correction from a retained receipt. README, TODO, catalog and coverage plan record this bounded repair; parent feature completion/activation statuses are unchanged.

## Manual acceptance and handoff

- SDLC-REPAIR-013-A: `pnpm --filter @fingent360/web typecheck` must exit 0 with none of the supplied diagnostics. Existing dependencies and the contract declarations already generated by the supplied run are required; no services or UI URL needed.
- SDLC-REPAIR-013-B: Parent retries the exact failed `pnpm check`; no pass is claimed for any subsequent gate.
- E2E-WEB-1290: optional user-run `pnpm e2e:run --project=desktop --project=mobile --grep E2E-WEB-1290` with documented databases/migrations and current API/web services. Use the web origin printed by user-started `pnpm dev`, route `/#ops`; retain the existing synthetic operator fixture. Initial/new draft must render with no selected event and disabled save, while existing simulation/release/history/withdrawal still work. Keyboard/mobile/visual acceptance remains user-owned.

On failure report command, exit status and exact compiler diagnostic or selected-case assertion, with secrets/private data removed. No formatting, lint, compilation, build, tests, SDLC, install, service action, ingestion or commit was run. HEAD remains `a2c53a0`; extensive pre-existing tracked/untracked changes are preserved and left uncommitted under the explicit boundary. Remaining gap: user/parent validation of the authored changes.

## Current acceptance review — 20 September 2026

Reviewed scope: Repair web optional body/prop and receipt-ID types, prevent initial or reset null governance selection dereference, and preserve validated brief correction receipts and exact native-bridge declaration return/callback types. This bounded repair does not complete wider feature parents.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789928359149-84609.
<!-- sdlc-validation:end -->
