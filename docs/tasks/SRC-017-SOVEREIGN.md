# SRC-017-SOVEREIGN — Historical sovereign auction settlement

- **Status:** Implementation complete; validation pending
- **Scope:** Retain four original security/issue/auction/convention documents; independent named review binds the exact originals and terms version. Shared web/native reader calculates historical clean, accrued and dirty consideration with transparent assumptions. Downloaded reviews enable the same offline calculation.
- **Specification, sources and implementation:** [Parent source record](SRC-017.md); [fund/bond acceptance](FUNDS-BONDS-001.md).
- **Data:** Migration121; original bytes in existing Mongo raw store, canonical editions and append-only review receipts in PostgreSQL. Calculation is transient and creates no holding.
- **Cases:** API1920–1921, WEB1920–1921 and OFFLINE1920; explicit synthetic document envelopes exercise workflow, not semantic PDF extraction. Source terms were independently researched, but execution is pending.
- **Remaining:** Manual validation, actual original-pack review/source activation and refreshed Android snapshot/build. Current secondary quotes, broader zero curves and corporate credit/liquidity remain separate parent gaps.
- **Manual next action:** With local PostgreSQL/MongoDB configured, run `pnpm db:migrate`, restart API/web if needed, then `pnpm sdlc "Validate historical sovereign settlement" -- --grep "E2E-(API|WEB|OFFLINE)-192[01]"`. At the printed development URL, use Operations → Sovereign bonds and Funds and bonds → historical sovereign reader. Report case/project, saved run directory and assertion/error-context for failures.
- **Verification/commit:** No gates, migrations, app rebuild or commit executed. Baseline `a2c53a0`; the manual SDLC command owns conditional commit.

## Reusable task prompt

Read AGENTS.md and the linked parent/specification. Resolve concrete failures in source-pack retention, source-version review, historical arithmetic, shared UI or offline admission. Never treat an envelope check as proof of document meaning or a historical auction as a current quote. Update contracts, cases and docs when behavior changes; leave deterministic execution and conditional commit to the user.

## Current acceptance review — 20 September 2026

Reviewed scope: Four-original historical sovereign security, issue, auction and convention pack, independently reviewed exact terms version, explicit historical clean, accrued and dirty consideration, file replacement and consent recovery, withdrawal and equivalent downloaded calculation. No current secondary quote or semantic PDF-parser claim. Actual source permission and activation, independent operational original review and physical-device release certification remain separate. This does not complete wider parent scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926953092-78982.
<!-- sdlc-validation:end -->
