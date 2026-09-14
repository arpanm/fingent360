# READING-FOLLOW-001 handoff

Authored and frozen in artifacts/task-worktrees/reading-follow-001, base a18010bd590d9110bf4ef90a1ecf0eb9ddcbdd26. No child commit, dependency change, provider request, migration, test, build, formatting, service action or gate was executed. All listed changes are uncommitted feature work; root trackers/catalogue/matrix/status remain parent-owned.

## Exact manifest (25 files)

- packages/contracts/src/reading-follow.ts — strict inputs/pages/receipts and shared transitions.
- packages/contracts/src/index.ts — exports.
- packages/contracts/src/privacy.ts — paged/complete reading export fields.
- packages/contracts/test/reading-follow.test.mjs —5 domain cases.
- infra/migrations/032_reading_follow.sql —3 owned tables and immutable event trigger.
- apps/api/src/reading-follow.ts — account-owned controllers, atomic bounded scans and export.
- apps/api/src/app.ts — controller registration.
- apps/api/src/migrate.ts — additive032 registration.
- apps/api/src/privacy.ts — initial reading export page.
- apps/web/src/ReadingFollow.tsx — responsive editor/inbox/history/current-vs-historical states.
- apps/web/src/reading-follow-export.ts — complete immutable-page collector.
- apps/web/src/Privacy.tsx — reading/schedule collectors and private401 handling.
- apps/web/src/App.tsx — route and More entry.
- apps/web/src/AccountGate.tsx — allowed return destination.
- apps/web/src/navigation.ts — section selection.
- apps/web/src/Saved.tsx — Reading updates link.
- apps/web/src/offline/reading-follow.ts — serialized local parity/export.
- apps/web/src/offline/index.ts — handler registration.
- apps/web/src/offline/accounts.ts — export/account deletion integration.
- tests/e2e/helpers/reading-follow-fixture.ts — lazy owned synthetic pagination fixture.
- tests/e2e/cases/api/reading-follow.spec.ts — API440–445.
- tests/e2e/cases/browser/reading-follow.spec.ts — WEB440–445.
- tests/e2e/cases/offline/reading-follow.spec.ts — OFFLINE450–451.
- docs/product/reading-follow.md — final specification.
- docs/development/reading-follow-handoff.md — this handoff.

The four domain/parity files finalized by research_connections (contract, contract units, API controller and local handler) were preserved during final UI/test/documentation completion.

## Integration requirements

Semantically merge registrations and privacy changes with current main. Preserve SOURCE-WITHDRAWAL publication admission, privacy account/session locks, Saved reader/link protections and the newer holdings import/export shapes. Preserve REPORT-SCHEDULES registration, reportSchedules contract fields, local account maps and schedule-export collector. The child intentionally references the already authored schedule-export collector; its older base does not contain that file. Do not replace current main Privacy, Saved, App, migrate or offline/accounts wholesale. Register032 after existing migrations without dropping029/030/031. No worker/control changes belong to this feature.

## Coverage and layers

14 E2E definitions:6 API,6 browser,2 offline. Normal connected projects select18 scenarios (6 API +6 desktop +6 mobile); the packaged offline project selects2. Shared contracts add5 unit cases. Reserved unused IDs remain free.

| Cases      | Acceptance                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| API440     | Reviewed baseline, coalescing, ack/reopen, withdrawal, mute/unmute, historical replay and text-free export                 |
| API441     | Concurrent identical request, conflicts, complete event pagination, ownership and account deletion                         |
| API442     | Actual publication lock waiter; independent autocommit observer ages the owned session;401 rolls back settings/events      |
| API443–444 | Retained/overlapping follows survive unrelated edits; acknowledgement binds observed configuration                         |
| API445     | More than200 source IDs across batches, unique bounded notice pages and immutable export upper boundary                    |
| WEB440     | Keyboard review/back/save, checked notice, acknowledgement, withdrawal and vanished-topic removal;360px layout             |
| WEB441     | Real committed check with lost response; same-body replay plus GET503 remains historical until reload                      |
| WEB442     | Actual complete multi-page download; later real401 clears private screen and prevents partial download                     |
| WEB443     | Pending history Close stays usable; held old200 cannot restore state after real401                                         |
| WEB444     | First GET503/unreadable recovery and all settings controls disabled while actual committed PUT response is held            |
| WEB445     | Actual multi-page notices, per-page filters/empty state and current-reading links                                          |
| OFFLINE450 | Keyboard shared UI, real serialized persistence/replay/reload, export/deletion and zero API traffic                        |
| OFFLINE451 | Actual local handler with labelled later bundle editions, overlap/ack/mute rules, rollback and complete history pagination |

