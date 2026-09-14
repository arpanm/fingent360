# Publishing queue handoff

PUBLISHING-QUEUE-001 / DEV-015. Implementation complete for the bounded queue; user validation and commit remain pending. The parent previously performed a read-only API/UI/contracts review. No tests, discovery, formatting, lint, type checks, builds, installs, services, migrations, provider calls or commits were executed by the queue author. Original base: `6f2b50821d68b76bd6356efce7a2db258c643fee`. Initial worktree authoring was clean; the final targeted completion pass edits only assigned queue files directly in integrated main, preserving unrelated pending features and root-owned shared seams. Root owns migration activation and shared tracker updates. No push.

## Exact manifest

1. `docs/product/publishing-queue.md`
2. `docs/development/publishing-queue-handoff.md`
3. `packages/contracts/src/publishing-queue.ts`
4. `packages/contracts/src/index.ts` — additive export.
5. `packages/contracts/test/publishing-queue.test.mjs`
6. `apps/api/src/publishing-queue.ts`
7. `apps/api/src/app.ts` — additive controller import/registration.
8. `apps/web/src/PublishingQueue.tsx`
9. `apps/web/src/Operations.tsx` — queue import, refresh invalidation, existing row rendering through `renderItem`.
10. `tests/e2e/helpers/publishing-queue.ts`
11. `tests/e2e/cases/api/publishing-queue.spec.ts`
12. `tests/e2e/cases/browser/publishing-queue.spec.ts`
13. `tests/e2e/cases/offline/publishing-queue.spec.ts`
14. `tests/e2e/cases/browser/operator-audit.spec.ts` — WEB484's held publication route and cleanup now target `/ops/discovery/queue`.
15. `infra/migrations/036_publishing_queue_indexes.sql` — additive edition-order and latest-run indexes.

## Integration seams

The new protected `GET /api/v1/ops/discovery/queue` controller reuses AccountStore's transaction and OperatorStore's authentication/server signing key. It does not modify DiscoveryStore, its legacy items endpoint, source review, ingestion or the main pending post-wait admission changes. It selects at most 21 rows and returns 20. Source classification agrees with `sourceIdFor`; source/status/text are strict and cursors are signed and filter-bound. Embedded control characters reject before storage. Pagination preserves exact six-digit PostgreSQL creation timestamps and C-collated ID ties. All storage reads precede final operator-session SHARE admission and a wall-clock expiry query held through commit. No dependency/provider is added.

Additive036 supplies `discovery_versions_queue_order(created_at DESC,item_id COLLATE "C" DESC) INCLUDE(version)` and `discovery_runs_queue_latest(started_at DESC,id DESC)`. The query now orders/bounds on `v.item_id` to match the index while preserving the equivalent head-ID ordering. No stored edition is changed. Normal index creation participates in the existing migration transaction and can briefly block concurrent writes; it is an explicit setup action, not a promise of zero-downtime deployment. Actual selective query cost remains a user-run EXPLAIN/representative-data validation, especially for substring search and many historical revisions.

Operations retains every existing article/history/evidence/media action through `renderItem(item)`. Its old all-head `load()` becomes an asynchronous queue invalidation with no network call. SourceRefresh's existing `afterRefresh={load}` and SourceReview's existing `onSaved` invalidate the queue. `onLatestRun={setLatest}` preserves the source status receipt. The queue resets to the first page of applied filters after invalidation, clears old actionable rows during reads/failures, and does not close/remount the review dialog.

**Merge only the small Operations diff against main.** This older base still contains its historical inline review dialog; do not copy that dialog over main's SourceReview. Preserve main's SourceReview guarded request/onDenied/onSaved, historical receipt, live guard, exact-head comparison, final authorization after version reads, old-parent-generation error normalization, BEA recovery tab/callback and Retention's specific session-expired guidance. These dependency files are intentionally not copied here. WEB562 targets that already authored exact-head SourceReview integration.

The parent adapted pending main OPS-READ-ADMISSION WEB521's Publishing lock observation to the new bounded SQL (`LIKE SELECT v.data,to_char(v.created_at%FROM discovery_items%LIMIT 21`); retain its exact Source registry query branch. Legacy protected API read cases still target the preserved legacy endpoint. WEB484 is the only existing browser old-list interception changed in this branch. SourceReview's explicit reload may still use the legacy endpoint; this child replaces the publishing queue's unbounded loading/rendering, not every legacy client.

The UI keeps pending bounded GET promises until the shared network timeout, including after leaving the tab, so an actual same-session late401 still reaches the parent denial barrier. Local request generations prevent old content/filters from returning. A different authenticated parent generation remains protected by main's shared wrapper.

## Scope and acceptance

The queue is current state, not an immutable snapshot or complete as-of export. Newly reviewed heads sort first and can move above a traversal's signed boundary; Reset opens a fresh traversal. Text matching is a literal case-insensitive title/summary substring; percent/underscore are not wildcards. Page labels count only displayed rows, with no false total. Previous rereads its bounded page. Retry repeats the failed request and retains an unapplied filter draft; the UI labels applied filters and explains that the draft is not yet applied. A400 invalid page directs Reset without offering an identical failing Retry. Unreadable responses show a plain recovery message. Results may have changed meanwhile.

Root applies the shared SourceReview close callback: after `setReview(null)`, schedule a frame and focus `#publishing-queue-heading` only if no dialog remains open and `document.activeElement` is absent/body. This retains Dialog's normal connected-trigger focus return and restores a usable target when a saved refresh removed that trigger. WEB562 asserts this behavior.

