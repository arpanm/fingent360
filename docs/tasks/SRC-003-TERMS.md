# SRC-003-TERMS — Reviewed rights and stock-swap terms

- **Status:** Completed implementation; validation pending.
- **Scope:** Retained originals, exact rights/stock-swap terms, independent source-bound review, explicit theoretical comparisons, company reader and downloaded offline receipts.
- **Specification and implementation:** [Detailed acceptance and handoff](../../docs/development/equity-action-terms.md); [parent](SRC-003.md).
- **Data/API/UI/app:** Existing shared web/Android flow, runtime contracts, immutable source/review persistence and offline admission. Migration122 is authored, not applied.
- **Test cases:** API/browser/offline1930–1932; authored, not executed. See tests/e2e/CATALOG.md for exact IDs and synthetic-fixture boundaries.
- **Remaining:** User-run checks, selected E2E acceptance, source permission/independent publication and Android snapshot/build/reinstall. Broader parent requirements are not closed by this child.
- **Manual next action:** With PostgreSQL/MongoDB/API/web configured, apply `pnpm db:migrate`, then run the focused SDLC command in the linked handoff. Use the printed development URL; report failing ID/project and saved run/error-context.
- **Commit:** No gates or commit run; baseline `a2c53a0`. User-invoked SDLC owns the conditional commit.

## Reusable task prompt

Read AGENTS.md, this child and the parent specification. Preserve exact provenance and reviewed source admission while resolving any supplied failure in this scope. Update API/browser/offline cases and task status for code changes. Do not rerun tests, format/check, migrations, builds or commits; retain honest manual-validation status and hand off the focused user command.
