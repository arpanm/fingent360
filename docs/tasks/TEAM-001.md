# TEAM-001 — Parallel end-to-end backlog delivery

- **Status:** Archived coordination
- **Implemented / recorded:** - Implementation: Implemented for the seven bounded child tasks listed below. User requests a parallel agent team and end-to-end delivery; prior explicit test authorization retained for integration verification. No push.
- **Pending:** This is a historical batch record; child task statuses own any remaining work.
- **Next action / inputs:** Use linked child tasks for remaining work; do not restart this batch as a new feature.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### TEAM-001 — Parallel end-to-end backlog delivery

- **Implementation:** Implemented for the seven bounded child tasks listed below. User requests a parallel agent team and end-to-end delivery; prior explicit test authorization retained for integration verification. No push.
- **Scope:** Independent, ungated account goals, privacy/session controls and operational source registry; shared integration, additive migrations, regression tests and documentation. Broad parent roadmap items remain open when their full scope or external approvals are not delivered.
- **GOALS-001 (DEV-009):** Persist authenticated account-owned repeatable financial goals, exact amounts, visible/versioned assumptions, CRUD UI and ownership/conflict tests. Prompt: deliver contracts → additive migration 005 → API → responsive Goals UI → API/browser cases and docs. No invented returns or investment recommendations. Implemented.
- **PRIVACY-001 (DEV-017):** Own-data JSON export and session listing/revocation, with Origin checks and no secrets in exports. Prompt: implement safe session identifiers/additive migration 006, authenticated API and UI, cross-account/session tests and docs. Preserve account deletion and consent history. Implemented.
- **SOURCES-001 (DEV-005/015/016):** Persist operator-managed source metadata, rights review status and revision history with public approved metadata. Prompt: strict contracts → migration 007 → authorized API → public/operator UI → regression tests and docs. No fetching arbitrary URLs or invented rights approval. Implemented.
- **Acceptance:** All three slices work through real database/API/UI; no mock-only completion. Integration tests pass, migrations preserve existing records, TODO/README/catalog/status agree, scoped local commit after format/check gates. External provider onboarding and regulated-advice gates remain explicit.
- **MIGRATIONS-001 (DEV-004):** Track applied SQL filenames and checksums under the existing advisory transaction lock. Prompt: bootstrap the ledger using existing idempotent SQL, skip unchanged migrations, reject edited applied migrations and retain atomic rollback. Add regression tests and verify repeat application preserves records. Implemented.
- **ALERT-002 (DEV-018):** Persist account-owned indicator mute preferences and integrate actual inbox filtering/unmute restoration without deleting evidence or receipts. Prompt: contracts/migration008/API/UI, ownership and not-followed rejection, real inbox tests and privacy export integration. Implemented.
- **PORTFOLIO-001 (DEV-007/008):** Account-owned, user-entered Indian-equity holdings with exact quantities/cost basis and strict CSV preview/confirmation, independent of fictional virtual exercise. Prompt: contracts/migration009/API/UI, revision conflicts, validation/isolation/persistence tests and privacy export. No live valuations or verified-source claims. Implemented.
- **PWA-001 (DEV-012):** Manifest, browser-supported install control and neutral offline fallback. Prompt: never cache API/private app HTML or data; cache only neutral offline assets, test offline navigation and no cached API behavior, document browser-dependent installation. Implemented; verified in the full run below.

- **Verified delivery:** Three parallel agents plus parent integration delivered GOALS-001, PRIVACY-001, SOURCES-001, ALERT-002, PORTFOLIO-001, PWA-001 and MIGRATIONS-001. Full E2E run `2026-09-12T16-09-40-894Z-64656`: 51 passed, zero failed, one explicit outage skip (E2E-API-004); 19 new E2E cases/project executions. Format/check passed with 40 unit tests; final documentation formatting/check gate runs before commit. Migrations001–009 applied twice, ledger contains all nine filenames. No dependencies installed or Git push performed.
- **Integration fixes:** Safe malformed-money validation (400 instead of 500), feature-scoped status locators, explicit holdings textarea label, and saved goals route #my-goals preserving virtual #goals. Repeated test runs exhausted the unchanged auth rate limit; final full pass used a fresh dev session. Stopped the confirmed legacy repo watcher that reread .env and stole its port; current app http://127.0.0.1:5175, API4103.
- **Remaining:** These children do not complete all parent scopes. Wider market adapters, verified pricing/valuation, platform-specific broker parsers, production hardening and broader accessibility remain unimplemented. Regulated advice/provider rights/broker entitlements have external gates; later assets/channels remain sequenced. No claims of live valuations, approved external integrations or full-backlog completion.
- **Next actions:** Review the running app through My goals/My holdings/Privacy/Source registry and inbox preferences. Optional repeat: pnpm sdlc "Review parallel delivery"; reopen E2E UI for current ports and keep watch mode off. Evidence is artifacts/e2e/latest.md.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on TEAM-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.
