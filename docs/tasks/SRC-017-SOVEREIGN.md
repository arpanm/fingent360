# SRC-017-SOVEREIGN — Historical sovereign auction settlement

- **Status:** Completed implementation; validation pending.
- **Scope:** Retain four original security/issue/auction/convention documents; independent named review binds the exact originals and terms version. Shared web/native reader calculates historical clean, accrued and dirty consideration with transparent assumptions. Downloaded reviews enable the same offline calculation.
- **Specification, sources and implementation:** [Parent source record](SRC-017.md); [fund/bond acceptance](FUNDS-BONDS-001.md).
- **Data:** Migration121; original bytes in existing Mongo raw store, canonical editions and append-only review receipts in PostgreSQL. Calculation is transient and creates no holding.
- **Cases:** API1920–1921, WEB1920–1921 and OFFLINE1920; explicit synthetic document envelopes exercise workflow, not semantic PDF extraction. Source terms were independently researched, but execution is pending.
- **Remaining:** Manual validation, actual original-pack review/source activation and refreshed Android snapshot/build. Current secondary quotes, broader zero curves and corporate credit/liquidity remain separate parent gaps.
- **Manual next action:** With local PostgreSQL/MongoDB configured, run `pnpm db:migrate`, restart API/web if needed, then `pnpm sdlc "Validate historical sovereign settlement" -- --grep "E2E-(API|WEB|OFFLINE)-192[01]"`. At the printed development URL, use Operations → Sovereign bonds and Funds and bonds → historical sovereign reader. Report case/project, saved run directory and assertion/error-context for failures.
- **Verification/commit:** No gates, migrations, app rebuild or commit executed. Baseline `a2c53a0`; the manual SDLC command owns conditional commit.

## Reusable task prompt

Read AGENTS.md and the linked parent/specification. Resolve concrete failures in source-pack retention, source-version review, historical arithmetic, shared UI or offline admission. Never treat an envelope check as proof of document meaning or a historical auction as a current quote. Update contracts, cases and docs when behavior changes; leave deterministic execution and conditional commit to the user.
