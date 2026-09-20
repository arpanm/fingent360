# SDLC-REPAIR-011 — Contracts compiler repair

- **Status:** Implementation complete; validation pending
- **Implemented:** Removed invalid Zod shape members, validated action purpose at parsing, widened the SBI row counter, and extended E2E-API-1982, E2E-API-1530 and E2E-OFFLINE-1340.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** No deterministic commands run.

## Specification and dated input

2026-09-16: user supplied `pnpm check`, exit 2, with three contracts compiler diagnostics. Supplied evidence says formatting and lint completed before compilation stopped; this does not verify subsequent edits. The user authorizes only read-only inspection and authoring, prohibits commits/delegation/execution, and restricts this attempt to the supplied failure. No suite report is read and no private input or question is needed. Existing pickup/input records do not override this boundary.

Remove raw corporate-rating constants accidentally included as Zod shape members, validate the action parser's purpose as a string at its boundary, and explicitly type the incrementing SBI row counter as number. Preserve provenance literals, strict unknown-key rejection, source layout boundaries, reconciliation and exact calculations. Dependencies are the existing contracts and synthetic E2E fixtures; no new dependencies are needed.

## Acceptance and layers

- **SDLC-REPAIR-011-A:** Contracts compilation has none of the three supplied diagnostics; no casts, rule suppression or relaxed schemas hide the errors.
- **SDLC-REPAIR-011-B:** Existing bond receipt reconstruction accepts the intended historical credit payload and rejects injected constant-named fields as unknown keys, retaining source tamper rejection.
- **SDLC-REPAIR-011-C:** Existing synthetic normalization workflow still calculates the bonus; an absent purpose column fails closed at the parser boundary.
- **SDLC-REPAIR-011-D:** Existing synthetic SBI workbook yields derivative rows161,162,164,165,166, skips the verified heading163 and retains total50.00.

API/contracts, parser functionality and regression documentation are affected. UI/UX/navigation/loading/error/saved states, keyboard/mobile/visual behavior, database, automation and provider ingestion are unchanged and require no new implementation. Existing end-to-end paths remain the coverage basis; synthetic fixtures are not market evidence. Broader FUNDS-BONDS-001, SRC-016, SRC-018 and EQUITY-COVERAGE-001 acceptance remains pending.

## Manual validation and remaining work

Smallest diagnostic command: `pnpm --filter @fingent360/contracts typecheck`. Expected exit0 with the supplied diagnostics absent. Parent retries exactly `pnpm check`; no SDLC invocation is requested by this repair. Existing installed dependencies suffice; no services, migrations or UI URL are required for the diagnostic command. Runtime regressions remain unrun. On failure report command, exit status and scoped file/line diagnostics. No test pass is claimed.

HEAD is `a2c53a0`. Extensive pre-existing tracked and untracked work remains uncommitted and preserved under the explicit boundary; no commit or push is permitted.

## Reusable prompt

Read AGENTS.md and this record. Repair only the supplied bond-evidence schema, action-purpose optionality and SBI counter type errors. Preserve strict source admission and all assertions; extend the existing real parser/receipt regression paths. Update README, TODO and coverage documentation. Do not run validation, read whole-suite reports, commit, delegate, schedule work or start a retry loop.

## Formatting follow-up — 2026-09-16

The next user-supplied `pnpm check` failure stopped at Prettier for `tests/e2e/cases/offline/equity-adjustments.spec.ts`. This attempt is limited to that warning. The CSV extraction chain places the property access on the initial call line instead of grouping it with the following split call. Manually adjust that wrapping only; preserve the sparse-purpose rejection, normalization, changed-binding rejection and connected-Operations assertions in E2E-OFFLINE-1340 (`@EQUITY-COVERAGE-001`, `@TEST-SIMULATION`). No report or unrelated failure is needed to explain this warning.

Manual regression acceptance:

- **SDLC-REPAIR-011-E:** Run `pnpm exec prettier --check tests/e2e/cases/offline/equity-adjustments.spec.ts`; expect exit 0 and no formatting warning.
- **SDLC-REPAIR-011-F:** Review the scoped source edit: only the chain's line break changes; fixture values, parser calls and every assertion remain identical. Existing runtime coverage is retained; no new executable behavior test is needed for whitespace.

Implementation: chain wrapping authored; README and TODO updated. Verification remains pending; no formatter, lint, typecheck, build, test or SDLC command was run. No dependencies changed; installed repository dependencies suffice. Services, migrations, UI URL and browser/mobile/keyboard acceptance are not applicable to this formatting-only change. API/contracts, database, provenance, automation and application workflow are unchanged. Parent compilation and runtime regression acceptance remain open.

The parent retries `pnpm check`. If validation fails, report the exact command, exit status and flagged-file diagnostics. No commit was made; HEAD remains `a2c53a0`, with pre-existing work preserved uncommitted. Follow-up prompt: repair only the supplied formatting warning, preserve behavior and all assertions, update this record and its README/TODO references, and leave all execution to the user/parent.

## Current acceptance review — 20 September 2026

Reviewed scope: Repair contracts compiler boundaries without permissive casts or weakened schemas: historical credit receipt strict unknown-field rejection, action purpose validation, exact SBI derivative row parsing and offline normalization source-binding admission. This bounded repair does not complete wider feature parents.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926419995-75587.
<!-- sdlc-validation:end -->
