# SDLC-REPAIR-009 — Formatter syntax failures

- **Status:** Completed implementation; manual validation pending.
- **Implemented:** Restored the closing JSX expression brace after the older-page button in CPI and GDP operations, closed the conditional fragment in WhatsApp scheduling, and removed an extra parenthesis from the invalid-unit EIA offline assertion.
- **Pending:** Parent/user retry of the exact failed formatting command. No passing validation is claimed.
- **Next action / inputs:** Parent retries `pnpm format`; if it fails, retain the exact file, location and diagnostic from this command.
- **Verification:** Read-only inspection only. Saved format log `artifacts/sdlc/1789526568080-8379/01-pnpm-format.log` matches the supplied output tail and contains these four parser errors. No whole-suite report inspected.

## Specification and acceptance

Input recorded 2026-09-16: user supplied `pnpm format`, exit 2, and explicitly restricted this attempt to authoring/read-only inspection, no execution, commit or delegation. Pickup queue permits diagnosis of supplied failures; unrelated validation-only tasks remain untouched.

Repair only the four syntax errors identified in this invocation. Preserve pagination conditions, handlers, consent gates, source validation and every test assertion. No dependency, fixture, API/contract, database, provenance or automation change is needed. UI/UX behavior is unchanged; existing connected cases retain keyboard/mobile/visual acceptance responsibility. New product behavior and new API cases are not applicable to delimiter repairs.

## Regression acceptance (authored, not run)

- **SDLC-REPAIR-009-A:** `pnpm format` exits 0 without parser errors for the four repaired files. Existing formatter configuration and exclusions stay unchanged.
- **SDLC-REPAIR-009-B:** Review the CPI/GDP JSX: the older-page button alone is conditional on `nextCursor`; loading, error and notice states remain independent. Existing E2E-WEB-1672 and E2E-WEB-1622 remain unchanged.
- **SDLC-REPAIR-009-C:** Review WhatsApp JSX: saved schedule, form, controls and occurrence list remain inside the `value` conditional fragment, which closes before the section. Existing E2E-WEB-1690 remains unchanged.
- **SDLC-REPAIR-009-D:** E2E-OFFLINE-1940 still calls the actual offline handler and requires status 503 for a receipt with USD-per-gallon units, 404 for undownloaded history and 503 for mutation. No rejection assertion removed or weakened.

These manual regression scenarios target parser structure without adding a test that duplicates the compiler. Catalog and coverage plan link this acceptance. Runtime E2E execution is not required for the exact formatter retry and is not claimed complete.

## Handoff

Smallest exact failed-command retry: `pnpm format`. Existing installed dependencies suffice; no install, services, migration, UI URL, E2E project or tag is required for formatting. Formatting, lint, types, builds, tests and SDLC were not run. No commit created; existing HEAD is `a2c53a0`. Extensive pre-existing modified/untracked work is preserved and left uncommitted under the explicit boundary.

## Reusable task prompt

Read AGENTS.md and this record. Repair only parser diagnostics from the supplied format invocation. Inspect its format log only, preserve assertions and unrelated changes, and document focused regression acceptance. Do not run validation, services, ingestion, commits, agents or follow-ups. Do not infer success from the edits.
