# SOURCE-WITHDRAWAL-001 handoff

Authoring is complete in `artifacts/task-worktrees/source-withdrawal-001`, branch `codex/source-withdrawal-001`, base/current commit `4318237589a6c6ece7a8dd2c23873ac0cf3e7a52`. The worktree began clean. All changes listed below belong to this child and are uncommitted, awaiting parent integration and gates. No tests, discovery, formatting, checks, builds, dependency installation, migrations, services, provider requests, snapshot regeneration or commits were run by this agent. Root owns shared trackers and the gated commit.

## Disclosure decision

An editorial withdrawal retains the actual immutable editions internally. Public current/history becomes a dated tombstone; evidence, reviewed media and related context become unavailable. Current withdrawal redacts every public historical edition. Explicit republication restores permitted published histories while withdrawal editions remain tombstones. Original-source, evidence, visual and create-connection reader controls are absent for a known withdrawal.

Public evidence is a selected published-edition JSON excerpt. Its hash identifies the complete retained provider response, **not the excerpt bytes**. BEA retains its narrower release-metadata scope. A still-published sibling cannot expose the shared RSS body containing a withdrawn item. Protected operator routes retain full original editions, raw evidence and media records, with authorization checked after blocking publication/media reads and review locks.

Saved reading, reminder creation replay/update/cancel, delivered notification and privacy export responses project unavailable provider text without rewriting stored snapshots, versions, request identity or reminder state. API122 intentionally changes its withdrawn summary/title expectation. Own notes, financial records, connection/inbox minimal receipts and separately consented issued report copies remain immutable. Accepted macro observations/evidence, security identities and source approvals have their separate existing publication policies.

The local resolver chooses the highest non-draft edition from feed plus histories, including when the feed omits that item. The snapshot collector obtains a final admitted manifest after all public reads, omits withdrawn items/assets and refuses a changed current edition before atomically replacing the bundle. Existing disconnected installations cannot learn subsequent server withdrawal until their dated bundle is replaced. Previously downloaded personal copies cannot be recalled.

## Layers and acceptance

| Layer         | Authored behavior and acceptance                                                                                                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specification | `docs/product/source-withdrawal.md` defines public/protected/private scope, admitted-read timing, republication and disconnected limits.                                                                                                           |
| Contracts     | Strict runtime source, public evidence, library status and final publication-manifest schemas; projection tests preserve input objects and hashes.                                                                                                 |
| Database      | Existing immutable source/media/library tables are reused. No migration or cleanup. Actual lock tests use owned PostgreSQL records; original Mongo evidence remains retained.                                                                      |
| API/workflow  | Sorted source admission, current/history/evidence/media/context/feed fences, scoped evidence, protected originals, library/replay/export and final assistance revalidation.                                                                        |
| Authorization | Private account-before-source order and current-clock rechecks; coherent export locks account then session under repeatable read, treating a changed session snapshot as 401. Publishing/media reauthorize after blocking locks.                   |
| Automation    | Existing reminder worker only: bounded candidates → sorted available account locks → sorted source admission → still-due reminder claims. Root worker-control admission remains first. No new refresh, polling or external delivery service.       |
| UI/UX         | Reader Refresh reading, safe history/Back/keyboard, typed evidence scope, withdrawn controls, Saved refresh/remove/cancel and escaped protected-original dialogs; loading/error/retry states remain connected.                                     |
| Offline       | Current/history/evidence/media/library/export use actual local handlers and highest non-draft dated content. Genuine packaged reading has durable account/save/delete and zero outgoing API checks. Synthetic withdrawals are explicitly labelled. |
| Real data     | Genuine parent-bundled Fed reading is used separately from synthetic lifecycle/race records. This child makes no provider, source-rights or current-data validation claim.                                                                         |
| Tests         | 23 new E2E cases and three contract unit cases authored, not executed. Connected API/PG/Mongo cases and browser routes use the actual per-test owned app.                                                                                          |
| Documentation | This handoff and product spec; root integrates TODO, README, status, catalogue, coverage and delivery matrix. Physical-device and user-design acceptance remain separate.                                                                          |

## File manifest

New files:

