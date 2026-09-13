# RETENTION-001 integration handoff

Authored in `artifacts/task-worktrees/retention-001`, branch `codex/retention-001`, base/HEAD `0a91aff`. No local commit was created. All twenty files below remain uncommitted for parent review, integration and gates. No pre-existing worktree changes were present when this child began. Main-app data was never opened or cleaned by this child.

No dependency changes. No tests, smoke checks, browsers, typechecks, format/lint, builds, installation, migrations, services, commits or pushes were run. Prior TEAM-002 evidence does not verify this feature. Parent owns TODO, README, status, test catalog, coverage plan and delivery matrix updates.

## Frozen implementation manifest

| Layer                                                                                                      | Files                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Strict policy/input/result/history contracts                                                               | `packages/contracts/src/retention.ts`; export in `packages/contracts/src/index.ts`                                          |
| Durable preview/result, preservation trigger, expiry indexes                                               | `infra/migrations/022_retention.sql`; registration in `apps/api/src/migrate.ts`                                             |
| Fixed allowlist, authenticated server-cutoff preview, bounded serialized cleanup, rollback/replay, history | `apps/api/src/retention.ts`; registration in `apps/api/src/app.ts`                                                          |
| Existing holdings receipt preservation                                                                     | `apps/api/src/holdings.ts`; `apps/web/src/offline/finance.ts`                                                               |
| Operations workflow, session recovery, offline notice, responsive layout                                   | `apps/web/src/RetentionOperations.tsx`; `apps/web/src/retention.css`; `apps/web/src/Operations.tsx`; `apps/web/src/App.tsx` |
| Explicit unavailable local endpoint                                                                        | `apps/web/src/offline/retention.ts`; registration in `apps/web/src/offline/index.ts`                                        |
| Owned real API/database fixture helpers                                                                    | `tests/e2e/helpers/retention.ts`                                                                                            |
| API regression                                                                                             | `tests/e2e/cases/api/retention.spec.ts`                                                                                     |
| Desktop/mobile browser regression                                                                          | `tests/e2e/cases/browser/retention.spec.ts`                                                                                 |
| Packaged offline regression                                                                                | `tests/e2e/cases/offline/retention.spec.ts`                                                                                 |
| Scope, acceptance and operational handoff                                                                  | `docs/product/retention.md`; this file                                                                                      |

Integration overlaps with sibling work are the migration registration (preserve report migration021 before022), application/Operations registration, and the API/device holdings preview code. Keep the predicates `confirmed_version IS NULL` / `confirmedVersion === null` in expiry/capacity handling when merging XLSX changes. Confirmed receipts remain immutable replay references and do not consume the twenty-draft limit.

## Layer acceptance and boundaries

- Specification: fixed existing expiry rules only; no arbitrary financial deletion policy or caller-supplied table/cutoff. See the policy table in the product spec.
- UI/UX: Operations tab, eight count cards, loading/empty/error, saved preview, explicit bounded confirmation, Cancel/Escape, result/retry/history, sign-in recovery, focused result headings and responsive wrapping.
- API/contracts: all responses parsed; all endpoints require an operator session; mutations also require configured Origin. Store admission rechecks and holds the operator session until transaction completion. Account sessions cannot authorize cleanup.
- Workflow/data: schema-scoped advisory lock, row locks, one saved server cutoff, same-ID preview/execution replay, atomic result and audit, completed-record preservation trigger, twenty-item cursor history. Failure rolls every category back before recording a generic failed state; interrupted connections roll back the whole transaction.
- Real data/provenance: production reads actual persisted expiry fields. Tests register actual isolated accounts, accept holdings/feedback through the actual API, issue an actual saved record report, and explicitly age synthetic owned rows. No provider is called or source rights implied. Financial/source tables and source Mongo evidence have no cleanup code path.
- Automation: intentionally absent. An authenticated operator triggers every preview and confirmed batch. There is no timer, worker, scheduled deletion or automatic retry.
- Privacy: output stores counts, times, policy and run identity. Existing operator audit records action/run identity with the existing opaque actor hash; no raw session token, username, address, row body or attachment enters retention output. Expired feedback bytes and contents are scrubbed while tombstone/idempotency metadata and feedback audit remain.
- Offline: connected requirement with App settings/reading links, no cleanup control, explicit local503 and no API network traffic. Local account and financial state remains unchanged. Existing local preview receipt preservation is included.
- Tests/docs: cases below authored; execution and manual visual/native acceptance remain for parent/user. Broader DEV-017/021 backup, encryption, infrastructure and release requirements stay open.

## Case selection

All cases use `@RETENTION-001`; browser cases run in both `desktop` and `mobile`.

