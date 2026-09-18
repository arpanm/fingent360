# ACCOUNT-001 — Authenticated accounts and real-data watchlists

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - Implementation: Implemented
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** User-run SDLC1789569346007-35322 passed the full required API, desktop/mobile and offline matrix at implementation commit d1dd7e3. Registration bug BUG-99cc743e4a8bae69 is resolved. Later source changes require their own evidence; this is not a claim that every functional story passed.

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

## Registration503 blocker — 2026-09-16

- **Input / authority:** User supplied only E2E-API-030 at account.spec.ts:31, expected201 received503. One authoring/read-only attempt; no report inspection, execution, delegation or commit. No run timestamp or response body was supplied.
- **Evidence:** Read-only inspection found no nonempty assignments for PRIVATE_IDENTITY_LOOKUP_KEY, PRIVATE_DATA_ACTIVE_KEY or PRIVATE_DATA_KEYS in local ignored .env. Values were neither printed nor retained. AccountStore.register requires identityLookup before inserting the account; missing lookup configuration explicitly throws503. encryptIdentity also requires the payload key ring. Database/connectivity/schema failures can independently produce503. The running process environment and exact response body are unavailable, so the precise runtime cause remains unconfirmed.
- **Disposition:** Configuration blocker, not a demonstrated code defect. Preserve fail-closed encryption and the real PostgreSQL path. No automatic key generation, plaintext fallback, test skip, mock replacement or assertion change. Existing encrypted data may require the original keys; creating replacements is not a safe generic repair.
- **Scope / layers:** Documentation-only clarification of account prerequisites and recovery. API/contracts, functionality, database/schema, automation, source ingestion and UI/UX remain unchanged. Existing API030/031 and WEB030 cover registration/storage/recovery; keyboard, mobile, visual and saved/error states receive no new behavior in this attempt.
- **Operator next action:** Confirm whether private encrypted records have previously existed. Restore their original payload ring and stable lookup key from secure backup when applicable. Only for first setup with no previously encrypted data, use pnpm privacy:keys as documented in development/private-key-setup.md. Existing payload-only installations follow that document's first identity rollout procedure. Reload the API after configuration; retain PostgreSQL and the migrated schema including081. Do not report key values, cookies, passwords or database URLs.
- **Manual regression scenarios:** A: with the intended server keys and migrated PostgreSQL, rerun the exact API030 case and require201 plus all existing save/isolation/logout/login/deletion assertions. B: review the setup instructions against private-key-setup.md: first setup and lost-key recovery must remain distinct; no replacement keys for existing encrypted records. C: confirm this record, README and TODO describe a blocker rather than a verified fix.
- **Smallest user-run validation:** `pnpm e2e:run 'tests/e2e/cases/api/account\.spec\.ts' --project=api --grep 'E2E-API-030 register, save, isolate, login and delete$'`.
- **Prerequisites / failure evidence:** Existing dependencies unchanged; current API, configured PostgreSQL and matching web Origin required. No browser UI needed for the API command; optional account UI uses the dev launcher's web URL plus /#account. If503 persists, report only case/project, time, HTTP status and the fixed server error message, excluding credentials and response headers. No whole-suite report requested.
- **Reusable prompt:** Inspect only this supplied registration failure and account configuration/code. Obtain safe evidence distinguishing key unavailability from database errors before proposing a code change. Preserve encryption and real-storage assertions. Author/read only; do not run commands that validate, mutate configuration, restart services or commit.
- **Verification / Git:** Nothing executed for validation; blocker remains open. Initial working tree was clean; HEAD0cffecc remains unchanged. This attempt changes documentation only and leaves it uncommitted.

## Functional completion pass — 2026-09-16

- **Recorded user answer:** “Fresh installation: no private data to preserve.” First-time `pnpm privacy:keys` is appropriate; the user must restart the API afterward. No key generation or service restart was executed by this authoring agent.
- **Actual gaps fixed:** An inbox refresh error after a committed watchlist update previously suppressed its saved acknowledgment. The acknowledgment now appears immediately after the validated save receipt. An unreadable account/watchlist reload now disables edits rather than allowing writes from stale selection state. Unchanged selections cannot be submitted again. Public account errors no longer expose operator key/setup instructions. The shared React implementation serves web and packaged Android.
- **Scope / existing backend and database:** Existing authenticated watchlist GET/PUT, CurrentAccount/Watchlist schemas, encrypted account identities and persisted per-owner rows are retained. These bugs need no new schema or migration. Account creation similarly retains its confirmed success message if a later reader fails. No simulated account or storage replaces the actual API.
- **Acceptance:** API030/031; browser030/033/034 on desktop/mobile; offline034. WEB034 commits through the real API and injects only downstream read outages, verifies one PUT, actual persisted choices, denied edits during unavailable reads and successful reload. Offline034 creates and persists a local account/watchlist with no API network traffic. The explicit matrix is docs/tasks/acceptance.json.
- **Validation:** Authored only. Run `pnpm sdlc "Complete account workflow" --story ACCOUNT-001` after fresh key setup and API restart. For the packaged shared UI, `pnpm android:web` then `pnpm android:test --grep ACCOUNT-001`; SDLC affected mode also captures selected offline reports. Native APK installation is separate and is not certified by a browser test.
- **Remaining:** Actual selected-run acceptance, then proceed to the next functional story. Do not mark this story fully Done from authored code or a checks-only run.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789751750850-92480.
<!-- sdlc-validation:end -->
