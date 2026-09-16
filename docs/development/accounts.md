# ACCOUNT-001 accounts and real-data watchlists

Implemented through PostgreSQL, Nest API, strict shared contracts and React: create an account with a username/password and explicit storage consent; sign in/out; save a private watchlist of the real macro indicators; reload/login to recover it; delete the account after confirming its password. This is independent of the existing synthetic exercise capability. No mock user or mock observation is served.

## Manual execution

Registration requires server-only PRIVATE_IDENTITY_LOOKUP_KEY, PRIVATE_DATA_ACTIVE_KEY and PRIVATE_DATA_KEYS, plus the migrated account schema including081. Missing keys intentionally return503; migrations alone do not configure encryption. Follow [private key setup](private-key-setup.md), restoring original keys if encrypted records already exist, then reload the API. Never replace lost keys merely to pass a registration test. The [2026-09-16 API030 blocker](../tasks/ACCOUNT-001.md#registration503-blocker--2026-09-16) records missing local assignments and the exact focused rerun; runtime confirmation remains pending.

No new dependencies or external identity service. Run `pnpm format`, `pnpm check`, then `pnpm db:migrate` with PostgreSQL running. The migration now also creates the account/session/watchlist tables without removing existing data. Start/reuse the updated API/web. Open http://localhost:5173/#account. Register a username and 12–128 character password, confirm the storage consent, select GDP/inflation, save, reload and sign out/in. The selection must persist. Source data remains empty until DATA-001's operator refresh has fetched it; no sample fallback is used.

In the existing Playwright UI, run `@ACCOUNT-001` across api/desktop/mobile. E2E-API-030/031 and E2E-WEB-030 create isolated test accounts and remove them afterward. Test credentials/session cookies are excluded from trace/video/screenshot capture. Share safe assertion text and case/project for failures. Tests require the databases/API/UI; account tests do not fetch the external provider. Force-stopping a test can leave its `e2e_*` account until explicitly deleted; no automatic global data reset exists.

## Access and privacy implementation

- Passwords use asynchronous scrypt (N=131072, r=8, p=1), independent 256-bit salts and constant-time hash comparison. At most two derivations run concurrently. This uses built-in Node crypto and follows the [OWASP scrypt guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Seven-day random server sessions store only token hashes in PostgreSQL. Cookies are HttpOnly, SameSite=Strict, host-only and scoped to /api/v1/account; HTTPS WEB_ORIGIN enables Secure. No account session token goes in JSON/localStorage. Logout revokes the current session; account deletion cascades through all sessions/watchlist rows. At most ten sessions per account are retained.
- All account mutation routes require an exact configured Origin. Only the corresponding localhost/127.0.0.1 alias at the same port is additionally accepted in loopback development. Missing/foreign origins reject, including registration/login. User IDs are inferred from sessions and never accepted from watchlist payloads.
- Up to five sign-in attempts per username in fifteen minutes; successful sign-in resets that counter. A per-process 120-account-requests-per-client/15-minute limit bounds signup/login/delete, using the actual socket peer rather than spoofable forwarded headers. Shared-IP limits also apply to manual test runs. Production reverse-proxy identity/distributed limits are not claimed.
- Registration records storage consent version account-storage-v1 and its creation time. UI explains stored username, password hash, sessions and watchlist. Deletion removes those private records; public licensed source data and the separate exercise remain. No email is collected; recovery, password changes, household roles, MFA, production registration abuse controls and broader consent/export lifecycles remain DEV-007/017.
- Watchlists are passive selections of real reported indicators. They do not generate push notifications, investment recommendations or trades. Every value links back to the real-source dashboard; stale or failed refresh state remains visible.

## API

All under /api/v1/account: GET current user, POST register/login/logout, GET/PUT watchlist, DELETE account (current password required). Mutating requests require the configured web Origin and cookies; direct API clients must supply that Origin explicitly. No production launch or suitability/advice gate is completed by this feature.

Implementation and tests are authored; Codex did not execute the checks, migration, app or cases.

## ALERT-001 observation inbox

Followed indicators now show their latest non-null reported observation in a personal inbox. This is historical data context, not a claim that a new market event just occurred. Corrections carry their revision label. Acknowledgments reference the exact immutable observation ID; new revisions/years have independent read state. Receipt rows cascade on account deletion and remain private. Source age/failed refresh context is shown in the saved-indicator cards above the inbox. An initial null latest-year value falls back to an earlier reported year with its year shown. A revised value withdrawn to null is retained as a correction and shown unavailable, never hidden as a previously acknowledged value. No zero is fabricated.

Apply migration 004 via the normal db:migrate command. E2E-API-040 and E2E-WEB-040 (`@ALERT-001`) fetch real GDP through the operator API, then verify account-specific acknowledgments and reload persistence. Tests need the local operator key and external source access; no mock observation is inserted. Traces/video/screenshots are disabled. No checks executed by Codex. Email/push delivery, materiality thresholds and durable delivery workers remain future tasks.

## Account experience and return navigation

The account page offers explicit sign-in/create-account choices, watchlist selection, saved indicators and a separate inbox. Privacy/session controls are linked from account navigation; deletion remains inside a disclosure with password confirmation. Storage implementation details appear under “What information is saved?” rather than interrupting the main form.

Personal pages can use `AccountGate` with a return destination. `#account?next=privacy`, `holdings`, `my-goals` and `overview` are the only accepted destinations. Successful sign-in/create returns to that hash; unknown or external values are ignored. E2E-WEB-033 covers a successful privacy return and rejection of an external redirect value across browser projects. Existing E2E-WEB-030 retains account/watchlist persistence coverage. Source authored; parent integration verification supplies evidence.
