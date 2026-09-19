# XLSX-001 — Spreadsheet workbook imports

- **Status:** Done (recorded scope)
- **Implemented / recorded:** - XLSX-001 (DEV-008/SRC-013): Implemented and integration verified for the standard format. Standard workbook import through the same exact preview/reconcile/confirm workflow as CSV, on server/web/device. This does not onboard arbitrary broker dialects or validate market prices. Prompt: specify a small downloadable Holdings-sheet template with isin,quantity,total_cost_paise and explicit format/limits; preserve lexical decimal strings, reject formulas/dates/scientific or ambiguous numeric for
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

Status reconciliation (2026-09-16): Done refers to the previously recorded bounded delivery, not fresh validation of the current working tree. No new implementation or test pass is claimed.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **XLSX-001 (DEV-008/SRC-013): Implemented and integration verified for the standard format.** Standard workbook import through the same exact preview/reconcile/confirm workflow as CSV, on server/web/device. This does not onboard arbitrary broker dialects or validate market prices. Prompt: specify a small downloadable Holdings-sheet template with isin,quantity,total_cost_paise and explicit format/limits; preserve lexical decimal strings, reject formulas/dates/scientific or ambiguous numeric formats, duplicates and unsupported sheets. Use a maintained pinned shared ZIP/XML approach (candidate fflate0.8.3/fast-xml-parser5.11.1, verify exact dependencies during parent install), inspect ZIP structure/CRC/bounds and reject encryption/macros/external relationships/DTD/entities; cap compressed/decompressed entries/cells/strings and bound decoding work. Explain stock inflater allocation limits honestly and use bounded chunks/isolated workers/deadlines as required. Implement real API validation and local parser parity, downloadable blank/synthetic template, choose file → inspect errors → declared-total reconciliation → owned persisted preview → consent/confirmation → reload/history/export; raw workbook bytes are not retained. Add versioned import provenance without changing old revisions; use existing JSON storage where suitable. All failures preserve existing holdings/drafts. Meaningful hostile/corrupt/precision/oversize/ownership/conflict/replay and desktop/mobile/offline cases; dependencies/lockfile and docs are part of gated commit. IDs API240–249, WEB240–249, OFFLINE290–299. Source-specific five-platform onboarding remains open.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on XLSX-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789847795826-40501.
<!-- sdlc-validation:end -->
