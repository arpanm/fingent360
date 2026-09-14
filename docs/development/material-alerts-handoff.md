# MATERIAL-ALERTS-001 handoff

Implementation and cases are authored on main at baseline b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b. No tests, format/check, type checks, builds, provider calls, installation, service/database actions or commits were run. Other agents' pending work and the prior BEA/evidence-layer edits remain uncommitted and were preserved. The user-run gates must verify this new code; source inspection is not a pass.

## Exact manifest

New files:

- `docs/product/material-alerts.md`; this handoff.
- `packages/contracts/src/material-alerts.ts`; `packages/contracts/test/material-alerts.test.mjs`.
- `infra/migrations/039_material_alerts.sql`.
- `apps/api/src/material-alerts.ts`; `apps/api/src/material-alert-store.ts`.
- `apps/web/src/MaterialAlerts.tsx`; `apps/web/src/material-alerts.css`; `apps/web/src/account-request.ts`; `apps/web/src/material-alert-export.ts`.
- `apps/web/src/offline/material-alerts.ts`.
- `tests/e2e/helpers/material-alert-fixture.ts`.
- `tests/e2e/cases/api/material-alerts.spec.ts`; `tests/e2e/cases/browser/material-alerts.spec.ts`; `tests/e2e/cases/offline/material-alerts.spec.ts`.

Additive integration edits:

- `packages/contracts/src/index.ts`: material export; `packages/contracts/src/privacy.ts`: bounded/complete material history fields.
- `apps/api/src/app.ts`: controller registration; `apps/api/src/accounts.ts`: account lock/final authorization/context sync only in saveWatchlist; `apps/api/src/alert-preferences.ts`: shared account locking/auth and context sync; `apps/api/src/privacy.ts`: initial material history page in existing protected repeatable-read export.
- `apps/web/src/Account.tsx`: extracted inbox section and stable generation-guarded request; `apps/web/src/AlertPreferences.tsx`: guarded requests and successful mute notification; `apps/web/src/Privacy.tsx`: complete material pagination before download.
- `apps/web/src/offline/accounts.ts`: watchlist/mute synchronization, private export and deletion; `apps/web/src/offline/index.ts`: local handler registration.

Total: 27 authored/edited feature files, plus root-owned migration registration in `apps/api/src/migrate.ts`. Preserve all concurrent goal feasibility, named operator, quality overview, ECB, mapped-import and source explanation registrations. No dependency change. Root owns TODO/README/status/catalog/coverage and parent status reconciliation.

## Layer acceptance and boundaries

Specification: explicit per-followed-indicator thresholds greater than zero through 100 percentage points, at most six threshold decimals, exact 30-place observation arithmetic. Two current World Bank India annual series only. A first opt-in, threshold change or unmute starts fresh without catch-up. A normal fresh known annual transition advances the baseline even below threshold; a same-year revision records correction context and cannot create a material notice. Initial nulls, stale checks, future period/retrieval dates and older periods cannot become false material results. Prior valid snapshots remain immutable. Future baseline clock anomalies are likewise unassessable.

Workflow/UI: Account → existing Observation inbox → Material changes. Review/consent/save; refresh/check; dated receipt; acknowledge/reopen; history and source/Privacy links. Loading, no-follow/no-rule, invalid settings, cancel/Back, conflict with retained draft, uncertain request retry and saved-response/current-read failure are explicit. Save/replay responses remain historical; only a successful GET restores current context. A typed401 clears private parent/child state, including older in-flight responses. Scoped CSS wraps amounts, hashes and controls at ordinary mobile widths. Visual/keyboard/physical-phone acceptance remains unverified.

API/storage: strict `GET /api/v1/account/inbox/material`, `POST` configure/check/acknowledge, `GET .../history?after=N&upper=N`. Origin and authenticated owner; account SHARE for private reads, account UPDATE for writes/preferences/watchlists, final current-clock require after possible waits and before commit. At most two source heads/check times are read by a single SQL statement. Existing `(indicator,year DESC,revision DESC)` numerical index is reused. Migration039 adds an account head, immutable event/request table, owner/sequence index and account-delete-only removal trigger. Repeated identical request IDs return original receipts; changed reuse conflicts. Competing expected versions conflict. No financial/source rows are modified by material evaluation.

Provenance: source observations retain exact ID/version/year/decimal/provider-update/retrieval/hash/URL and successful-source-check time. Each immutable receipt retains the source capture that justified freshness, its policy snapshot, before/after values and exact difference. A source retrieval or annual period is not a future release schedule or forecast. The genuine dated bundle fixture is separate from tagged synthetic numerical transitions and controlled browser/storage failures. No provider call or live-data validation is performed by this child.

Automation: manual atomic checks only, max two indicators. Current notices coalesce to one per indicator; unchanged/revision/below-threshold checks cause no new notice. Existing mute pauses evaluation; unmute rebases. No new worker, timer, push/email/WhatsApp delivery, market calendar, consensus or investment action. DEV-011/018 remain partial for accepted broader pipeline/calendar/channel scope.

