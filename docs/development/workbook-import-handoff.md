# XLSX-001 integration handoff

Authored in isolated codex/xlsx-001 from0a91aff. Not verified by agent. No installs, builds, tests, formatting, service actions, migrations or commits performed.

## Files and layers

- packages/contracts/src/workbook.ts: fixed-output ZIP parser, strict workbook XML, generated blank/synthetic template and base64 helpers.
- packages/contracts/src/holdings.ts: backward-compatible CSV/XLSX preview union, template response, optional retained import provenance.
- packages/contracts/src/index.ts and package.json: exports; exact fflate0.8.3 and fast-xml-parser5.11.1 dependencies (parent must update lockfile).
- apps/api/src/workbook.ts and workbook-worker.ts:2-second disposable resource-limited worker.
- apps/api/src/holdings.ts: authenticated GET template/sample; existing preview revalidation and confirmation stores normalized metadata. Legacy array previews supported. No migration required.
- apps/web/src/workbook.ts and workbook-worker.ts:2-second disposable WebWorker, used by local upload and offline transport.
- apps/web/src/Holdings.tsx: download template/sample, upload, errors, reconciled preview and explicit replacement.
- apps/web/src/offline/finance.ts: same parser/template/provenance and real account-owned storage.
- packages/contracts/test/workbook.test.mjs; tests/e2e/fixtures/workbooks.ts; cases/api, browser, offline/workbook.spec.ts.
- docs/product/workbook-import.md: fixed format, limits, exactness, privacy, acceptance and remaining broker/device gates.

## Cases

API240: blank template, exact fractional sample, preview, foreign-account rejection, idempotent confirmation, export metadata without raw workbook, stale version.
API241: formula, reconciliation mismatch, long numeric, date/scientific numeric styles, DTD and external links fail with no saved mutation.
WEB240: failed upload preserves draft, valid workbook normalized/reconciled, preview/consent/confirmation/reload.
OFFLINE290: same worker/UI path without API network, persisted import metadata/export/account cleanup.
Unit tests: blank/sample/16digit text money, malformed/active formats, styled numeric rejection, forged-size high-compression payload and CRC corruption.

## Exact manual integration actions

Parent installs/pins package dependencies and writes lockfile, then runs pnpm format and pnpm check. Existing databases/API required for API240/241 and desktop/mobile WEB240; run pnpm dev, then E2E_BROWSER=chrome pnpm e2e:ui and manually select @XLSX-001. Keep watch/eye off. Offline: E2E_BROWSER=chrome pnpm android:test:ui selects OFFLINE290 against freshly packaged offline assets. No migration added. Rebuild/reinstall Android APK for phone acceptance.

Report case/project, actual run ID and artifacts/e2e/latest.md for failures. Do not equate authored code with passes. Additional release gates: desktop Excel/LibreOffice save-and-reimport; physical Android file-picker/download and worker support; malicious-worker deadline evidence. Existing RETENTION-001 edits to preview receipt cleanup must be retained during merge.

## Parser limitations worth retaining

Explicit fixed inflate output bounds allocations; worker termination bounds CPU/wall-clock. The underlying inflater may ignore padding after a finished DEFLATE stream inside its declared compressed range; such padding is never interpreted as XML or a second archive. ZIP range/CRC/actual-output validation still applies. This is not a claim of canonical DEFLATE byte encoding. Styled numeric cells including style0 are rejected; text cells remain accepted. Unsupported workbook shapes produce correction errors, not guessed imports.

### Worker lifecycle hardening

The API parser now owns capacity through actual termination settlement, releases on constructor failure, rejects clean exit without a reply, and validates strict reply schemas plus reconciliation. The browser validates the same reply schema and handles structured-clone errors. Added apps/api/test/workbook-worker.test.mjs with actual disposable workers for clean exit, invalid reply, timeout/termination, constructor failure and delayed-termination capacity leases. These cases are authored, not executed by this agent.

### Privacy compatibility correction

Added packages/contracts/src/holdings.ts storedHoldingsPreview decoder, optional validated preview import metadata in packages/contracts/src/privacy.ts, API privacy normalization and offline accounts export parity. Legacy array receipts retain no invented parser metadata. API240 exports pending and confirmed XLSX; API242 creates isolated-schema legacy array and new CSV receipts and exports before/after legacy confirmation. OFFLINE290 validates pending/confirmed import provenance. Preserve these three additional integration files: apps/api/src/privacy.ts, packages/contracts/src/privacy.ts, apps/web/src/offline/accounts.ts; keep all existing allocations/reports export fields.

The fixed-template XML reader now rejects every qualified element name, including legal hyphenated namespace prefixes. Namespaced attributes (`r:id`, namespace declarations) remain supported. Unit/API241 negative fixtures cover prefixed formula-with-cached-value and prefixed external Relationship bypasses. This deliberately excludes otherwise valid prefixed OOXML documents rather than attempting incomplete namespace resolution.

Numeric cells with explicit cell styles, row styles/customFormat, or applicable column styles are rejected instead of interpreting inherited date/scientific serials. Text cells (including style49) and genuinely unstyled numeric decimal cells remain accepted. Unit/API241 cases cover row/column date and scientific inheritance; unit positive covers unstyled decimal quantity.

## Parent integration

Integrated with prior report deletion preserved. Added the actual openpyxl3.1.5 round-trip fixture, bounded inert-metadata/rooted-internal-path compatibility, General/inherited-style and hidden-row/column guards, explicit Vite nested dependency pre-bundling, clear Import CSV or XLSX controls, actual keyboard template download checks and desktop/mobile captures. API240–242 and legacy privacy/holdings regression passed; exact connected/offline runs are in status. Broker dialects, Excel/LibreOffice desktop and physical Android acceptance remain open. Root trackers/catalogue/privacy/data dictionary are updated; final format/check gates precede the scoped local commit.
