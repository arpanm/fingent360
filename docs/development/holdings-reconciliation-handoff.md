# HOLDINGS-RECONCILE-001 integration handoff

Authoring worktree: `artifacts/task-worktrees/holdings-reconcile-001`, branch `codex/holdings-reconcile-001`, base `953d3e7`. Work remains uncommitted for parent integration. No dependencies or migrations added. No test, build, formatting, typecheck, service, provider call, installation or commit was executed by this agent. This document records authored behavior, not a verification result.

## Layers and integration

- `docs/product/holdings-reconciliation.md`: bounded product and exact-arithmetic rules.
- `packages/contracts/src/holdings.ts`: strict additive reconciliation payload, exact quantity/cost deltas, optional explicit removal acknowledgement, backwards-compatible stored-preview reader. New previews always contain a review; optionality supports historical arrays/objects only. A legacy unconfirmed preview cannot bypass review, while already-confirmed replay returns its immutable original receipt.
- `apps/api/src/holdings.ts`: captures owned baseline and actual saved allocation/active holding connection counts under account lock; validates against the actual baseline again at confirmation; rejects stale, expired and unreadable reviews. Rechecks expiry after the final holdings lock. Preserves existing post-wait session checks, idempotent confirmed replay, normal revision insertion, pending-preview retention and ownership.
- `apps/web/src/HoldingsChangeReview.tsx`, `Holdings.tsx`: all manual/CSV/XLSX paths share added/removed/changed/unchanged review, exact before/after amounts, explicit removal checkbox and dated dependency explanation. A competing update disables confirmation; “Refresh baseline and keep draft” explicitly discards only the old preview and retains proposed input for a fresh review. A committed confirmation clears the retryable preview immediately; a following failed GET leaves a dated saved-revision message and disables new previews until current records load.
- `apps/web/src/offline/finance.ts`, `offline/research-connections.ts`: identical serialized local review/acknowledgement, with actual latest-owned dependency counts. No raw workbook bytes are retained; parsing still uses the existing worker.
- `packages/contracts/src/privacy.ts`, `apps/web/src/offline/accounts.ts`: captured baseline/differences export with existing holdings previews. Connected privacy already spreads `storedHoldingsPreview`; no API privacy rewrite needed. Existing owned preview cascade and local account deletion cover new nested payload. Merge these small additions without dropping newer schedules/report fields.

All existing routes/exports are reused. No controller, worker or migration registration is needed. There are no source/provider calls or market prices. The UI links existing `#allocations` and `#connections` routes; counts are explicitly as-of preview, not a new current-context assertion.

## Authored cases

- Two `packages/contracts/test/holdings-reconciliation.test.mjs` units: fractional quantities, numbers above floating-point precision, all four categories, lexical quantity equivalence, absent rows, complete removal and inconsistent baseline rejection.
- `API400`: real isolated account baseline, four categories, removal acknowledgement, stranger ownership, pending/confirmed private export, later-change successful replay.
- `API401`: actual owned preview mutations for expiry/legacy/corrupt baseline; competing stale previews; successful legacy replay after expiry; concurrent confirmation returns one revision.
- `API402`: actual owned goal allocation plus published-source research connection; exact dependency counts; neither goal/allocation/connection receipts change when holdings are replaced; existing current views flag review.
- `WEB400`: normal responsive project UI, keyboard removal acknowledgement, real replacement/reload.
- `WEB401`: actual competing holdings revision, disabled stale confirmation and preserved proposed CSV; real successful confirmation followed by a synthetic GET503; no retryable form/current-state claim and exactly three saved revisions after recovery.
- `OFFLINE410`: initialized on-device runtime, zero API requests, exact large/fractional removal, acknowledgement, reload/export, old receipt replay, owned deletion and new empty account isolation.
- Updated existing `API090`, `WEB090`, `API268`, corresponding offline research-connection removal to explicitly acknowledge removals. `API240` asserts workbook reconciliation; `API242` still exports old arrays but now expects unconfirmed legacy409 and confirms the reviewed current preview. Existing post-lock auth cases remain applicable; no new lock-delay fixture authored here.

New files: API/browser/offline `holdings-reconciliation.spec.ts`, component, units, spec and this handoff. Existing shared paths above require additive merges; do not copy whole stale privacy modules over later features.

## Parent/manual acceptance

