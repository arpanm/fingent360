# REPORT-SCHEDULES-001 handoff

Authored only in `artifacts/task-worktrees/report-schedules-001`, based on843b975. No tests, builds, installation, services, migrations, formatting, lint, type checks, commits or pushes executed by this worker. Existing main/worktrees were not changed. Parent owns the gated integration commit and shared roadmap/catalogue updates.

## Integration order and interfaces

Integrate REPORTS-003 and WORKER-HEALTH-001 first. New API imports `admitWorker(c,'reports')` from `worker-control.js`; it must be the first statement in schedule materialization transactions. Migration030 supplies that gate. Migration029 then adds schedules, immutable editions/operation receipts/occurrences and keyset indexes. Existing source/research report handlers are reused, not copied into this branch.

`ReportSchedulesStore.workOne(): Promise<boolean>` admits one due owner under the reports worker-control gate, locks account then schedule, captures a plain v1 snapshot and queues the normal report job atomically with the occurrence/cursor. **Parent must merge this call into the existing health-aware ReportWorker tick before ReportsStore.workOne issuance**, injecting ReportSchedulesStore. This worker file is intentionally untouched because the worker-health agent owns its new health/control lifecycle. Already-admitted schedule transactions finish before an operator pause commits; no new captures begin after the shared pause commits. Account deletion/edits serialize on the same account lock. A crash before commit retries; after commit occurrence uniqueness/cursor prevents a second snapshot. No independent long-lived schedule lease or external effect exists; normal report issuance keeps existing leases.

New routes: GET `/api/v1/account/report-schedules`, POST `/:id`, GET `/export` with editionAfter/receiptAfter/occurrenceAfter and frozen upper cursors. Full route `#report-schedules`, linked from Reports, with AccountGate return. Reports selection reads `#reports?selected=<id>` and reports an unavailable/deleted/foreign ID honestly. Merge these small Reports edits into the later REPORTS-003 authDenied/read guards, preserving parent disclosure/print DOM changes.

The list is bounded to105 schedules (live first) and100 recent outcomes. Immutable history has no lifetime shutdown. Up to5 live schedules; report capacity100 and100 new reports/hour are preserved. Full capacity records a skipped occurrence, advances naturally, and permits a later future capture once capacity is available. Pausing, deleting and editing remain usable after100 editions/1,000 outcomes. No silent automatic status/config version mutation occurs.

Privacy GET exposes a strict first schedule page and explicit continuation. `completeScheduleExport` validates every owned page, freezes the first page's upper bounds, checks current account before download, and aborts without partial output on failure/account change/unmount. Both Privacy's existing download and the dedicated schedule-history download collect all pages. `CompletePrivacyExportSchema` describes the complete download; `PrivacyExportSchema` remains the API page envelope. Device state uses `localReportSchedules[userId]`; export and account cleanup are integrated. Device materialization runs only on schedule/report GET within existing serialized local storage; no timer/network is added.

## Authored cases

- Unit: spring DST gap, autumn fold, exact next future occurrence, weekly weekday, bounded latest-due skipped count and invalid zone.
- API330: consented create/version/replay/conflict/pause/foreign/export.
- API331: two actual isolated worker processes, latest-due deduplication, exact owned holdings snapshot, ordinary issuance, report deletion/tombstone.
- API332: hourly capacity outcome, no snapshot and no surprise retry.
- API333: session expires during actual account-lock wait; zero edit/edition.
- API334:1,000 existing immutable occurrences, continued capture/pause/delete, bounded pages reconstruct1,001 outcomes.
- API335:101 edition history, pause/resume, immutable replay and complete two-page export.
- WEB330: guided configure/review/back/save, pause/reload/current-read503, responsive width.
- WEB331: actual owned issued report deep link, reload and deleted recovery.
- WEB332: initial503 recovery plus committed response loss and exact retry without duplicate schedule.
- OFFLINE360: real local opt-in/persistence/export/account deletion with zero API requests.
- OFFLINE361: own cursor aged in IndexedDB, latest-due actual goal capture and issuance, no duplicate after reload/no API.

## Parent/manual verification

No dependencies added. After shared integration: `pnpm format`, `pnpm check`, `pnpm db:migrate`, `pnpm dev` with existing PostgreSQL/MongoDB and compiled actual API. Run `E2E_BROWSER=chrome pnpm e2e:ui`, select @REPORT-SCHEDULES-001 in api/desktop/mobile, watch off. Tests use fresh isolated PostgreSQL schemas and only synthetic owned lifecycle fixtures; no main records are seeded/reset. Rebuild offline web/APK with existing scripts, then `E2E_BROWSER=chrome pnpm android:test:ui`, OFFLINE360–361. Capture run ID/latest.md and exact failing case if anything fails. Physical phone/TalkBack, export cancellation under real device storage pressure and server uptime scheduling remain honest operational acceptance gates. No providers/email/push/advice were added. No local commit hash yet; parent commits after gates.

## Peer-review corrections

Corrected the list SQL quoting and separated the Reports/Schedules navigation tuples. Definitive4xx mutation rejection now drops the failed retry intent and requires current reload; uncertain network/5xx responses retain an explicit exact retry plus Dismiss/reconcile recovery. Weekly review and saved cards name the selected weekday; WEB330 uses Friday and checks Back/persistence. WEB333 exercises a real competing pause, actual409, reload and usable Resume/Pause controls. Privacy requests preserve typed401, invalidate pending reads/export, clear signed-in state and sessions, and unmount private Recovery/Export cards. WEB334 downloads all101 real owned immutable history editions across pages; WEB335 expires only the owned session on a later page and asserts the actual401 produces no partial download and clears private controls. These additional cases are authored, not executed. No worker-loop or newer parent ReportResearch edits were touched.

Final edit-conflict correction: Confirm is disabled whenever current state is unavailable or the draft's original edition conflicts. Reload does not silently rebase a draft. An explicit Discard stale draft and reload action removes only that draft, reloads authoritative state and enables opening a new edit. WEB333 now also edits v3, commits a competing real v4, receives409, proves reload cannot resubmit the stale draft, then discards/reopens the actual winning configuration.

## Parent integration and execution

Integrated overa18010b with schedule admission before ordinary health-aware issuance, additive029 and all newer privacy/report research fields preserved. WEB050 validates CompletePrivacyExportSchema for downloaded artifacts. Date-aging fixtures explicitly preserve ISO text while casting the timestamp column. Next-run display uses and labels the configured timezone; WEB330 checks America/New_York independently of the viewing device. All18 connected feature cases,26 worker/privacy regressions and20offline cases passed, plus2browser/2offline timezone reruns. Exact run evidence,118unit gates, visual/resource/private-record audits and separate phone/uptime limits are in status. No push.
