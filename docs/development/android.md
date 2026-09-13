# Android feedback build — ANDROID-001

The APK contains the existing investor app, a public research snapshot and a durable on-device implementation of its API contracts. No Node process, Docker service, API host, account server or network connection is required in device mode. This delivers the current product workflows; it does not implement unfinished market adapters or regulated advice from the broader roadmap.

## Install and try

1. Copy `artifacts/android/fingent360-debug.apk` to an Android 8.0+ phone with a current Android System WebView. Open the file and allow installation from the receiving file/browser app if Android asks. The package is `com.fingent360.app`, version `0.2.0-sources` (version code 2), development signed for feedback. Its actual checksum/build identity is in `artifacts/android/build.json`.
2. Open Fingent360, then enable airplane mode and reopen it. Today should show the **On this device** snapshot label and dated reading. New device accounts start empty; your local development server's accounts, passwords and holdings are not bundled.
3. Create a device account in More → Account. Save a goal, preview/confirm a holding or CSV, save a reading item and answer a learning question. Close and reopen the app: confirmed records should remain. Source history/evidence and reviewed visual summaries are bundled; links to source websites require internet.
4. Use Privacy to export this device account. Android's file picker lets you save or cancel; success is shown only after the write completes. Holdings CSV and supported WebM clip exports use the same picker. CSV uploads use Android's document picker.
5. Send feedback with the screen, steps, expected/actual behavior and a screenshot or recording. More → App settings contains build details. Share only material you intend to disclose; account exports may contain private financial data.

Do not uninstall or clear Android app storage to test a new build: those actions delete local records. Installing an update signed with the same development key preserves the workspace. This is local password protection inside Android app storage, not a production identity service or an encrypted vault. It has no recovery server. Android backups are disabled. Keep needed exports before destructive actions.

## Device behavior and data

The native shell serves bundled assets from `https://appassets.androidplatform.net/`. `runtime.ts` initializes before React and sends `/api/v1` requests to local domain handlers in device mode. Unimplemented server operations return an explicit unavailable response, never a successful mock. Normal web operation continues using the existing API. Offline state is not loaded by the standard web build at runtime.

IndexedDB schema 1 has a `workspace` store and a versioned root record. Registration, sessions, owned goals/holdings/library/learning records and anonymous learning-lab capabilities persist there. Changes serialize using Web Locks where available and commit with a revision compare-and-swap transaction. Asynchronous password/crypto work finishes before opening the save transaction. Conflicts return 409; failed writes preserve the last committed workspace and report storage failure. Future schema versions must add a migration in `storage.ts`; no failure handler wipes data. Existing server SQL/Mongo records and migrations 001–014 are preserved; SOURCES-002 adds server migration 015 for source outcomes. The device schema remains version 1.

Accounts use device-local PBKDF2-SHA256 password hashes with individual random salts and persisted failed-login throttles. The active session expires after seven days. All private routes check the current account/session. Export/deletion cover owned financial, reading and learning records; passwords/hashes/salts are excluded. The anonymous Learning lab uses a separate capability and its own delete-workspace action. Its fictional companies/scenario remain explicitly labelled and use the same parser, exact arithmetic and review logic as the server through shared contracts.

The delivered snapshot was captured at **2026-09-13T08:33:53.105Z**: **136 published items, 52 annual histories and 22 reviewed visuals**. It includes Fed releases, ECB press/statistics, PIB economic releases, five World Bank India annual series and eleven original sourced glossary terms. Original provenance, dates, source hashes and available published histories are retained. The public source catalogue, access notes, topic filters and full Explore corpus are included; blocked/review-required sources retain their honest status. This is dated research, not a live quote feed. APK updates carry a newer public snapshot without replacing device-owned records.

Reading reminders are checked while visible and on resume; overdue reminders appear in the app when it opens. There is no background Android push notification in this build. Learning poll counts represent this local account, not a server audience. Query suggestions work from the bundled terms and optionally owned history; no OpenAI/Gemini/Anthropic keys or calls are shipped. Connected operation retains the existing configurable server providers. Live ingestion, source publication and operations need the server deployment; device mode directs operations links to its explanation/settings.

## Sources update and installed-app identity

