# ACCOUNT-001 — Authenticated accounts and real-data watchlists

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - Implementation: Implemented
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### ACCOUNT-001 — Authenticated accounts and real-data watchlists

- **Implementation:** Implemented
- **Verification:** Not run; manual execution remains required.
- **Dependencies:** DATA-001, bounded DEV-007/017/018 implementation.
- **Request:** Continue end-to-end backlog development beyond synthetic data.
- **Scope:** Username/password registration and login, explicit storage consent, server-side expiring sessions with HttpOnly cookie, origin checks and rate limiting, persisted per-user macro watchlists, personal real-data view, logout and password-confirmed account deletion. No email/broker identity claim or production deployment.
- **Acceptance:** Register, choose real indicator subscriptions, reload, logout/login and retain choices; independent accounts cannot see each other's choices; bad login/origin/body rejects; deletion revokes sessions and removes private rows; no keys in browser storage.
- **Codex prompt:** Implement shared strict schemas, additive auth/watchlist migration, password/session/ownership services, API and React account flow with real macro data. Use asynchronous salted scrypt and hashed random sessions, bounded work, origin/CSRF checks, cookie-only private access and explicit account deletion. Author API/browser acceptance for positive/negative paths; do not run tests/migrations/services. Update README/TODO and commit locally, never push. Do not mark broader production auth or financial advice complete.

- **Delivery:** Strict account schemas; 003 migration; scrypt/Origin/session/rate-limit service and account API; account/watchlist UI; E2E-API-030/031 and E2E-WEB-030; password/origin/session unit cases. Follow docs/development/accounts.md for manual verification.
- **Remaining:** Single-use recovery, actual manually entered holdings, reminders and reading notices were subsequently implemented. MFA/households, verified equity valuation and broader material-change/external delivery remain separate parent scope. Authored end-to-end implementation is not a test-pass claim.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ACCOUNT-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Validation only
- **User input needed now:** No for the independent next step.
- **Decision:** No new feature input needed. Implementation is already recorded; do not put this in the implementation queue solely because tests are unrun. Match saved failures to this task before authoring a repair.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** User-owned SDLC/test evidence is needed for verification. The report observed during triage is incomplete; no new full run is requested.
- **Next action:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.
