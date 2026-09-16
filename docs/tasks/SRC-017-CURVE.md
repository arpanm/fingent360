# SRC-017-CURVE — Retained CCIL curve originals

- **Status:** Completed initial source workflow; validation pending.
- **Scope:** Parse original static NSS parameters and inert JSON containing source-reported zero-rate points. Retain originals, dates and decimals; independently review/withdraw; browse paginated Operations/public history and downloaded offline evidence. Source labels do not establish compounding, maturity units or tradable prices.
- **Specification and primary evidence:** [Curve source research](../development/ccil-zero-curve.md); [parent](SRC-017.md).
- **Data:** Migration126, Mongo original bytes, PostgreSQL edition/review history. Separate server permission configuration defaults disabled. Snapshot exports are complete or explicitly fail, rather than omit records silently.
- **Cases:** API1970–1975, WEB1970–1971/1975 and OFFLINE1970–1971/1976. Reconstructed fixtures clearly separate original grammar/numerical facts from live acquisition. No cases executed.
- **Remaining:** Written source permission and manual validation; maturity/compounding conventions and any interpolation/valuation remain separate parent work. No securities are priced with these unverified conventions.
- **Manual next action:** Configure local PostgreSQL/MongoDB/API/web and actual `CCIL_ZERO_ENABLED`/`CCIL_ZERO_PERMISSION_REFERENCE` when permitted; run `pnpm db:migrate`, then `pnpm sdlc "Validate CCIL curve originals" -- --grep "E2E-(API|WEB|OFFLINE)-197[0-6]"`. Use Operations → CCIL NSS and Funds and bonds. Report case/project and saved run/error-context.
- **Commit:** No gates, migrations, app builds, source jobs or commit executed. Baseline `a2c53a0`; manual SDLC owns the gated commit.

## Reusable task prompt

Read AGENTS.md and linked acceptance/source evidence. Resolve concrete parser, review, pagination, shared-reader or offline-admission failures. Never evaluate source JavaScript or infer numerical conventions from bare labels. Update cases/docs/status; leave deterministic validation and commit manual.
