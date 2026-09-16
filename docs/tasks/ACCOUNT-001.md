# ACCOUNT-001 — Authenticated accounts and real-data watchlists

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented
- **Pending:** User/parent validates the password-salt getter lint repair and existing deletion admission regressions; implementation is not a test pass.
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

## Scoped repair — 2026-09-16

- **Input:** User-supplied `pnpm check` failure at 09:38:59: account deletion owner-budget unit case expected429 but received401. Only this failure is in scope; no suite report inspected.
- **Cause:** The old fixture overrides `require()` and passes `fixture-cookie`. Deletion now uses raw `find(..., false)` to authenticate without decrypting identity; the real cookie parser correctly rejects that cookie before owner admission.
- **Specification:** Repair the existing unit fixture at its database boundary, preserving real deletion, session parsing, session lookup and owner rate limiting. Assert two authenticated lookups around the owner lock,429 before password access, and401 for malformed/revoked sessions before consuming owner attempts.
- **Layers:** Test harness and documentation only. Production API/contracts, database schema, UI/UX (including keyboard/mobile/visual states), automation and source ingestion are unchanged; no new product behavior or E2E case is required. Synthetic account/session data only.
- **Reusable repair prompt:** Read this record and the supplied failure. Remove the obsolete authentication override; use a valid synthetic cookie and strict query fixture to exercise real authentication. Preserve the429 assertion and add malformed-cookie/post-lock revocation regressions. Do not execute validation or commit; preserve all other working-tree changes.
- **Implemented:** Removed the obsolete require override; strict synthetic storage responses now exercise real session admission. Authored exhausted-budget, malformed-cookie and post-lock revocation assertions. Validation remains pending.
- **Verification:** Not run. Parent script owns the exact check retry. No dependencies, services, migrations or UI URL needed for these unit cases; existing compiled API output from the failed check is required.
- **Smallest user-run command:** `pnpm --filter @fingent360/api exec node --test --test-name-pattern="account deletion" test/account-security.test.mjs`.
- **Expected / failure evidence:** All selected deletion cases pass; report the command, exit status and failing assertion/stack if they do not. Broader ACCOUNT-001 acceptance remains pending. HEAD at inspection: `a2c53a0`; unrelated existing changes remain uncommitted.

## Getter lint repair — 2026-09-16

- **Input:** Supplied `pnpm check` exit1: ESLint `getter-return` at account-security.test.mjs:88:5. No suite report or unrelated failures inspected.
- **Cause / scope:** The synthetic owner's password-salt getter calls `assert.fail`, but ESLint cannot infer that this function always throws. Test harness and documentation only; production behavior, UI/UX, API/contracts, database, source data and automation are unchanged. Existing E2E coverage needs no changes for this fixture-only repair.
- **Acceptance / implementation:** Explicitly return the existing assertion call without removing or weakening it. Add a regression proving direct salt access still throws the expected AssertionError; retain all deletion admission cases and fixture cleanup.
- **Reusable prompt:** Repair only the supplied getter-return failure, preserve the fail-fast password guard and authentication assertions, add a direct guard regression, and update README/TODO/this record. Authoring and read-only inspection only; no checks, services, delegation or commits.
- **Dependencies / remaining gaps:** No dependency changes, services, migrations or UI URL required. Runtime unit validation requires existing compiled API output. Broader account acceptance remains pending.
- **Smallest user-run validation:** `pnpm exec eslint apps/api/test/account-security.test.mjs`. Expected: no getter-return error. Regression command: `pnpm --filter @fingent360/api exec node --test --test-name-pattern="account deletion" test/account-security.test.mjs`. Parent owns the exact `pnpm check` retry.
- **Manual documentation acceptance:** Confirm the README link and TODO row identify this pending repair without claiming a pass. On failure supply command, exit status and relevant diagnostic/stack.
- **Verification / commit:** Not run; authored only. No commit created; inspected HEAD remains `a2c53a0`. Preserve all pre-existing uncommitted work.
