# REPORT-COMPARE-001 handoff

Authored in `artifacts/task-worktrees/report-compare-001`, branch `codex/report-compare-001`, base/local HEAD `953d3e7`. No author tests, format, lint, typecheck, builds, dependency installation, migrations, services, provider calls, commit or push. The worktree began clean; all 19 changed/new files below belong to this child. No root trackers, worker files or API report mutation files were changed. Verification remains pending parent integration and execution.

## Decisions and layers

| Layer                | Authored behavior / acceptance                                                                                                                                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specification        | `docs/product/report-comparison.md`: transient comparison of two actual owned immutable v1/v2 originals; older capture → newer capture, ties issue time then ID; current account/publication status explicitly unknown.                                                                                                           |
| Contracts/domain     | Strict query/options/result schemas; exact BigInt signed paise, millionths and integer differences; strict unit/value/difference validation before rendering; identity alignment, additions/removals with null baselines, separate v1 research absence.                                                                           |
| API/security         | Separate read-only `/account/report-comparison/options` and `/account/report-comparison?first=&second=`; account SHARE → sorted owned job SHARE → wall-clock reauthorization; generic missing/foreign/deleted 404, unissued 409, corrupt original safe 503; no-store global middleware retained.                                  |
| UI/workflow          | Reports and More entry; explicit labelled selectors, baseline review/cancel, comparison, opaque deep link, original links, reload and Back; loading/empty/one-report/failed/retry/unavailable/signed-out states. Original reader remains the existing dialog: Close/Escape, then Back; native Back closes it first.               |
| Race/privacy         | Abort + independent generations for choices/comparison, mounted auth-denied latch, immediate private clearing on any actual401, authoritative missing-choice invalidation, selection and full-route invalidation. Dated checked-time copy makes no continuous availability claim. Whole private surface carries feedback masking. |
| Device               | Same pure computation inside existing serialized state handler; no API traffic, no queued-job issuance, no added private dataset; original export, individual deletion and account cascade remain authoritative.                                                                                                                  |
| Database/capacity    | No table/migration/persisted comparison/capacity use. Only bounded existing original reads (at most100 choices, two originals). No retention changes.                                                                                                                                                                             |
| Real data/provenance | Synthetic user inputs entered through actual account/goal/holdings/allocation/report APIs. Research cases use the actual dated bundled public source through existing isolated fixture helpers. No provider request, article copy or invented live market fact.                                                                   |
| Automation           | No new worker/polling/scheduler/monitoring. Comparison is explicitly on demand; reports remain prepared by existing issuance/device workflow.                                                                                                                                                                                     |
| Tests                | Five contract unit cases plus API420–426, WEB420–425, OFFLINE430–432. Fault cases simulate only transport/readability/owned row timing or a future due time; every successful original is actually issued.                                                                                                                        |
| Docs                 | This handoff and product spec. Root owns TODO/README/status/CATALOG/coverage/gate evidence.                                                                                                                                                                                                                                       |

## Exact manifest

Modified existing files (merge edits, do not copy older sibling versions):

- `apps/api/src/app.ts` — import/register comparison controller/store alongside existing providers.
- `apps/web/src/AccountGate.tsx` — comparison destination and opaque pair return route.
- `apps/web/src/App.tsx` — More tuple, comparison page keyed by route, Reports keyed by full route to invalidate changed original deep links.
- `apps/web/src/Reports.tsx` — comparison entry link and minimal selected-ID initialization/unavailable handling.
- `apps/web/src/navigation.ts` — My money classification.
- `apps/web/src/offline/index.ts` — handler registration.
- `packages/contracts/src/index.ts` — export new contract.

New files:

- `apps/api/src/report-comparison.ts`
- `apps/web/src/ReportComparison.tsx`
- `apps/web/src/report-comparison.css`
- `apps/web/src/offline/report-comparison.ts`
- `packages/contracts/src/report-comparison.ts`
- `packages/contracts/test/report-comparison.test.mjs`
- `tests/e2e/helpers/report-comparison.ts`
- `tests/e2e/cases/api/report-comparison.spec.ts`
- `tests/e2e/cases/browser/report-comparison.spec.ts`
- `tests/e2e/cases/offline/report-comparison.spec.ts`
- `docs/product/report-comparison.md`
- `docs/development/report-comparison-handoff.md`

