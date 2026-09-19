# RESEARCH-WORKER-ISOLATION-001 — Intermittent filing schedule test under shared worker lock

- **Status:** Open investigation — intermittent test failure
- **Implemented / recorded:** API2002 failed its second scheduled tick with expected1 fetched report and actual0 in the complete run, then passed unchanged in the scoped retry at the same source fingerprint.
- **Pending:** Establish which scheduler early-return branch occurred and make the isolated regression deterministic without hiding acquisition, permission or database failures.
- **Next action / inputs:** Agent-ready. Inspect real tick outcome/lock ownership; do not rerun the whole suite or retry every error until it passes.
- **Verification:** Failure: SDLC1789852776002-50046, filing-discovery.spec.ts185. Strict passing retry: artifacts/e2e/2026-09-19T22-31-13-940Z-56957/results.json. Read-only diagnostic artifacts/sdlc/final-scoped-1789857073654/advisory-lock-observation.jsonl contains259 samples and two samples with one lock-holder PID; it was collected during the passing retry, not the original failure. Sampling cannot prove or exclude earlier contention. No source/test change was made for the retry.

## Specification and reusable prompt

The research worker intentionally skips ticks when its database-wide advisory key360954 is held; schema-isolated test fixtures share that database with the normal worker. This is a concrete contention opportunity, not yet proof of the failed branch. PostgreSQL next_at comparison retains native timestamp precision; no precision fix is justified by the saved trace. Read actual failure and prior passing receipts, inspect ResearchAutoStore.tick and the filing-watch helper, and expose a safe explicit outcome if required. If a bounded fixture retry is used, allow it only for an evidenced lock-busy outcome, not no-due, acquisition, permission, storage or publication failures. Preserve two real RSS fetches, deduplication and permission-change denial. No UI/database migration or live-source activation is implied. Author unit/E2E diagnostics and update this task and TODO; preserve the original failure and do not call an unchanged passing retry a root-cause fix.
