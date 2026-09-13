# Account export and session management (PRIVACY-001)

TEAM-002 adds [single-use recovery codes](../product/account-recovery.md), revoking all account sessions after password reset while preserving records. Own-data exports include allocation revisions and record report jobs/issued snapshots; account deletion cascades those private records on server and device. Recovery secrets/hashes and abuse counters stay excluded. The local/device account remains separate from any server account.

Implemented source; verification awaiting manual execution. This completes an account privacy slice of DEV-017, not the full production security/privacy gate. No dependencies added.

Open the launcher's web URL with `#privacy` after signing in. Download account JSON to obtain username/consent metadata, watchlist, saved indicator mute preferences (including no-longer-followed indicators), persisted observation acknowledgment IDs/times, all goal revisions (including deleted goals), holdings snapshot history and retained import previews, and active session creation/expiry with independent public identifiers. The endpoint uses an authenticated repeatable-read database snapshot. Missing optional goal, holdings or alert preference tables are represented as `goals.available=false`, `holdings.available=false` or `alertPreferences.available=false`, rather than claiming an empty complete export. Password hashes/salts, bearer credentials, operator secrets and unrelated users are never selected for export. Public source documents and anonymous virtual-workspace data are separate and listed as exclusions.

Migration `006_privacy.sql` adds UUID public session IDs, backfills existing rows and defaults new IDs. Token hashes stay server-side. Session listing shows at most the existing account policy's ten sessions. Users can revoke one owned other active session or all other sessions. Current-session revocation uses existing Sign out. Mutations require the configured web Origin and strict request schemas; attempts to revoke another account's ID return the same not-found response as missing IDs. Expired sessions grant no access. Session device/location are not collected or inferred. Account deletion retains its password confirmation and cascades through private account tables.

Private downloads carry `Cache-Control: no-store` and an attachment disposition. The browser validates the response, creates a local JSON download and releases its object URL. Downloads are user-controlled local copies and cannot be removed by later account deletion. Credential-bearing test captures are disabled.

## Manual acceptance

With Docker available, invoke `pnpm format`, `pnpm check`, `pnpm db:up`, `pnpm db:migrate`, and `pnpm dev`. Reopen `pnpm e2e:ui` for current targets, leave watch mode off and manually run `@PRIVACY-001` in api, desktop and mobile. No provider network access is required.

- E2E-API-050 covers unauthorized export, own watchlist export, attachment/no-store headers, safe fields, distinct sessions, ownership and strict-body enforcement, hostile Origin rejection, single and all-other revocation, continued current/other-account access, and export of all revisions of a deleted goal with cross-account isolation.
- E2E-WEB-050 covers real account creation, two sessions, download content validation, all-other revocation, reload persistence and mobile overflow.
- Manual migration regression: start with an account session created before migration006, apply the additive migration, verify that it remains authenticated and receives a UUID in the session list. No database reset.
- Manual goals regression: save and edit a goal, delete it, then export; every goal revision and deletion time must appear only for its owner. If goals migrations have not been applied, export must explicitly report unavailable goal coverage rather than fail on a missing relation.

On failure, report `artifacts/e2e/latest.md` (run time, targets, selected cases, assertion), excluding downloaded personal data or credentials. Codex did not execute checks, migrations, services or tests for this feature.

## Integration verification

Parent verified this feature in full E2E run `2026-09-12T16-09-40-894Z-64656`: 51 passed, zero failed, one intentional outage skip across the entire suite. Format/check passed, including 40 unit tests. New migrations were applied and repeated successfully. PWA installation prompts remain browser-dependent; the offline/cache behavior was exercised on desktop and mobile. Historical authoring-only statements above describe the agent phase before parent integration testing.

Account deletion has a separate 120-attempt/IP/15-minute budget and a five-attempt/authenticated-owner/15-minute budget, counted before password hashing and retained after failed password transactions. Registration/login retain their shared 120/IP/15-minute budget. This intentionally permits up to 240 combined endpoint attempts/IP/window instead of the former shared 120; it prevents sign-in abuse from consuming the authenticated deletion budget. Origin, valid session, password confirmation and the two-concurrent-scrypt bound remain unchanged. Limits remain process-local and reset on restart. Unit cases cover budget isolation and the authenticated-owner gate.

Individual record reports can now be removed without deleting the account. See [report deletion](../product/report-deletion.md): snapshot/output bytes are removed, metadata-only receipts preserve idempotency until account deletion, and the explicit privacy export includes these receipts. Downloaded copies are not revoked.

### Workbook provenance

Standard XLSX preview/confirmation retains normalized holdings and parser version plus declared row count/acquisition-cost total. Export includes pending and confirmed receipt metadata; legacy array previews remain readable without invented metadata. Uploaded bytes, filename and path are not retained. User acquisition costs remain unverified inputs. Account deletion removes owned previews/revisions as before, including local-mode records.

### Explicit expiry maintenance

Operations cleanup uses the existing expiry fields and fixed policy; it does not expire financial histories or issued reports. Expired feedback content/attachment bytes are scrubbed, preserving minimal receipt/idempotency/audit metadata. Fresh feedback, active sessions and recovery credentials remain. Preview/result/audit expose counts, not private contents. Account deletion retains its existing owned-data cascade.

### Session revocation during database waits

Recovery revokes server sessions while holding the account row. Private financial waiters recheck the same cookie after acquiring that row; current wall-clock expiry also applies. Old sessions cannot mutate or replay private receipts after a completed reset merely because their requests started earlier. A request admitted first may finish before reset obtains the lock. Session-independent report workers retain their captured authorized job; recovery does not erase reports.

Research connections export owned immutable connection revisions, personal reasons, exact target versions and minimal source receipts; no source article text is copied into private history. Removed connections retain their dated history until account deletion; account cascade removes heads, revisions and request receipts. On-device exports/deletion follow the same ownership boundary. Source withdrawal does not erase the user's reason or falsely keep a live-source link available.