## Stable case IDs

All E2E cases have `@REPORT-COMPARE-001`; explicit read/timing fault cases also have `@TEST-SIMULATION`. Recovery API cases disable trace/video/screenshots to keep one-time recovery credentials out of artifacts. Fixtures use the actual isolated API/schema and API-anchored `pg` dependency via existing auth helpers. Imports have no side effects.

| ID         | Project        | Acceptance                                                                                                                                                                                                                                  |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API420     | api            | Actual issue/change/issue, exact cost −1 paise, quantity +1 millionth, goal projection +246 paise/gap −246, allocation added with null delta; reversed selection deterministic; metadata-only choices; original/financial digest unchanged. |
| API421     | api            | Guest, same/malformed/duplicate/unknown query, unsupported method, foreign/deleted denial; owned choices exclude tombstones.                                                                                                                |
| API422     | api            | Actual queued report deferred by an owned trigger and subsequently actually cancelled; comparison never issues it; choices exclude it.                                                                                                      |
| API423     | api            | Actual recovery reset queued ahead of comparison on observed account lock; stale request401, unchanged original digest, newly authenticated positive read.                                                                                  |
| API424     | api            | Actual wall-clock expiry during observed final report job wait and choices account wait; unchanged records and401.                                                                                                                          |
| API425     | api            | Actual v2 issue/edit/issue receipts, later source withdrawal, dated note/binding comparison with no current-source inference.                                                                                                               |
| API426     | api            | Actual delete queued ahead of comparison behind observed account lock wins;404 and surviving original unchanged.                                                                                                                            |
| WEB420     | desktop/mobile | Reports link, keyboard select/review/cancel/reverse comparison, exact visible values, escaped label, original dialog Close/Escape + Back, reload,390px/no overflow and synthetic screenshot.                                                |
| WEB421     | desktop/mobile | Empty/one report, first options503 and unreadable comparison, explicit retries, same-ID validation and old-result clearing.                                                                                                                 |
| WEB422     | desktop/mobile | Actual individual deletion clears comparison on refresh/reload; original remembered URL never falls back.                                                                                                                                   |
| WEB423     | desktop/mobile | Actual successful response held after transport while selection/route changes; late earlier data never replaces new comparison.                                                                                                             |
| WEB424     | desktop/mobile | Actual session expiry401 clears private result/choices immediately despite held successful earlier read.                                                                                                                                    |
| WEB425     | desktop/mobile | Another real account's report denied in comparison and original URL; same-mounted route changes never preserve prior reader after the modal is closed.                                                                                      |
| OFFLINE430 | offline        | Actual local issuance, exact parity, keyboard/mobile, originals/Back/reload, unchanged export sections and zero API network.                                                                                                                |
| OFFLINE431 | offline        | Queued/cancelled/strict/duplicate/deleted/foreign denial, no read-triggered issuance, reload deletion and zero network.                                                                                                                     |
| OFFLINE432 | offline        | Actual bundled v2 note changes, historical comparison, local account deletion and new-owner remembered URL denial with zero network.                                                                                                        |

Contract units independently cover large exact amounts, equivalent fractional spelling, absent-row null deltas, ties/reversal, unsupported/duplicate originals, v1/v2 capture availability, v2 note changes and invalid typed numeric responses.

## Integration and parent verification recipe

No dependency installation or new migration is needed for this child. Preserve root's newer `apps/api/src/reports.ts`, worker-control/health and schedule implementations: this child never edits them. Semantically merge App/AccountGate/Reports/navigation/offline/index registration with REPORT-SCHEDULES. Both use `#reports?selected=<uuid>`; keep the full-route Reports key and unavailable behavior. No required link points to a provider. The child works independently of schedules.

Parent/user commands only, after integration:

