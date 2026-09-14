# REPORTS-003 integrated handoff

Parent integrated the feature after AUTH-WAIT and EVIDENCE-LINKS, preserving all later goal/privacy/deletion fields. The32 new connected selections passed in the broader report regression. Final disclosure/print/keyboard coverage passed6/6 with temporary sleep prevention after system sleep interrupted two earlier runs. Technical receipt details now use accessible disclosures; printable HTML expands all retained fields. Existing v1/replay/private-deletion behavior remains. Exact run IDs, offline evidence, record/resource audits and final gates appear in [status](status.md). No migration026 or dependency. Batch APK rebuild/reinstall and physical printing/TalkBack acceptance remain separate.

The authoring handoff below is historical; its unexecuted status does not describe the integrated feature.

# REPORTS-003 authored handoff

Authored only in `artifacts/task-worktrees/reports-003`, branch `codex/reports-003`, base/latest local commit `dec6d47`. All changes are uncommitted pending parent integration and authorized gates. No tests, discovery, checks, formatting, builds, migrations, dependency installation, services, provider calls, commits or pushes were executed by this agent. There were no pre-existing worktree edits. Root owns TODO/README/status/catalog/coverage/delivery-matrix updates and final integration.

## Outcome and integration dependencies

The optional report chooser captures up to 20 explicitly selected owned connection ID/version pairs. A v2 report retains their original personal notes and minimal dated source/target receipts, plus source/record context and review warnings evaluated at capture. It labels present-day status unknown; it never infers current publication from a saved/replayed receipt. V1 requests/reports retain their exact existing shape, policy and calculations. Requests with an altered label/selection under the same ID conflict; identical retries replay the stored capture before quota checks. A source or financial-record change after capture never rewrites issuance. Foreign/missing/removed connections are unavailable, changed connection revisions require new review, and source/target changes can be intentionally captured with their actual warnings.

Required integration order: REPORTS-001/002 and XLSX baseline → RETENTION integration → EVIDENCE-LINKS-001 (including its final API277/WEB278 corrections) and AUTH-WAIT → REPORTS-003. This worktree intentionally does not copy forthcoming prerequisite files. Preserve parent AUTH-WAIT's AccountStore current-clock expiry and ReportsStore post-account-lock revalidation/mutation lock order. This feature adds an additional require after source-lock capture and before snapshot insertion. Preserve root offline account deletion's report tombstones/limits and research connection map. No dependency or migration026 is needed: existing JSONB job/report columns use a strict v1/v2 union; old records remain unchanged.

## Scoped manifest

New files:

- `docs/product/report-research-receipts.md`: specification, workflow, storage/privacy, historical-context boundary, per-layer acceptance.
- `apps/api/src/report-research.ts`: locked owned source/connection capture using exact versions and shared domain evaluation.
- `apps/web/src/report-request.ts`: typed session-denial response shared by report and selection reads.
- `apps/web/src/ReportResearch.tsx`: opt-in owned selection, full review receipts, issued historical-context reading.
- `tests/e2e/helpers/report-research-fixture.ts`: lazily invoked actual account/API/schema and real dated bundled-source setup; imports forthcoming existing research-connection fixture.
- `tests/e2e/cases/api/report-research.spec.ts`: API290–299.
- `tests/e2e/cases/browser/report-research.spec.ts`: WEB290–299 and WEB301, desktop/mobile.
- `tests/e2e/cases/offline/report-research.spec.ts`: OFFLINE330–339.
- `docs/development/report-research-handoff.md`: this handoff.

Changed shared files:

- `packages/contracts/src/reports.ts`: strict optional selection; exact v1/v2 snapshot/report schemas, captured receipt context, deterministic issuance and canonical replay selections. Existing index/privacy exports already expose/use these report schemas; no copied prerequisite edit.
- `apps/api/src/reports.ts`: compare label/selection during replay; capture selected owned receipts with consistent account/source locks; post-wait session checks. Existing capacity, hourly limit, tombstones, cancellation/retry/lease and finish fences are retained.
- `apps/web/src/offline/reports.ts`: asynchronous local capture through the forthcoming actual connection handler; canonical replay and same stored-snapshot issuance; existing tombstones/limits/account storage retained.
- `apps/web/src/Reports.tsx`: optional selection→consent→review→capture, exact request retry/discard recovery, issued context, JSON, private print window/self-contained printable HTML, explicit current-connections navigation. Existing polling/version merge/deletion fences are preserved.
- `apps/web/src/reports.css`: narrow-screen dated receipt layout.

