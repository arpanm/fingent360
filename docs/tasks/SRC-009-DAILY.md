# SRC-009-DAILY — Daily WTI and Brent observations

- **Status:** Completed implementation; validation pending.
- **Scope:** Verified original EIA daily HTML grammar, USD/barrel cells and explicit missing observations, immutable captures, contributor-permission gate, independent review, shared daily history and offline snapshot. Scheduled acquisition creates drafts; it does not publish automatically.
- **Specification/source evidence:** [Daily-source handoff](../development/eia-daily-spot.md); [parent](SRC-009.md).
- **Data:** Migration123 creates source/review/gate records and a disabled source schedule. Original HTML retained in MongoDB. No source or service was activated.
- **Cases:** API1940–1942, WEB1940/1943, OFFLINE1940. WEB1943 adds selected-edition URL, Back, exact retry and focus behavior. Upstream or failed transport is explicitly simulated; retained API/database review paths are actual test code, not executed evidence.
- **Remaining:** Actual contributor permission, user-run validation and source activation. Retained daily editions do not constitute a complete historical archive.
- **Manual next action:** With PostgreSQL/MongoDB/API/web configured, apply `pnpm db:migrate`, then `pnpm sdlc "Validate daily oil observations" -- --grep "E2E-(API|WEB|OFFLINE)-194[0-3]"`. Use More → Daily oil observations and Operations → Daily oil source. Report case/project, saved run directory and assertion/error-context.
- **Verification/commit:** No checks, tests, migrations, provider jobs, app builds or commits executed. Baseline `a2c53a0`; manual SDLC owns conditional commit.

## Reusable task prompt

Read AGENTS.md and linked acceptance/source evidence. Resolve concrete failures in original parsing, permissions, independent publication, scheduled draft capture or shared/offline history. Preserve daily frequency, source dates, missing cells and contributor rights. Update cases/docs/status without executing gates or claiming activation.

## Current acceptance review — 20 September 2026

Reviewed scope: Verified EIA daily WTI and Brent HTML cells and missing observations, original retention, contributor permission gate, independent review, bounded scheduled drafts with permission re-admission, exact transport limits, edition history, selected-edition retry and Back navigation, and downloaded admission. No complete historical archive or live quotation claim. Actual source permission and activation, independent operational original review and physical-device release certification remain separate. This does not complete wider parent scope.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.
