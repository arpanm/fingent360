# SRC-018-RATINGS — Reviewed instrument rating originals

- **Status:** Completed initial implementation; validation pending.
- **Scope:** Retain the exact attributed ICRA HUDCO original, three ISIN-level coupon/maturity/rating observations, independent named source review, agency-withdrawal versus editorial-withdrawal history, shared web/native reader and offline evidence.
- **Specification/source evidence:** [Corporate source record](SRC-018.md); [fund/bond parent](FUNDS-BONDS-001.md).
- **Data:** Migration125. Mongo original bytes and PostgreSQL immutable edition/review metadata. Original document hash binds the explicit verified transcription; this is not a general PDF parser.
- **Cases:** API1960–1961, WEB1960–1962 and OFFLINE1960, including the actual narrowly licensed attributed original and rejected file replacement. Authored, not executed.
- **Remaining:** User-run validation, original review/activation and Android snapshot refresh. Evaluated prices, trading liquidity and later rating surveillance are not inferred from this historical opinion.
- **Manual next action:** Configure PostgreSQL/MongoDB/API/web, apply `pnpm db:migrate`, then `pnpm sdlc "Validate instrument rating evidence" -- --grep "E2E-(API|WEB|OFFLINE)-196[012]"`. Use Operations → Corporate ratings and Funds and bonds. Report ID/project plus saved run/error-context.
- **Commit:** Baseline `a2c53a0`; no gates, migrations, builds or commit executed. Manual SDLC owns the gated commit.

## Reusable task prompt

Read AGENTS.md and linked acceptance. Resolve concrete issues in original retention, named review, exact ISIN/source binding, agency withdrawal or shared/offline history. Preserve ICRA attribution and opinion/date limitations; do not invent prices or treat an agency withdrawal as default. Update cases/docs/status, leaving validation and commit manual.
