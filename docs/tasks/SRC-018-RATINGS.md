# SRC-018-RATINGS — Reviewed instrument rating originals

- **Status:** Implementation complete; validation pending
- **Scope:** Retain the exact attributed ICRA HUDCO original, three ISIN-level coupon/maturity/rating observations, independent named source review, agency-withdrawal versus editorial-withdrawal history, shared web/native reader and offline evidence.
- **Specification/source evidence:** [Corporate source record](SRC-018.md); [fund/bond parent](FUNDS-BONDS-001.md).
- **Data:** Migration125. Mongo original bytes and PostgreSQL immutable edition/review metadata. Original document hash binds the explicit verified transcription; this is not a general PDF parser.
- **Cases:** The contracts unit regression exercises both credit union branches, accepts the canonical attached row and rejects a canonical-shaped hybrid observation. API1960–1961, WEB1960–1962 and OFFLINE1960 cover the actual narrowly licensed attributed original and rejected file replacement. Authored, not executed.
- **Remaining:** Rerun the supplied `pnpm check` gate. User-run feature validation, original review/activation and Android snapshot refresh remain pending. Evaluated prices, trading liquidity and later rating surveillance are not inferred from this historical opinion.
- **Manual next action:** First run `pnpm check`; no services, migration or UI are required for this repair gate. Expect the contracts build to accept the discriminated credit branches and the focused unit regression to preserve canonical-row rejection. If it fails, report the command, exit status and first contracts diagnostic. After that gate, configure PostgreSQL/MongoDB/API/web, apply `pnpm db:migrate`, then run `pnpm sdlc "Validate instrument rating evidence" -- --grep "E2E-(API|WEB|OFFLINE)-196[012]"`. Use Operations → Corporate ratings and Funds and bonds and report ID/project plus saved run/error-context.
- **Commit:** Feature baseline `a2c53a0`; current local HEAD `a664dfd`. No gate, migration, build or commit was executed for this repair. Manual SDLC owns the gated commit.

## Reusable task prompt

Read AGENTS.md and linked acceptance. Resolve concrete issues in original retention, named review, exact ISIN/source binding, agency withdrawal or shared/offline history. Preserve ICRA attribution and opinion/date limitations; do not invent prices or treat an agency withdrawal as default. Update cases/docs/status, leaving validation and commit manual.

## 2026-09-18 scoped check repair

The supplied `pnpm check` stopped in the contracts build because the attached-credit discriminant was checked on `value.credit`, then `value.credit.observation` was read inside an `Array.find` callback. TypeScript does not preserve that dotted-property narrowing across the nested callback because the parent property could be reassigned. The refinement now captures `credit` in a local constant before narrowing and uses that stable narrowed value for the canonical lookup and comparison. Runtime policy is unchanged.

The contracts unit regression now covers the `user-description-only` bypass and the canonical attached branch in addition to rejecting a hybrid observation. No API, browser or offline case was added because this repair changes neither an external contract nor runtime workflow; the existing1960–1962 acceptance remains applicable. No dependency, database, ingestion, UI or documentation workflow change is required. Per the execution boundary, no format, lint, typecheck, build, test, SDLC, migration, service or commit was run.

## Current acceptance review — 20 September 2026

Reviewed scope: Exact attributed historical ICRA HUDCO original retention and verified ISIN-level coupon, maturity and rating transcription, independent publication, distinct agency and editorial withdrawal, source replacement denial, shared historical reader and downloaded evidence. No general PDF parser, evaluated prices, trading liquidity or ongoing surveillance. Actual source permission and activation, independent operational original review and physical-device release certification remain separate. This does not complete wider parent scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789927529684-81206.
<!-- sdlc-validation:end -->