```bash
pnpm format
pnpm check
# Existing PostgreSQL and MongoDB services must be available.
# If needed, user runs pnpm db:up and the repository's existing migration workflow.
pnpm dev
# Separate terminal, use printed app and test URLs; keep watch off:
E2E_BROWSER=chrome pnpm e2e:ui
# Select @REPORT-COMPARE-001 in api, desktop and mobile, then click Run.
# Saved selected runs if preferred:
E2E_BROWSER=chrome pnpm e2e:run --project=api --grep @REPORT-COMPARE-001
E2E_BROWSER=chrome pnpm e2e:run --project=desktop --project=mobile --grep @REPORT-COMPARE-001
# Repackage shared UI/device assets before offline cases:
pnpm android:web
E2E_BROWSER=chrome pnpm android:test:ui
# Select OFFLINE430–432 / @REPORT-COMPARE-001 and Run; watch off.
```

Expected selection:7 API cases and6 browser cases on each desktop/mobile project (19 connected instances),3 offline cases,5 contract unit cases through `pnpm check`. Use the web URL printed by `pnpm dev`, typically `http://localhost:5173/#report-compare`; Reports entry is `/#reports`. Physical Android requires a rebuilt/reinstalled APK, which this child has not produced.

Manual visual acceptance: create two actual issued originals around an edited goal/holding; choose them in reverse with keyboard; review capture dates; compare; confirm direction and explicit cost/input wording; expand unchanged rows; inspect mobile wrapping and focus; open original, Close/Escape, then Back/reload. Delete one original and Refresh: private comparison must disappear. Sign out/expire the session while a read is pending: private contents must clear and sign-in must preserve the opaque destination. Device equivalent must generate no API network traffic.

For a failure, report `artifacts/e2e/latest.md`, run ID/time, selected IDs/projects, first assertion and safe screenshot/trace plus the owned API/schema annotation. Do not share recovery codes, cookies, connection strings or private real data. Parent records the final scoped commit hash only after successful gates; current author HEAD remains953d3e7 and all changes are uncommitted. No watch, automatic execution or push is enabled.

Read-only peer review found no contract/API blocking issue; its explicit selector-label and dialog-first navigation findings were corrected before freeze. This is authored evidence, not a test pass.

## Parent integration evidence

Integrated after holdings30c5ca2, preserving schedules, source withdrawal and exact holdings review. Connected run2026-09-14T03-53-41-415Z-77355 passed33/37; corrected scoped-status and active-refresh race fixtures passed4/4 in2026-09-14T04-00-47-203Z-79696. All37 selected scenarios have passing evidence without product changes for those fixture corrections. Rebuilt device assets passed20/20 selected report/comparison/schedule cases. Format/check passed131 units; final gate logs under artifacts/report-compare-final-*. Exact original account/financial digests and27migrations preserved, temporary PG/Mongo resources zero. WEB420 captures at390px inspected; physical phone acceptance and APK rebuild separate. No dependency/migration/provider request/push. Root also registers TEAM007 prompts and corrects stale parent roadmap status without marking broad parents complete.

## REGRESSION-011 — choices loading and empty-state exclusivity

User run `2026-09-14T08-28-33-631Z-98876` (latest report started08:28:34.851Z,534 completed attempts, API4103/web5175) reported WEB421 desktop/mobile strict-locator failure during refresh: the previous empty status remained rendered beside Loading issued report choices. The empty/one-report status now renders only after the current read settles. WEB421 holds a real200 options response after actual report issuance, asserts exactly one loading status and no stale empty claim, then releases/drains it and verifies the real one-report result; existing outage/unreadable/retry/privacy assertions remain. No forced clicks, sleeps, increased timeout or fabricated successful response. Files: ReportComparison.tsx, browser/report-comparison.spec.ts and this handoff. No deterministic execution or commit performed. User next action after integration: pnpm sdlc with the normal message/gates, or manually select WEB421 in desktop/mobile with the configured app/databases ready and watch off. Report the new run ID and first failing assertion; no new dependencies/migration.
