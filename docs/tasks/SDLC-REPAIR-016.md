# SDLC-REPAIR-016 — Repair failures from the complete validation inventory

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** Confirmed root-cause repairs authored for all119 failed case/project pairs in run1789752953639-97020. Eight production files and affected real API/browser/offline fixtures/assertions updated; [RCA and ownership](../development/full-audit-2026-09-19.md).
- **Pending:** User-run format/check and selected acceptance; authored fixes are not passing evidence. Broader functional/native/source acceptance is unchanged.
- **Next action / inputs:** User runs the scoped SDLC command below with existing migrated services. Preserve generated failed bug statuses until passing user-run evidence exists.
- **Verification:** Saved failed run inspected; no agent execution.

## Specification and acceptance

Use the connected 06-pnpm-e2e_run.log and offline 08-pnpm-android_test.log in artifacts/sdlc/1789752953639-97020, including saved error contexts. Group failures by demonstrated root cause and fix the underlying API/UI/parser logic or stale fixtures as appropriate. Do not disable strict schemas, replace actual API flows with mocks, increase timeouts indiscriminately, skip cases or claim tests passed. Parallel ownership: API/shared helpers, browser/UI, offline calendars/navigation, and offline event graphs/Cleveland parser. Reconcile overlapping edits before handoff.

Web and Android share the corrected web UI/contracts; offline handlers and snapshot cases remain separate. DB schema changes are not required for fixtures that violate existing encryption constraints. Real-source parsing must accept only observed presentation fields and preserve value/vintage semantics. Record any genuine data model/migration need before introducing it.

## Reusable task prompt

Read AGENTS.md and the saved failure artifacts. Fix every confirmed failure group in the cited run, keeping existing safety and data provenance assertions. Author regression cases and record each cause, changed files and exact failed-case rerun selection. Update this record, affected task links, TODO, README and E2E catalogue. Do not execute format/check/tests/build/services/migrations or commit; the user owns pnpm sdlc. Unresolved bugs stay open until recorded passing validation.

## Scoped manual retry

The reviewed SDLC-REPAIR-016 acceptance matrix lists the119 case/project failures from this saved full run plus API360, the storage-classification companion to API359. Run `SDLC_AUTO_REPAIR=0 pnpm sdlc "Repair full audit failures" --story SDLC-REPAIR-016` after the authored repairs. This preserves full format/check gates, runs the failed connected IDs on their configured projects and rebuilds/tests only the failed offline IDs. No full-suite rerun is required for this repair handoff. The existing per-case recorder updates associated functional-story evidence and unresolved bugs. This repair matrix is not a replacement for each functional story's complete acceptance matrix.
