# ANDROID-001 — Installable server-free Android feedback build

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - Implementation: Completed for the current Android feedback build: native shell, packaged React UI, versioned IndexedDB domain storage, shared contracts/exact calculations, private ownership/revisions/library/learning workflows and native navigation/import/export. The APK bundles only dated public research, starts with empty private records and persists confirmed changes across launches. Query assistance works offline; fresh data and remote AI require connected mode. Broader roadmap/production release and physical-phone acceptance remain separate.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** No new code decision. Use existing provider/offline choices; collect actual validation and activation evidence.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### ANDROID-001 — Installable server-free Android feedback build

- **Request / parent:** The user requests an installable APK containing the complete current app, usable without a server for real-phone testing. Prepare configurable CDN web origin and remote API origin for later connected operation. Child of DEV-029, DEV-012/017/018; WhatsApp/iOS and production distribution remain separate.
- **Implementation:** Completed for the current Android feedback build: native shell, packaged React UI, versioned IndexedDB domain storage, shared contracts/exact calculations, private ownership/revisions/library/learning workflows and native navigation/import/export. The APK bundles only dated public research, starts with empty private records and persists confirmed changes across launches. Query assistance works offline; fresh data and remote AI require connected mode. Broader roadmap/production release and physical-phone acceptance remain separate.
- **Scope / acceptance:** Installable signed test APK; airplane-mode cold launch; local profile/sign-in, exact goals/holdings/import/review/history, overview, discovery/terms/evidence/media, saved/reactions/preferences/reminders, learning, privacy export/deletion and labelled learning lab. Native Back/dialog/dirty-form behavior, CSV file chooser and actual file exports. App settings clearly distinguish device-only and future HTTPS CDN/API configuration; no automatic private-data sync. Native insets/keyboard support. Unsupported external actions explain their requirement instead of pretending to succeed.
- **Execution:** Generating the requested APK authorizes the required isolated Android toolchain/dependency setup, builds and validation for this delivery. Keep existing services/data intact. Reuse the previously requested parallel team with explicit file ownership. Format/check must pass before local commit; never push.
- **Codex prompt:** Read AGENTS/README/decisions/DEV-029 and all current endpoint contracts. Build an Android feedback APK around the actual complete app, not a localhost URL or mock static screen. Introduce an explicit offline/connected transport boundary; preserve shared runtime validation, exact financial calculations, version/conflict/idempotency semantics and user ownership in durable local storage. Package a provenance-labelled public content snapshot and no private records/credentials. Make offline limitations visible, with query suggestions and due reminders supported on device. Implement native navigation, file import/export, configuration and optional local notification integration where supported. Keep future CDN/API URLs HTTPS, scoped and separate from local data; configure credentialed CORS only for the intended web origin. Author API-boundary/browser/native acceptance, execute the required build/gates, inspect the APK and emulator when available, document actual evidence/install instructions and checksum, update README/TODO and commit locally without push.
- **Verification / delivery:** Generated `artifacts/android/fingent360-debug.apk`, Android 8+ with current System WebView, 2,641,660 bytes, SHA256 `11253f3563798b1087420b34bae4cf77bd80f24d915cb0aebb563bb9ee1edbdf`. Format/check passed with 69 unit tests. Final offline run `1789275930383-42670c82-5394-4c1a-abb8-ce676cba8cdf` passed all 7 cases (010–012, 201–204), no API/database. 11 targeted existing-web/API executions passed, including CORS, shared journey math, layout and actual JSON/CSV/WebM downloads. Android 35 ARM64 emulator verified airplane cold launch, local account/goal/CSV import and persistence, native Back/keyboard, actual JSON save, failed-connected recovery and same-key update retention. Exact evidence/limits: docs/development/status.md. Physical phone, TalkBack and native WebM export remain user acceptance.
- **Manual next actions:** Transfer/install the APK, open in airplane mode, create a local profile and try reading/save, goals, holdings/CSV and Privacy export. More → App settings shows snapshot/build/connection details. Report screen, steps, expected/actual behavior and screenshots. Source updates/rebuilds/tests follow docs/development/android.md; run `pnpm android:test:ui` for manual case selection, watch off. No server is required for the APK. No Git push or deployment.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ANDROID-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Validation + activation
- **User input needed now:** No for the independent next step.
- **Decision:** Do not reimplement authored functionality or assume keys are absent. Existing provider choice is settled; actual configuration and device/live acceptance must be evidenced.
- **Recorded answer / authority:** User requested configurable OpenAI/Gemini/Anthropic and query fallback, with offline Android testing before later server/CDN deployment.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** Only ask for the exact missing environment/account or device observation after the task’s documented validation identifies it. Never request secrets in chat.
- **Next action:** No new code decision. Use existing provider/offline choices; collect actual validation and activation evidence.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789722425545-83879.
<!-- sdlc-validation:end -->