UI/UX/navigation, API/contracts, functional transitions, storage, provenance, automation exclusions, tests and documentation are all covered by the specification and authored cases. Automation is intentionally not applicable: checks are explicit actions. Physical phone layout, assistive technology and platform file-picker acceptance are separate manual checks. Tests use owned isolated accounts/schemas; no main app cleanup or source review is performed. Trace/video/screenshots are disabled for these private-data cases. Pagination helper payloads explicitly identify synthetic data and are removed by the isolated fixture teardown.

## Parent-only verification recipe

No new dependency installation is needed. Existing Node24/26 and pinned pnpm, PostgreSQL/MongoDB and installed browser prerequisites apply. In the integrated main checkout, parent performs:

```bash
pnpm format
pnpm check
pnpm db:migrate
pnpm dev
# Separate terminal, use the URL printed by dev:
E2E_BROWSER=chrome pnpm e2e:run --grep @READING-FOLLOW-001
pnpm android:web
E2E_BROWSER=chrome pnpm android:test --grep @READING-FOLLOW-001
```

Use the configured dev URL (normally http://localhost:5173) at /#reading-follow; Saved and More must reach it. Connected E2E fixtures start their own temporary API/schema against the available databases. No provider credentials or source refresh is required; the public bundle must contain an actual published Fed source and reviewed catalogue. If updating the native artifact, run pnpm android:build separately and reinstall the new APK; a web test does not prove physical-phone acceptance. Existing parent source/holdings/schedule/privacy regressions must remain green during integration.

Manually confirm keyboard source/topic selection, review Back/Escape, dirty-draft discard, loading/error recovery, page filters/More, muted settings and successful reload after an uncertain action. Confirm the current reader link disappears after an actual source withdrawal and explicit reload; historical notice/export remains text-free. Download a complete multi-page export and verify readingFollow.complete and reportSchedules.complete. On device, repeat the editor/reload flow offline, verify the dated bundle notice, no API requests and an account-local deletion.

For failure report artifacts/e2e/latest.md with run ID/time, selected project/case IDs, redacted failure and the fixture's owned schema annotation. Include console/network status and UI route/viewport where relevant, without session cookies, recovery codes or exported personal records. Record build/APK hashes for device issues. Never infer a pass from authoring or a commit.

## Practical limits

Scans use200-row batches,100-row pages,3second statement timeouts and a10second operation deadline; they fail atomically rather than silently return a partial check. The scan is dated by its start/completion interval; concurrently inserted missed heads wait for a later explicit check. There is no background continuation or lifetime history shutdown limit. Complete browser downloads and local persisted state necessarily materialize the user's immutable ledger, so very large histories remain subject to browser memory/local storage limits. Current GET time is not a new manual check; completed action timestamps remain in receipts/history. Disconnected devices know only their bundle. No market-performance, urgency, advice, delivery-service or synchronization capability is claimed.

## Parent integration refinements

Current notice responses project a readable title/source name/current edition only from admitted published reading, without storing it in notice history or exports. The UI labels current metadata separately from the observed edition and hides it until an authoritative load; withdrawn items show an unavailable label with the opaque receipt ID under Notice reference. API440/WEB440/OFFLINE451 verify titles disappear after withdrawal and do not enter history. Previously selected vanished topics remain available throughout editing so removal can be undone before saving. Numeric event pagination explicitly orders the underlying bigint sequence, avoiding lexical ordering of the JSON string representation; API441/445 retain uniqueness/completeness/frozen-boundary assertions. These corrections were subsequently verified by the parent as recorded below.

## Parent verification

Parent verification: migration032 applied successfully;28 migrations and exact original account/financial digests preserved. Connected run2026-09-14T04-09-57-863Z-82773 passed25/25 in51.4seconds (18 feature instances plus7 privacy/source-wait regressions). Earlier failing assertions exposed lexical sequence pagination, disappearing vanished-topic choices and an ambiguous source/topic locator; the numeric ordering, retained editor choices and scoped locator were corrected without weakening completeness checks. Readable current titles are admitted separately from text-free history. Navigation now keeps Saved active; final WEB440 desktop/mobile run2026-09-14T04-12-47-995Z-83946 passed2/2 in8.7seconds and1280×720/390×844 screenshots were inspected. Rebuilt shared assets passed10/10 selected offline scenarios; final navigation rebuild passed OFFLINE450–451 again2/2 in3.4seconds. Exact handoffs: artifacts/reading-follow-connected-handoff.md, reading-follow-offline-initial-handoff.md, reading-follow-navigation-handoff.md and reading-follow-offline-navigation-handoff.md. Audit2026-09-14T04:11:41.482Z found zero temporary PostgreSQL schemas/Mongo databases. Format/check passed136 units (33contracts,91API,12tooling); documentation-inclusive final gates are artifacts/reading-follow-final-format.log and reading-follow-final-check.log. REPORT-COMPARE-001 was committed locally as f592e13. APKcode5 still predates this batch; packaging and physical-device acceptance remain separate.
