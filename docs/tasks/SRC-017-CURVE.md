# SRC-017-CURVE — Retained CCIL curve originals

- **Status:** Implementation complete; validation pending
- **Scope:** Parse original static NSS parameters and inert JSON containing source-reported zero-rate points. Retain originals, dates and decimals; independently review/withdraw; browse paginated Operations/public history and downloaded offline evidence. Source labels do not establish compounding, maturity units or tradable prices.
- **Specification and primary evidence:** [Curve source research](../development/ccil-zero-curve.md); [parent](SRC-017.md).
- **Data:** Migration126, Mongo original bytes, PostgreSQL edition/review history. Separate server permission configuration defaults disabled. Snapshot exports are complete or explicitly fail, rather than omit records silently.
- **Cases:** API1970–1975, WEB1970–1971/1975 and OFFLINE1970–1971/1976. Reconstructed fixtures clearly separate original grammar/numerical facts from live acquisition. No cases executed.
- **Remaining:** Written source permission and manual validation; maturity/compounding conventions and any interpolation/valuation remain separate parent work. No securities are priced with these unverified conventions.
- **Manual next action:** Configure local PostgreSQL/MongoDB/API/web and actual `CCIL_ZERO_ENABLED`/`CCIL_ZERO_PERMISSION_REFERENCE` when permitted; run `pnpm db:migrate`, then `pnpm sdlc "Validate CCIL curve originals" -- --grep "E2E-(API|WEB|OFFLINE)-197[0-6]"`. Use Operations → CCIL NSS and Funds and bonds. Report case/project and saved run/error-context.
- **Commit:** No gates, migrations, app builds, source jobs or commit executed. Baseline `a2c53a0`; manual SDLC owns the gated commit.

## Reusable task prompt

Read AGENTS.md and linked acceptance/source evidence. Resolve concrete parser, review, pagination, shared-reader or offline-admission failures. Never evaluate source JavaScript or infer numerical conventions from bare labels. Update cases/docs/status; leave deterministic validation and commit manual.

## Current acceptance review — 20 September 2026

Reviewed scope: Retained CCIL static NSS parameters and inert JSON source-reported zero-rate points, exact original labels and dates, default-disabled permission admission, independent publication and withdrawal, exact decoded-byte transport bounds, paginated Operations and public history and complete-or-error downloaded snapshots. Unknown maturity and compounding conventions remain explicit; no interpolation, valuation or tradable-price claim. Actual source permission and activation, independent operational original review and physical-device release certification remain separate. This does not complete wider parent scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789927529684-81206.
<!-- sdlc-validation:end -->