## Layer acceptance and concrete limits

- Specification: linked product specification written before implementation.
- UI/UX: unchecked inclusion; owned choices and receipts; loading/empty/error/reload; capacity/consent bounds; review Back/Escape; stale selection retry/discard/reload; queued/issued/open/JSON/print; report deletion and connected current-context navigation. Keyboard/360px and browser print assertions are authored. Physical phone/TalkBack, native Back, user design and physical print/PDF remain manual acceptance.
- API/workflow: strict unknown-field rejection and selection limits; ownership; canonical idempotency; capture-time source/target warnings; consistent locking; expiry recheck after source wait; fixed retries; immutable v1/v2 issue/download.
- Database: existing JSONB tables and parent deletion fences reused. Account locks precede source locks in sorted ID order. Capacity100 and new requests 100/hour unchanged. No historical data rewrite or migration.
- Real data/provenance: copied actual stored dated Fed edition in isolated fixture; actual packaged bundle in offline tests. Test-only publication/withdrawal, lease/capacity states and response faults are marked synthetic. No provider requests, private data transmission, article text, price/sector/impact/advice inference or financial-record mutation.
- Automation: existing durable PostgreSQL worker claims/leases/retries; on-device processing resumes through reports reads. No new scheduler/provider automation. Workers use only captured context.
- Privacy: v2 snapshots appear in existing private export; individual deletion removes their copy and retains only the existing tombstone; account cascade/deletion removes all report/connection data and limits. Removing a connection separately intentionally leaves consented report copies until report/account deletion, stated before capture.
- Print: web renders only the selected immutable report in a new print window, with escaped text and no executable content. Self-contained HTML download also works with zero network. Native Android saves that HTML through the existing file picker; the user opens it in a browser to print/PDF. No native printer service is claimed.

## Root tracker and catalog suggestions

Mark REPORTS-003 implementation/authored complete, verification pending. Keep DEV parent gates and physical/design acceptance open. README should state optional research receipts, unchanged v1, exact v2 capture-time context, explicit report-copy deletion, and rebuilt/reinstalled Android requirement. Status must use actual parent gate/run IDs after execution. Add these 31 definitions (10 API, 22 desktop/mobile executions and 10 offline executions) to CATALOG/coverage; no discovery side effects:

| IDs        | Project         | Authored acceptance                                                                                                                       |
| ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| API290     | api             | Actual v1/v2 reconstruction, exact receipts and unchanged financial arithmetic/records                                                    |
| API291     | api             | Canonical concurrent replay; altered selection/version/label/mode conflicts; no recapture after removal/withdrawal                        |
| API292     | api             | Foreign/missing/stale/removed selections fail atomically without quota consumption                                                        |
| API293     | api             | Consent, empty/duplicate/21 selections, unknown fields, versions and Origin                                                               |
| API294     | api             | Newer/withdrawn sources and changed/removed goals at capture; original bindings and source-text omission                                  |
| API295     | api             | Actual source-lock wait observes committed withdrawal; current-clock expiry while waiting rejects storage and rolls quota back            |
| API296     | api             | Explicit worker fault/retry issues the captured v2 after source/goal changes                                                              |
| API297     | api             | Cancel/delete plus actual late ReportsStore.finish cannot recreate private v2 content                                                     |
| API298     | api             | Explicit capacity fixture; replay/deletion available at capacity/hourly quota                                                             |
| API299     | api             | V1/v2 privacy export, foreign denial and exact account cascade                                                                            |
| WEB290     | desktop/mobile  | Opt-in actual receipts, review, durable issued v2, real JSON download, screenshot                                                         |
| WEB291     | desktop/mobile  | Unchecked inclusion retains v1 and omits research notes                                                                                   |
| WEB292     | desktop/mobile  | Simulated selection GET outage, retry, empty state and v1 fallback                                                                        |
| WEB293     | desktop/mobile  | 360px keyboard, modal Escape/Back focus and cancelled draft navigation                                                                    |
| WEB294     | desktop/mobile  | Actual commit with simulated lost response, exact retry, withdrawal and historical-context wording                                        |
| WEB295     | desktop/mobile  | Concurrent actual edit conflicts; discard/reload/new review captures current revision                                                     |
| WEB296     | desktop/mobile  | Withdrawn source/removed goal warnings and explicit navigation to current connections                                                     |
| WEB297     | desktop/mobile  | Actual print-window DOM contains selected escaped report only; print invocation intercepted in test                                       |
| WEB298     | desktop/mobile  | Individual report deletion/reload removes its copy while connections remain                                                               |
| WEB299     | desktop/mobile  | Signed-out privacy and account return navigation                                                                                          |
| WEB301     | desktop/mobile  | Actual expired-session capture and connection-list401 clear all private state; delayed successful/failed report polling cannot restore it |
| OFFLINE330 | offline         | Actual bundled receipt UI, durable v2/printable HTML, zero API network                                                                    |
| OFFLINE331 | offline         | Exact v1/v2 reconstruction and unchanged financial/private connection records                                                             |
| OFFLINE332 | offline         | Canonical durable replay and altered payload conflicts after removal                                                                      |
| OFFLINE333 | offline         | Local account report/connection ownership isolation                                                                                       |
| OFFLINE334 | offline         | Bounds/stale/removed selection and escaped personal HTML                                                                                  |
| OFFLINE335 | offline         | Changed/removed goal context and unchanged earlier issued report                                                                          |
| OFFLINE336 | offline         | Queued cancel/delete, tombstone replay fence, durable capacity reclamation                                                                |
| OFFLINE337 | offline         | Private v1/v2 export, account deletion and deleted UUID reuse                                                                             |
| OFFLINE338 | offline         | 100 actual local requests establish capacity/hourly bounds; deletion/replay preserved                                                     |
| OFFLINE339 | offline adapter | Actual local handler with explicitly synthetic rebuilt-bundle withdrawal; old issue/replay unchanged                                      |