- `packages/contracts/src/publication.ts`
- `packages/contracts/test/publication.test.mjs`
- `apps/api/src/publication.ts`
- `scripts/lib/finalize-public-snapshot.mjs`
- `tests/e2e/helpers/withdrawal-fixture.ts`
- `tests/e2e/cases/api/source-withdrawal.spec.ts`
- `tests/e2e/cases/browser/source-withdrawal.spec.ts`
- `tests/e2e/cases/offline/source-withdrawal.spec.ts`
- `docs/product/source-withdrawal.md`
- `docs/development/source-withdrawal-handoff.md`

Modified files:

- `packages/contracts/src/discovery.ts`, `library.ts`, `index.ts`
- `apps/api/src/discovery.ts`, `media.ts`, `library.ts`, `library-worker.ts`, `privacy.ts`, `assistance.ts`, `research-connections.ts`
- `apps/web/src/Discovery.tsx`, `MediaSummary.tsx`, `Saved.tsx`, `Operations.tsx`
- `apps/web/src/offline/content.ts`, `library.ts`, `accounts.ts`
- `scripts/offline-snapshot.mjs`
- `tests/e2e/cases/api/library.spec.ts` — intentional API122 projection revision, preserved underlying snapshot asserted in API372.
- `tests/e2e/cases/offline/bea.spec.ts` — OFFLINE353's pre-BEA simulation must remove BEA history/evidence/media as well as feed, because a published history now correctly makes the item available.

No root trackers, generated bundle, dependencies or migrations are changed. No supporting files from the newer worker-health/schedules branches are copied here.

## Cases to register

All cases carry `@SOURCE-WITHDRAWAL-001`. Lifecycle, lock, explicit outage and synthetic transport cases also carry `@TEST-SIMULATION`. Imports perform no database/provider work. Operator/private recordings are disabled in connected cases.

| ID         | Concrete assertion                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API370     | Actual withdrawal/republication: public tombstones/404s, original PostgreSQL editions and protected Mongo/media access preserved.                                  |
| API371     | Published sibling evidence excludes withdrawn shared-RSS text; scoped hash and protected original are distinct.                                                    |
| API372     | Saved/reminder replay/edit/cancel/notification/export projection; stored snapshots and exact finances unchanged.                                                   |
| API373     | Actual source lock queues across current/history/evidence/media/context/feed deny disclosure admitted after withdrawal.                                            |
| API374     | Session expiring during source admission cannot save or return private state.                                                                                      |
| API375     | Actual owned connection, issued v2 report worker, review check and privacy export preserve own notes/minimal immutable receipts through withdrawal.                |
| API376     | Actual final manifest omits withdrawn items/unpublished media and rejects changed current editions before snapshot replacement.                                    |
| API377     | Guest and expired waiting operator cannot read protected originals.                                                                                                |
| API378     | Actual assistance controller/database with explicitly simulated fixed-provider response: withdrawal during async selection removes the stale selected source.      |
| API379     | Operator expiry during source review and existing-asset generation lock waits prevents protected response/write.                                                   |
| API380     | Actual recovery reset queued before a coherent export prevents stale repeatable-read session disclosure; recovered export preserves records.                       |
| API381     | Export admitted before a source wait holds account/session until assembled; later recovery waits and revokes subsequent export.                                    |
| API382     | Personalized feed cannot include a newly published source outside its original locked source set.                                                                  |
| API383     | Actual manual reminder worker, withdrawal and private cancellation use observed operation/PID lock ordering; no notification or deadlock, retained original title. |
| WEB370     | Reader/media/evidence → withdrawal refresh → safe keyboard history, hidden CTAs, Back and mobile width.                                                            |
| WEB371     | An old held successful history response cannot restore source text after current withdrawal refresh.                                                               |
| WEB372     | Saved refresh redacts text and keeps remove/cancel controls with unavailable source navigation.                                                                    |
| WEB373     | Protected retained history/evidence is readable and escaped; operations sign-out removes private state.                                                            |
| WEB374     | Related/learning research filters withdrawn items; current read503 retry recovers against the actual API.                                                          |
| OFFLINE390 | Genuine dated bundled source/evidence, persisted account/save/reload/export/delete through the actual bridge, zero API requests.                                   |
| OFFLINE391 | Synthetic newer withdrawal history overrides stale feed across actual public handlers, without changing bundle originals.                                          |
| OFFLINE392 | Actual local handlers retain notes, reports and stored snapshots while projecting reminder replay/export and deletion; serialized state round-trip, zero network.  |
| OFFLINE393 | History-only explicit republication is current; withdrawal history stays redacted and evidence binds the new edition.                                              |