| IDs             | Acceptance                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E-API-250     | Eight expired/fresh scopes, actual issued report and financial preservation, feedback bytes scrubbed, tombstone replay, confirmed receipt replay, count-only immutable result/audit |
| E2E-API-251     | Operator authorization, Origin, strict unknown/policy fields, invalid cursor, missing record, explicit confirmation                                                                 |
| E2E-API-252     | Concurrent operators, duplicate preview/result identity, cap/remainder and post-cutoff expiry preservation                                                                          |
| E2E-API-253     | Later-category SQL failure rolls back earlier deletions; same saved preview retries; generic failure state                                                                          |
| E2E-API-254     | Ordinary preview keeps expired confirmed receipts, excludes them from draft capacity; bounded history pagination                                                                    |
| E2E-API-255     | Owned API database connection interruption rolls back unfinished cleanup; original preview retries                                                                                  |
| E2E-API-256     | Real feedback automatic-expiry race, count correctness and no resurrection                                                                                                          |
| E2E-API-257     | All eight category caps, smaller feedback batch, truthful remaining counts                                                                                                          |
| E2E-WEB-250     | Loading, saved preview, Cancel/Escape, keyboard confirm, focus, result/history/reload, mobile overflow                                                                              |
| E2E-WEB-251     | Failed history read recovers to real empty preview                                                                                                                                  |
| E2E-WEB-252     | Actual committed preview/execution responses dropped; retry/reload prevents duplicate cleanup                                                                                       |
| E2E-WEB-253     | Actual SQL failure, visible rollback and keyboard retry                                                                                                                             |
| E2E-WEB-254     | Expired operations session returns to sign-in, then reopens saved preview                                                                                                           |
| E2E-OFFLINE-280 | Connected requirement, keyboard settings/reading navigation, zero API network, unchanged device workspace                                                                           |
| E2E-OFFLINE-281 | Local confirmed receipt preservation and draft capacity across expiry/reload                                                                                                        |

Connected tests reuse `helpers/app-fixture.ts` and the real temporary API/schema/Mongo lifecycle. The pg helper loads through `createRequire` anchored to the API package and requires the exact `e2e_feedback_<32hex>` search path. It never falls back to the main app URL/schema. Trace, screenshot and video capture are off for credential-bearing cases. Browser failure routes abort reads or drop actual owned API response delivery; they never fabricate successful responses.

API255 needs permission to terminate a connection owned by the same database role. It discovers a sleeping retention query only when it also holds a relation lock in the exact owned schema, then terminates only that connection. No process, shared application session, container or service is stopped. Fixture teardown removes only its namespace. If this database permission is restricted, report that specific case as blocked; do not weaken isolation or stop a shared service.

## Parent/user manual next actions

Integrate these files into the parent checkout before execution. Do not run tests from the nested worktree without its own reviewed environment. No new install is needed when current pinned dependencies are already installed.

1. Review integration conflicts, especially migrations021/022 and XLSX holdings preservation. Update parent-owned trackers/catalog/matrix with the authored IDs above.
2. Run `pnpm format`, then `pnpm check`. These gates also build the API used by isolated fixtures. No gate success is asserted here.
3. For connected cases, use the existing local PostgreSQL/MongoDB and web application: `pnpm db:up` and `pnpm dev` if they are not running. The parent-selected `.env` needs loopback database URLs and the existing operator key. Fixture tests apply migrations only to owned schemas; normal `pnpm db:migrate` adds the app schema migration when manually preparing its UI, and never executes cleanup.
4. Run `E2E_BROWSER=chrome pnpm e2e:run --project=api --project=desktop --project=mobile --grep @RETENTION-001`, or `E2E_BROWSER=chrome pnpm e2e:ui` and select that tag/project manually. Expected connected selection: eight API cases plus five browser cases in each viewport, eighteen total. Keep watch/eye mode off.
5. Rebuild packaged device assets with `pnpm android:web` (or `pnpm android:build` for APK acceptance), then run `E2E_BROWSER=chrome pnpm android:test --grep @RETENTION-001`. Expected: two offline cases; this asset test needs no API/database. The launcher prints its loopback asset URL and closes it when finished.
6. Manually open the web URL printed by `pnpm dev` (default `http://127.0.0.1:5173/#ops`; actual selected port takes precedence). Operations → Expired data cleanup should be usable at desktop and390px widths. Review eight count labels, times, caps, button wrapping, contrast and focus order. On the user's actual application, preview/history/Cancel are sufficient; **do not confirm cleanup on user data as verification**. Use the isolated cases for deletion acceptance.
7. On a packaged device, open Operations and verify the connected requirement, settings link, reading return, narrow layout and Android Back behavior; no API connection or local data loss should occur. Record the APK/build SHA256 for native issues.

Expected behavior: preview/history never delete business data; only explicit confirmation cleans a bounded saved-cutoff batch; repeated execution returns the original result; failures never leave a partial category cleanup. Full connected/offline regression can follow at parent discretion after targeted gates.

For failures report the historical run ID/time, selected IDs/projects, actual printed targets, safe assertion/visible message and exact owned schema annotation from `artifacts/e2e/latest.md` or its historical handoff. Never attach operator keys, database URLs, session cookies, recovery codes, private feedback or financial exports. Do not infer a pass from authored files or a later commit.

After parent gates pass, inspect the intended staged scope and make its separate local commit with hooks disabled as repository instructions require. No push. This child leaves HEAD at `0a91aff` awaiting those gates.

## Parent integration evidence

Merged migration021/022 and contracts exports explicitly, preserving XLSX parser/provenance and confirmed-preview expiry/capacity rules. Corrected the UUID helper annotation and the actual checked-out client-error crash exposed by API255. The completed18-case feature has passing API/desktop/mobile evidence across correction runs, including an unchanged retry after one Chrome launch failure. Five packaged offline regressions passed; financial/account digests are unchanged and temporary resources are cleared. Exact handoffs and boundaries are in status; final format/check gates precede the scoped local commit. Migration022 is applied locally. No cleanup ran on application data.