## Required parent/user actions

No dependencies changed. Integrate the prerequisite contracts/controller/migration024/local handler first and preserve AUTH-WAIT fixes. Format/check/build are not expected to resolve in this isolated branch until those sibling dependencies are integrated. PostgreSQL and MongoDB must be available; the isolated fixture role needs CREATE SCHEMA. Apply integrated prerequisite migrations through the existing user-invoked workflow; REPORTS-003 adds none. Root `pnpm dev` prints app/API URLs; typical report route is `http://localhost:5173/#reports`.

```bash
pnpm format
pnpm check
pnpm db:migrate
pnpm dev
# Separate terminal; use printed app/test URLs, watch off:
E2E_BROWSER=chrome pnpm e2e:ui
# Select @REPORTS-003 in api, desktop, mobile and click Run.
# Optional saved selected runs:
E2E_BROWSER=chrome pnpm e2e:run --project=api --grep @REPORTS-003
E2E_BROWSER=chrome pnpm e2e:run --project=desktop --project=mobile --grep @REPORTS-003
# Repackage shared public/UI assets before offline cases:
pnpm android:web
E2E_BROWSER=chrome pnpm android:test:ui
# Select OFFLINE330–339 / @REPORTS-003, click Run; watch off.
```

Expected: original v1 bytes and financial calculations remain stable; optional v2 binds only selected owned revisions with dated minimal receipts and actual capture warnings; replay cannot silently recapture or revive deleted reports; worker retry/late finish respects stored snapshot/cancellation/deletion; local reload/export/deletion stays private with no API network. Parent should also select existing @REPORTS-001/@REPORTS-002 and relevant AUTH-WAIT/connection regressions if integration changes justify it.

For failures share `artifacts/e2e/latest.md`, its run time/ID, selected projects/IDs, assertion and relevant screenshot/trace plus annotated owned API/schema. Successful credentials and private notes should not be shared. Physical Android requires a rebuilt/reinstalled APK; no APK was changed here. Root records gate evidence and scoped local commit hash after passing gates. No pushes or automatic watch runs.

Peer-review corrections before refreeze: report requests use typed401 handling shared with the connection selector. Any401 immediately invalidates older reads, stops polling, clears jobs/issued selection/deletion/research/review/pending request state and shows AccountGate until remount. WEB301 holds actual old successful list responses across capture401 and separately isolates connection-list401 while report polling fails. Final AUTH-WAIT rechecks are retained after request/delete advisory locks and cancel/delete job locks, in addition to account/source checks. No correction was executed by this agent.