After integration, update root TODO/README/status, `tests/e2e/CATALOG.md` and coverage mapping with the IDs above. Run the authorized shared gates serially; agent did not run them. No install or migration is newly required. Normal configured PostgreSQL/MongoDB and web/API services are prerequisites. At the actual printed web URL, open `#holdings`; import the blank/synthetic standard CSV/XLSX or manually enter synthetic rows. Review the four groups, keyboard-check the removal acknowledgement, confirm, reload, and inspect allocations/connections plus privacy export. Keep real financial data out of fixtures/artifacts.

Manual commands: `pnpm format`, `pnpm check`; `E2E_BROWSER=chrome pnpm e2e:ui` (printed URL, default port9323, watch/eye off), select `@HOLDINGS-RECONCILE-001` for API and desktop/mobile plus updated compatibility cases; `pnpm android:test:ui` for OFFLINE410 and prior offline holdings/research/workbook cases. Parent may use its authorized saved-run equivalent. Rebuild/reinstall the offline APK only through the existing authorized packaging workflow after gates. Report run ID, project/case ID, HTTP status or assertion, and `artifacts/e2e/latest.md` for any failure.

Known scope limits: standard owned replacement only, no arbitrary broker dialects, no inferred cost basis/fees/tax, no market valuation, no automatic repair of dependent allocations/connections. Dependency counts and preview baseline are historical context. Existing retention bounds remain unchanged. No verification or release readiness is claimed before parent gates.

## Peer-review corrections

API preview now reauthorizes immediately after expired-preview cleanup DELETE, because retention can hold that row beyond session expiry. API403 observes an actual owned expired-preview row wait, expires the session after transaction start using the existing bounded auth fixture, expects401 and verifies cleanup rollback/no new preview or holdings revision.

Holdings reads now carry monotonically increasing generations, including explicit draft-preserving baseline refresh; a newer load invalidates earlier initial responses. A401 latches authorization denial and invalidates every outstanding load. WEB402 holds the actual initial200, saves a newer baseline through real API calls, explicitly reloads and types a draft, releases the old response, and verifies neither draft nor baseline is overwritten. This is authoring only; no test/gate execution. Add API403 and WEB402 to the parent catalogue/coverage selection.

Regression harness refinement: API403 explicitly observes the owned blocked cleanup DELETE (the shared auth helper's SELECT-only waiter is not used). WEB402 holds every initial GET until just before explicit Reload, covering both development effect replay and a single production mount; every retained response must be actual200. All retained requests/blockers are released and drained in cleanup. No execution was performed.

## Main compatibility audit

Read-only audit of current main's E2E confirms/helpers found all actual removals covered by the existing scoped compatibility hunks: API090 empty replacement, WEB090 empty replacement, API268 and its offline research-connection equivalent replace Reliance with Infosys. These now explicitly acknowledge the removed ISIN. WEB090 additionally asserts confirmation remains disabled before acknowledgement. API242 is the only existing unconfirmed legacy-array confirmation expectation: it now expects409, confirms a fresh reviewed preview, preserves export assertions, and explicitly verifies the legacy preview stays unconfirmed. API240 additionally checks workbook added-row review.

No further consent changes were needed in retention, auth waits, allocations, overview, privacy, report deletion/populated reports, goal scenarios, workbook browser/local cases or shared setup helpers: they start from empty holdings, keep the same ISIN while changing quantity/cost, or replay an already-confirmed receipt. Existing named inputs/buttons and successful “Holdings saved.” status remain unchanged; no locator weakening was applied. Root's browser/holdings.spec.ts has other edits relative to this worktree base, so merge only the removal acknowledgement/disabled assertion hunk rather than replace its entire file. No product changes or execution in this compatibility pass.

## Parent integration verification

Integrated on main after source-withdrawal4c814ae. Corrected exact-optional stored-preview typing and unused initial boolean assignments before execution. Added actual desktop/mobile review captures and overflow assertions. Connected run2026-09-14T03-49-50-574Z-75463 passed31/31 (all10 child and21 adjacent cases); rebuilt packaged assets passed14/14 offline checks. All126 unit checks and format/check passed; final gate logs use holdings-reconcile-final-* under artifacts. Read-only audit retained exact original account/financial digests,27 migrations and zero temporary PG/Mongo resources. See status for final evidence and physical-phone/APK boundary. No dependency/migration/provider call/push.