Privacy/local: account cascade deletes all material heads/history; complete Privacy JSON follows every bounded history page with owner/upper/order checks, final boundary and same-owner session verification. Failed or401 pagination produces no partial file. No lifetime history cap. Local mode shares the reducer, reads highest year/revision across actual bundle observations/history, stores through the existing serialized bridge, displays bundle age, survives reload and exports/deletes with its owner. It cannot know later provider changes. Existing report schedules, reading follows, tombstones and other private export pages remain intact.

## Authored cases

| IDs        | Acceptance                                                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API660     | Origin/ownership/consent/bounds, opt-in, same-input replay, changed reuse and unchanged exact goals/holdings                                                                      |
| API661     | Exact two-series batch, below-threshold advancement, same-year correction, coalescing, acknowledgment/reopen and historical replay                                                |
| API662     | Highest initial null, stale source check, future retrieval/year and preserved valid baseline                                                                                      |
| API663     | Mute freeze, unmute fresh baseline, unfollow, more than 100 real receipt writes, fixed-boundary export, database immutability and account cascade                                 |
| API664     | Concurrent same-ID requests serialize to one event; stale competing version conflicts                                                                                             |
| API665     | Real recovery reset ahead of account-lock waiter returns401 and leaves no private material mutation                                                                               |
| API666     | Real observation-table wait then session expiry returns401 and rolls back receipt                                                                                                 |
| API667     | Genuine captured bundle observations/history/check dates copied exactly into owned storage; no provider refresh claim                                                             |
| API668     | Actual owned table lock produces bounded503; same request after release succeeds once                                                                                             |
| WEB660     | Keyboard/normal mobile clicks, review/cancel, saved check, notice acknowledgment/reopen, history, source navigation/Back and safe controlled screenshot/overflow                  |
| WEB661     | Actual committed response is lost, same-ID replay returns old receipt after later record changes, simulatedGET503 leaves current context unavailable, successful refresh recovers |
| WEB662     | Existing mute/unmute controls synchronize material state and durable fresh baseline                                                                                               |
| WEB663     | Real history401 clears account while an earlier valid material GET is held; drained200 cannot restore private state                                                               |
| WEB664     | Complete multi-page Privacy download; actual later-page401 yields no second/partial file                                                                                          |
| WEB665     | Real competing configuration409 retains draft through explicit refresh and resubmission                                                                                           |
| OFFLINE660 | Actual dated bundle, real serialized duplicate requests, reload, owner export/deletion and zero outgoing API requests                                                             |
| OFFLINE661 | Real local handlers with labelled synthetic highest-history revisions, nulls, coalescing, acknowledgment/reopen, mute/unmute, replay, unfollow and expiry                         |
| OFFLINE662 | Real persisted local history beyond100 records, complete Privacy download and zero API traffic                                                                                    |

Counts: 9 API IDs + 6 browser IDs in desktop/mobile = 21 connected selections; 3 offline scenarios; 5 contract units. Stable reservation remainder is unused. New private API/browser/offline specs disable trace/video/automatic screenshots; only WEB660 explicitly captures its synthetic Material changes region. Every browser intercepted route.fetch targets the owned API origin. Held responses are released/drained before final stale-state assertions and fixture teardown. No test discovery side effects.

## Exact user next actions

No new dependencies. Migration039 is required for this child; earlier concurrently authored migrations remain prerequisites. The user controls PostgreSQL/MongoDB, API/web startup and all execution. Follow the repository's normal manual preparation (`pnpm build`, `pnpm db:migrate`, then `pnpm dev` when needed), reviewing the full uncommitted scope before running `pnpm sdlc "Complete stored material observation alerts"`. It stages all nonignored changes, so unrelated concurrent work must be reviewed together or separated by the user. Do not push or enable test watch mode.

Open the current printed web address (last configured http://127.0.0.1:5175/#account; API http://127.0.0.1:4103) and save a followed annual indicator. Review thresholds, baseline/source/check dates, pending stale/null state, normal keyboard navigation, mobile control layout, history and Privacy download. Do not refresh a provider merely to force a notice; synthetic transitions live only in the owned cases.

After user-run format/check/build/migration prerequisites, select `@MATERIAL-ALERTS-001` in the test UI or run the focused connected group manually:

```bash
pnpm e2e:run --project=api --project=desktop --project=mobile --grep='@MATERIAL-ALERTS-001'
```

For packaged local parity, rebuild via the existing Android/offline workflow and select OFFLINE660–662 with `pnpm android:test:ui` (or the existing manual CLI `pnpm android:test --grep='@MATERIAL-ALERTS-001'`). Physical APK/device, screenshot/visual and keyboard acceptance are separate from browser/API results. Expected results are those listed above; no pass is asserted here.

For a failure report, provide the historical run ID/time, selected case/project and targets from `artifacts/e2e/latest.md`, first failing assertion/error-context path, and package/bundle hash for local cases. Omit cookies, passwords, actual exported private data and provider credentials. Current local commit remains b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b; all new work awaits the user's gates/commit.
