# READER-DIAGNOSTICS-001 — Diagnose public-reader transaction failures safely

- **Status:** Done (accepted scope)
- **Implemented:** Correlated fixed-category/phase diagnostics now cover public reader transactions; safe incident references reach the failing API120 assertion. API1250 authors actual missing capture-table failure, restore and idempotent retry.
- **Pending:** None for the reviewed acceptance scope; native release certification remains separate.
- **Next action / inputs:** No further action for this accepted scope.
- **Verification:** Not run. Saved API120 run1789453542513-64097e49-6063-45b6-804f-2c60dcbfcc2e confirms503, not its underlying SQLSTATE.

## Specification

Keep successful public response unchanged and mandatory saved-view capture intact. On non-HTTP transaction failure, rollback and return a generic503 with an incident reference and fixed non-sensitive category/phase fields for the test handoff. Log only fixed operation/phase, sanitized SQLSTATE/category and that reference; never raw messages, SQL, URLs, parameters, account data or source content. Add missing-relation fault/recovery case in an isolated fixture and sanitizer unit assertions. No migration or UI layout required; existing reader error/retry path handles503. Underlying external/local failure remains unresolved until actual evidence is available.

## Current acceptance review — 20 September 2026

Reviewed scope: Fixed safe transaction phase/category/incident diagnostics, missing-table fault/recovery and unchanged successful public reader/capture behavior. API120 companion must verify the originally observed reader journey; diagnostics alone do not establish the historical SQL failure cause. Completion applies only to this bounded child.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Passed — automated acceptance. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: final-scoped-1789857073654.
<!-- sdlc-validation:end -->
