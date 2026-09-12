# DEV-001 manual requirements review

Status: authored, not executed. This is a document review pack; no new runnable browser/API placeholders are added. Review alongside docs/product/first-slice-prd.md and docs/data-dictionary/canonical-model.md. Convert each applicable case to executable tests when its linked delivery tasks implement the behavior.

| ID | Preconditions / review action | Expected requirement | Trace |
| --- | --- | --- | --- |
| DOC-001 | Read personas and scope | Generic versus private context, India-equity/INR slice, educational boundary and deferred channels explicit | PRD outcome; SCR-01/02 |
| DOC-002 | Trace public home → event → company → source | Stable canonical links, supported source locator and dates, fact/scenario distinction | PRD-01/03/04/05 |
| DOC-003 | Consider fewer than six eligible events | No fabricated padding, no stale item treated current; actual count shown | PRD-01 |
| DOC-004 | Consider personal home without holdings/goals | Setup/unavailable states, never false zero exposure or inferred goals | PRD-02/06/08 |
| DOC-005 | Review every screen under empty/error/stale/conflict/partial states | Clear reason, safe retry/correction and blocked assessment where required | Shared states, PRD-09/12 |
| DOC-006 | Trace upload → preview → correction → confirm, then replay confirm | No preview mutation, no duplicate snapshot, unresolved/totals issues explicit | PRD-07/14; ImportBatch/Reconciliation |
| DOC-007 | Create two same-type goals; allocate one holding across both | Distinct goal IDs; allocations at most 100%; remainder explicit | PRD-08; GoalAllocation |
| DOC-008 | Read synthetic oil fixture and calculate exposure by hand | 2,000 total; 1,000 direct exposure; 50%; 400/600 split; exposure is not loss | FIX-OIL-001 |
| DOC-009 | Apply two causal paths to one holding | Total affected exposure counts the holding once | PRD-15; ExposureResult |
| DOC-010 | Compare current, stale, conflicting and revised inputs | Unable-to-assess distinct from no-review; original issued record reconstructible | PRD-09/13; ReviewResult |
| DOC-011 | Review money/units and test boundary examples in design | Decimal strings, currency, precision, zero denominator, unsupported FX, percentage-point distinction | Model common types/invariants |
| DOC-012 | Trace publication/effective/retrieval/known times | Vintage preserved; no future revision leaks into historical evaluation | Observation/Evidence |
| DOC-013 | Consider missing cost, consensus and success model | Each unavailable; no invented zeros, surprise or probability | PRD-04/05/08 |
| DOC-014 | Inspect privacy/keyboard/mobile requirements | Owner checks, no private offline caching, no OTP fields, keyboard/focus and 390px behavior | PRD-10/11/12 |
| DOC-015 | Review open decisions and deliverable mapping | Policy/rights/auth thresholds remain explicit dependencies; no claim the features already exist | PRD decisions; model implementation mapping |

User records pass/fail and specific omissions by DOC ID in the DEV-001 handoff. There is no need to start application services for this review. `pnpm format` is an optional manual formatting step after source edits; full code tests do not establish that these product requirements are accepted.