API384–389, WEB375–389 and OFFLINE394–409 remain unused. API383 depends on the already-parent-integrated `manualWorkers` fixture option from WORKER-HEALTH-001; its describe alone disables fixture timers, while API375 deliberately exercises the ordinary report worker. The helper records exact expected SQL wait/PID chains and refreshes PostgreSQL statistics. Do not replace those observations with sleeps or aggregate waiter counts.

## Parent integration and exact manual validation

1. Merge this manifest after BEA, worker-health and schedules. Preserve `admitWorker(client, 'reminders')` as the first worker transaction operation and the parent's health observation/tick code around the revised delivery body. Preserve schedule pagination/privacy/export additions when integrating `privacy.ts` and local `accounts.ts`. Keep account → authenticated session → source ordering for the coherent export. Preserve current-clock session checks and all report advisory/job rechecks.
2. No dependency installation or new migration is needed. Parent-authorized `pnpm format` then `pnpm check` are required before a scoped commit. Existing PostgreSQL, MongoDB, API and web services must be available through the user's normal `pnpm db:up` / `pnpm dev` workflow; fixtures require the compiled API/contracts and owned-schema creation permission. The agent has not run any of these commands.
3. Connected cases: `pnpm e2e:run --project=api --grep @SOURCE-WITHDRAWAL-001`; `E2E_BROWSER=chrome pnpm e2e:run --project=desktop --project=mobile --grep @SOURCE-WITHDRAWAL-001`. Also select API122, API277, BEA323/328 and existing media/worker-reminder regressions. Alternatively use `E2E_BROWSER=chrome pnpm e2e:ui`, select those IDs/projects and click Run with watch off. API fixtures use actual owned PostgreSQL/Mongo namespaces; no provider fetch is required for these new cases.
4. UI URL is the web origin printed by `pnpm dev` (normally `http://localhost:5173`), using `/#read/<published-id>`, `/#saved`, `/#learning?question=<id>` and `/#ops`. The test UI prints its actual port, preferred9323 or a free alternative. Manually inspect mobile/keyboard/focus and source unavailable/error states; browser assertions alone do not complete physical-phone/TalkBack or user-design acceptance.
5. After the connected gates, use actual reviewed public data for parent-run `pnpm android:snapshot`. No provider refresh is introduced by this script: all reads are public loopback API routes. Record the new dated bundle provenance; synthetic lifecycle records must remain in owned test databases. The final manifest must be fetched after collection; source changes refuse replacement rather than silently mixing editions.
6. Build the package with `pnpm android:web`, then `E2E_BROWSER=chrome pnpm android:test:ui`, selecting OFFLINE390–393 plus OFFLINE353 and adjacent library/connection/report/review scenarios, or `E2E_BROWSER=chrome pnpm android:test --grep '@SOURCE-WITHDRAWAL-001|E2E-OFFLINE-353'`. Expected: actual dated source, unavailable text projection, durable owned privacy/delete and zero outgoing API requests. Await the visible On-device mode marker after navigation/reload before direct bridge fetches. APK/physical-device delivery remains separate.
7. Failure evidence: exact run ID/time, selected case IDs/projects, printed target URLs, `artifacts/e2e/latest.md`, owned-schema annotation and the failing assertion/allowed trace. Do not include credentials or real private records. Gate the scoped local commit only after authorized format/check succeed; never push automatically. Current authoring HEAD remains `4318237`, with the listed changes uncommitted.

## Parent integration and verification

Integrated over0e109ab, retaining worker-control admission first, all health instrumentation and complete schedule privacy exports. Existing library-worker units now exercise full admitted source editions, account/source order, paused/ineligible/no-longer-due behavior. API375 uses the actual201 review-check status; WEB374 targets the actual alert; OFFLINE392 distinguishes operation receipt from authoritative inbox notice. New public bundle179items/52annual histories/22visuals/5identities was collected at2026-09-14T01:59:50.228Z with final manifest, no provider refresh. Connected27/27 and earlier27worker/source regressions passed; all26selected offline scenarios have passing evidence across correction runs. Full run IDs,124unit gates, visual/private-record/resource audits and explicit device limits are in status. Local gated commit follows; no push.
