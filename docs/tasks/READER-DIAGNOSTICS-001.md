# READER-DIAGNOSTICS-001 — Diagnose public-reader transaction failures safely

- **Status:** Completed implementation; validation pending
- **Implemented:** Correlated fixed-category/phase diagnostics now cover public reader transactions; safe incident references reach the failing API120 assertion. API1250 authors actual missing capture-table failure, restore and idempotent retry.
- **Pending:** User-run validation; the original API120 cause remains unknown until a new safe diagnostic is returned.
- **Next action / inputs:** User runs the scoped diagnostic case, then API120 if needed; report incident/category/phase, never raw private SQL or source content.
- **Verification:** Not run. Saved API120 run1789453542513-64097e49-6063-45b6-804f-2c60dcbfcc2e confirms503, not its underlying SQLSTATE.

## Specification

Keep successful public response unchanged and mandatory saved-view capture intact. On non-HTTP transaction failure, rollback and return a generic503 with an incident reference and fixed non-sensitive category/phase fields for the test handoff. Log only fixed operation/phase, sanitized SQLSTATE/category and that reference; never raw messages, SQL, URLs, parameters, account data or source content. Add missing-relation fault/recovery case in an isolated fixture and sanitizer unit assertions. No migration or UI layout required; existing reader error/retry path handles503. Underlying external/local failure remains unresolved until actual evidence is available.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789722425545-83879.
<!-- sdlc-validation:end -->