Source changes in the repository do not update an installed offline APK. SOURCES-002 uses the same React source for web and Android, but requires a new public snapshot, web bundle and native APK. The delivered version is `0.2.0-sources` / code 2, built 2026-09-13T08:34:40.704Z (2, 719, 416 bytes). APK SHA256: `a7629f7f9ec3142da5df44031b682d19e6574b7c3dac1758c9ef6418f501021e`. Install the rebuilt APK over the prior build using the same signing key; do not clear storage. Confirm the actual installed version and `artifacts/android/build.json`, rather than assuming a repository change reached the phone.

The snapshot preserves each article’s original publication/effective date, retrieval time, source and history. Its capture date is packaging metadata, not the publication date of annual observations. The current capture and build are verified: all 10 offline cases passed against the packaged web assets without an API/database. An Android 35 same-key update preserved the existing local holding, and airplane-mode Today→PIB reader→system Back worked. Exact evidence is in [status](status.md); physical-phone acceptance remains open. New source filters, related reading and sourced quizzes work from the captured corpus in airplane mode. Refreshing a source still requires the connected API and a subsequent explicit snapshot/build.

## Rebuild and test

```bash
pnpm install --frozen-lockfile
# One-time isolated native toolchain, macOS Apple Silicon:
pnpm android:setup
# Includes TypeScript/build and native packaging, uses checked-in snapshot:
pnpm android:build
# Test that exact dedicated offline web bundle with no API/database:
E2E_BROWSER=chrome pnpm android:test
# Or choose individual cases and click Run manually; leave watch off:
E2E_BROWSER=chrome pnpm android:test:ui
```

`android:setup` uses pinned official downloads with checksums under ignored `artifacts/android-tools`; no global JDK or SDK is replaced. The native Gradle dependencies are pinned. The build produces dedicated `artifacts/android-web` assets and an offline marker before assembling the APK, so ordinary `pnpm check`/web builds cannot replace its fallback with an online build. The native builder records a hash of all bundled web assets plus the APK SHA256. Generated assets, toolchains, local paths, build outputs and signing material are ignored by Git.

`android:test` starts only an isolated static asset server, supplies no API/database, runs the offline Playwright project and closes its own server. Any request that accidentally reaches `/api` fails. `android:test:ui` runs the same project through the existing Playwright UI with manual selection. API calls are exercised through the browser's real local transport, not mocked responses. Reports and failure details continue in `artifacts/e2e/latest.md`. Regular web/API projects remain unchanged and do not silently start offline tests.

To intentionally update public research after source refresh/review on your configured local API:

```bash
pnpm android:snapshot
pnpm format
pnpm check
pnpm android:build
E2E_BROWSER=chrome pnpm android:test
```

The snapshot exporter reads only public GET routes from the current `.env` API port; `OFFLINE_SOURCE_API` can select another loopback origin. It never reads account endpoints or imports private records. Review the resulting snapshot diff/provenance before sharing a rebuilt APK. Commit only after format/check pass; never push automatically.

## Later CDN and API connection

More → App settings offers **On this device** and **Connected · CDN and API**. Defaults are also configurable in `android/runtime-config.json`. Keep device mode for this delivery. To connect later, deploy this web build to an HTTPS CDN origin and the existing API to an HTTPS origin. Enter both origins, without paths/query/credentials; Android confirms and restarts into the chosen mode. The deployed web build must include this runtime integration. CDN content failures offer retry or a return to the bundled app.

Use same-site subdomains (for example `app.example.com` and `api.example.com`) with HTTPS. Configure API `WEB_ORIGIN` to the exact CDN origin. API CORS permits credentials only for that configured origin; the client rewrites `/api/v1` to the configured API and includes cookies. Existing Secure/SameSite cookie and origin checks remain in force. Cross-site domains, wildcard CORS and embedding provider keys in the APK are not supported shortcuts.

Local appasset storage and CDN-origin storage stay isolated. Switching never uploads or merges local accounts/holdings, and remote credentials do not sign into a local profile. Use offline mode again to return to local records. Account migration/sync, background push, release signing/Play Store, iOS and WhatsApp remain separate work. No CDN/API deployment is performed by this task.

See [native implementation](android-native.md), [offline finance](android-finance.md), [offline reading](android-reading.md), [acceptance plan](../../tests/e2e/plans/android-acceptance.md) and [current verification](status.md).