Existing immutable source tables hold every original version, actual published/effective/retrieval dates, attribution and hashes. Queue browsing has no writes or provider calls. Actual dated bundled Fed metadata is read separately in API566; bulk/order/lifecycle/fault fixtures are explicitly synthetic and stored in the real isolated application schema. The component validates server results before display. No new financial calculation, privacy export, account deletion policy, source licence, worker or scheduled work is introduced.

The existing on-device Operations notice and generic connected-required bridge denial are reused without runtime changes. OFFLINE550 reads the actual bridge after initialization, verifies no outgoing API requests and preserves an actual local goal across reload. There is no local queue editor or new content bundle.

## Authored cases

| ID         | Concrete acceptance                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API560     | Unauthorized rejection; actual20-row page; legacy45-row compatibility; unchanged populated goal/source digests.                                                                               |
| API561     | Every existing source classification, status and literal text; unknown/repeated/bounds/mismatched/tampered cursor rejection.                                                                  |
| API562     | Actual microsecond and ID ties across all45 rows; same-request current page repeat; newer reviewed head requires reset; stale version409.                                                     |
| API563     | Actual retained-version or latest-run table wait, owned expiry,401 with no protected content.                                                                                                 |
| API564     | Actual session-row wait followed by committed revoke/expiry denies an already selected page.                                                                                                  |
| API565     | Actual renamed owned storage returns503; restore and repeat the same cursor; originals unchanged.                                                                                             |
| API566     | Actual dated bundled published source retains exact edition, source hash and dates; no refresh run.                                                                                           |
| WEB560     | 20/20/5 pages, previous/next keyboard focus, source/status/text filters, empty/reset, reload, separate source tab, normal-viewport safe visual/overflow artifact; no legacy all-head UI read. |
| WEB561     | Actual second-page storage503, no stale rows, exact request retry, unsent filter draft retained.                                                                                              |
| WEB562     | Existing exact-head review409/reload; successful publication3 receipt survives simulated queue503; no stale action; retry reads edition3 and preserves all originals.                         |
| WEB563     | Held actual old200 cannot overwrite new filters; unexpected response fields fail closed.                                                                                                      |
| WEB564     | Actual queue401 fetched after leaving Publishing clears the same protected parent after delivery; ordinary reads settle first.                                                                |
| WEB565     | Old queue401 held across real sign-out/new login cannot clear the new authenticated parent; real session checked before/after delivery.                                                       |
| OFFLINE550 | Connected-only notice/direct bridge503, zero outgoing API, actual local goal unchanged through reload and keyboard Back.                                                                      |

All held browser routes are released/drained before final assertions and teardown. Operator-key specs disable traces/video/automatic screenshots; WEB560 deliberately captures only controlled synthetic queue rows after the credential form is gone.

API567 additionally verifies combined source/status/text pagination and retry over 65 actual synthetic heads, plus valid/ready ordering indexes in the owned schema. API561 and the existing input unit reject embedded NUL/newline; WEB560/561 assert draft/applied-filter clarity, WEB562 focus recovery, and WEB563 plain malformed-data recovery plus actual invalid-cursor400/reset.

Eight API plus six desktop/mobile cases = **20 connected feature selections**. One offline case and three contract units are authored. Existing adapted WEB484 adds two optional connected regression selections; broader SourceReview/OPSREAD/BEA/source refresh regressions remain relevant after integration. No authored case is a claimed pass. Physical-phone and visual acceptance remain separate.

## User-run next actions

No new dependency. Apply additive036 through the explicitly authorized migration-owner setup path; the runtime role must not perform DDL. Root owns this setup activation and reports its separate evidence. After root reviews all pending scope, the user runs `pnpm sdlc "feat: add a bounded publishing queue"` for the repository's configured format/check and gated local commit workflow. It must not be invoked by the queue author.

Setup checkpoint reported by root on 2026-09-14:035/036 were applied under the user's narrow local setup authority;036 is now immutable. The dedicated runtime role and separated local configuration are active, with web5175/API4103, readiness200 and observed runtime-role database connections. Root also applied the review-close focus fallback. These are setup observations, not queue test/check passes. The queue author ran none of these operations.

For explicit focused acceptance, the existing local PostgreSQL/MongoDB services and built API are required; use `pnpm db:up`, `pnpm build` and `pnpm dev` only as user-run setup when needed. The isolated fixture requires current migrations and CREATE SCHEMA permission on loopback storage. Open the printed dev URL at `/#ops` (normally `http://localhost:5173/#ops`; selected ports take precedence). Choose Publishing, filter/page, inspect an exact review, then check the saved receipt and refreshed queue.

```bash
pnpm e2e:run --grep='@PUBLISHING-QUEUE-001'
pnpm e2e:run --project=desktop --project=mobile --grep='E2E-WEB-484\b'
pnpm e2e:report
```

Alternatively use `pnpm e2e:ui` at its printed URL (usually9323), selecting API560–567 and WEB560–565 on desktop/mobile. Use the existing user-run packaged-device test workflow to select OFFLINE550 after rebuilding the device web package; an already installed APK requires rebuild/reinstall for changed web code. Do not run an unrestricted legacy/provider suite as implicit validation of this child.

Expected evidence is 20 focused connected passes, the selected WEB484 regressions, one offline pass and the three contract cases within user-run checks. On failure report run time/ID, case/project, safe error, current source/filter/page state and owned-schema annotation from `artifacts/e2e/latest.md`; include the deliberately safe screenshot for layout problems. Do not attach operator keys, cookies, raw connection strings or protected real source bodies. No new commit exists; all fifteen feature files remain uncommitted alongside other root-owned work pending user gates.
