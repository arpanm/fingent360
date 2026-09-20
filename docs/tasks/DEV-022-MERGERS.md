# DEV-022-MERGERS — Announced mutual-fund merger lineage

- **Status:** Implementation complete; validation pending
- **Scope:** Original HDFC notices, exact admitted AMFI plan bindings, independent review and withdrawal, shared fund reader and offline lineage without invented investor conversions.
- **Specification and implementation:** [Detailed acceptance and handoff](../../docs/tasks/FUNDS-BONDS-001.md); [parent](FUNDS-BONDS-001.md).
- **Data/API/UI/app:** Existing shared web/Android flow, runtime contracts, immutable source/review persistence and offline admission. Migration119 is authored, not applied.
- **Test cases:** API/browser/offline1900–1901; authored, not executed. See tests/e2e/CATALOG.md for exact IDs and synthetic-fixture boundaries.
- **Remaining:** User-run checks, selected E2E acceptance, source permission/independent publication and Android snapshot/build/reinstall. Broader parent requirements are not closed by this child.
- **Manual next action:** With PostgreSQL/MongoDB/API/web configured, apply `pnpm db:migrate`, then run the focused SDLC command in the linked handoff. Use the printed development URL; report failing ID/project and saved run/error-context.
- **Commit:** No gates or commit run; baseline `a2c53a0`. User-invoked SDLC owns the conditional commit.

## Reusable task prompt

Read AGENTS.md, this child and the parent specification. Preserve exact provenance and reviewed source admission while resolving any supplied failure in this scope. Update API/browser/offline cases and task status for code changes. Do not rerun tests, format/check, migrations, builds or commits; retain honest manual-validation status and hand off the focused user command.

## Current acceptance review — 20 September 2026

Reviewed scope: Original HDFC merger-notice retention, exact admitted AMFI plan bindings, independent publication and withdrawal, shared fund-reader lineage and downloaded identity admission without invented investor conversions. Actual source permission and activation, independent operational original review and physical-device release certification remain separate. This does not complete wider parent scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789923079896-69469.
<!-- sdlc-validation:end -->
