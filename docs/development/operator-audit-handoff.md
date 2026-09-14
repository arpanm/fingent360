# OPS-AUDIT-001 authoring handoff

## State and boundaries

Frozen in `artifacts/task-worktrees/ops-audit-001`, branch `codex/ops-audit-001`, base/local HEAD `30c5ca27c6942f28198be724686a6088bc8795f4`. The worktree was clean before authoring. All listed changes belong to this child; they remain uncommitted pending parent integration and format/check gates. No tests, discovery, formatting, checks, builds, installs, services, migrations, provider requests or commits were executed by the author. No push or watcher.

Bounded read-only peer review by identity_tests found no remaining actionable blocker after corrections to optional-property typing, invalid-filter Retry, strict position fixtures, actual database table/goal fixtures, parent admission for401 after child Back, and complete interception drainage before privacy assertions/teardown. This is inspection evidence, not a test pass.

Specification: `docs/product/operator-audit.md`. The feature reads existing immutable request/event activity. It does not attribute actions to named people, infer successful completion from requests, disclose raw targets/actor hashes, or claim a complete operational audit. Cleanup preview/completion/failure labels describe actual stored events; links open module results without claiming a matching receipt. There is no new provider/source-rights claim.

## Manifest

- `packages/contracts/src/operator-audit.ts` — strict filters, positions, pages, fixed safe event/module mapping and microsecond ordering.
- `packages/contracts/src/index.ts` — additive export.
- `packages/contracts/test/operator-audit.test.mjs` — four meaningful projection/filter/order/bounds units.
- `apps/api/src/operator-audit.ts` — protected GET `/api/v1/ops/audit`;50-row keyset pages, signed cursor bound to filters/upper/before; private/no-store; final session SHARE then wall-clock expiry check.
- `apps/api/src/app.ts` — additive controller registration only.
- `apps/web/src/OperatorAudit.tsx` — extracted audit browser, applied-filter and exact-page recovery, fixed labels/UTC dates, keyboard focus and stale-response guards.
- `apps/web/src/Operations.tsx` — Audit activity tab and shared parent request/session-denial guard; source registry/refresh reads use the same guarded request.
- `apps/web/src/offline/operator-audit.ts` — connected-only local503 with no network or financial mutation.
- `apps/web/src/offline/index.ts` — additive local handler registration.
- `apps/web/src/RetentionOperations.tsx` — one paragraph in existing OfflineOperationsNotice.
- `tests/e2e/helpers/operator-audit.ts` — isolated real source actions/PG audit rows, actual sign-in, owned lock blockers and exact-PID observation.
- `tests/e2e/cases/api/operator-audit.spec.ts` — API480–487.
- `tests/e2e/cases/browser/operator-audit.spec.ts` — WEB480–486.
- `tests/e2e/cases/offline/operator-audit.spec.ts` — OFFLINE490.
- `docs/product/operator-audit.md`, `docs/development/operator-audit-handoff.md`.

No dependency or migration. Existing migration010 and immutability trigger are reused unchanged. The feature never copies audit records into account exports or public/device bundles; it adds no private dataset or cleanup action. No source/financial locks or joins are introduced.

## Integration contracts

Integrate audit before SOURCE-REVIEW-DIFF. Keep other already-integrated controllers, contract exports, local handlers, report/schedule privacy paging and worker controls untouched.

`Operations.sessionExpired()` increments the session generation, marks the session ended, clears protected publications/evidence/media/review/note/key and notices, and presents sign-in. Its `request(...Parameters<typeof json>)` wrapper captures that generation, rejects old successful responses, and sends same-session401 to the parent even when the requesting audit child has unmounted. `load()` uses this wrapper. Initial session reads, sign-out and component unmount share generation invalidation. Audit receives both `request` and `onUnauthorized={sessionExpired}`. Retention/worker callbacks also use `sessionExpired`; SourceEditor/SourceRefresh receive `request`.

When merging SOURCE-REVIEW-DIFF later, wire its `onDenied` callback to **this `sessionExpired`** and preserve guarded `load()` for `onSaved`. Passing guarded `request` into that child also preserves the parent barrier when its read returns401 after the review closes; this integration was communicated to its author. No SourceReview import/conditional has been added here. Existing independent FeedbackInbox/SecurityOperations/MacroOperations internals retain their own handling; this handoff does not claim every old Operations module was rewritten. The shared guarded parent publication/evidence actions and new audit/source reads are the concrete barrier scope.

The cursor is opaque to clients but contains only nonsecret filters and audit tuple positions plus a signature; it contains no actor/session hash or raw target. Fixed upper tuple semantics are chronological, not an MVCC snapshot/export. Late commits of earlier/backdated request timestamps can become visible later. Reset opens a fresh upper boundary; no completeness or completion-time assertion is made. Each query returns at most51 candidate rows/50 displayed rows; PostgreSQL's existing statement timeout bounds unavailable/slow reads. There is no measured workload evidence justifying a new index yet.

## Authored cases

All new cases use `@OPS-AUDIT-001`; synthetic rows/faults also use `@TEST-SIMULATION`. There are **16 distinct E2E cases:8 API,7 browser,1 offline**, plus4 unit cases. Browser cases run in desktop and mobile projects separately; authored is not passed.

| IDs        | Concrete acceptance                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API480     | Real successful and invalid source requests both create request-only audit records; no private body disclosure.                                        |
| API481     | Strict event/module/date filters, repeated/unknown fields, invalid ranges and altered cursor; unchanged stored page.                                   |
| API482     | 115 actual PG records with microsecond and UUID ties,50/50/15 pages, new real activity excluded from fixed upper, exact cursor replay and fresh Reset. |
| API483     | Malicious/unknown action strings become Other; all targets/actor fields withheld; fixed cleanup labels.                                                |
| API484     | Real audit-table wait followed by wall-clock expiry returns401.                                                                                        |
| API485     | Real final-session wait behind revocation/expiry returns401 after already reading the audit rows.                                                      |
| API486     | Actual missing-table503 then same-cursor recovery; no audit insert.                                                                                    |
| API487     | Existing immutable trigger still rejects changes/deletion; exact owned goal preserved and no audit write methods.                                      |
| WEB480     | Keyboard pages/focus, UTC filters, source-section navigation, Back/reload and390px artifact.                                                           |
| WEB481     | Empty→actual successful/invalid source requests→Reset; request-only labels and empty filters.                                                          |
| WEB482     | Initial/older-page503 retry and incomplete-page notice; invalid range has no stale-filter Retry.                                                       |
| WEB483     | Actual older success cannot overwrite new filters; labelled malformed private extras fail closed.                                                      |
| WEB484     | Real401 clears audit and protected parent list before held actual200s arrive.                                                                          |
| WEB485     | Actual sign-out invalidates held successful audit results and protected navigation.                                                                    |
| WEB486     | Actual delayed audit401 after Back clears the parent's protected publication view.                                                                     |
| OFFLINE490 | Connected-only UI/direct bridge denial, actual owned goal survives reload, mobile keyboard/Back, zero outgoing API requests.                           |

Fixtures open only the selected test's actual temporary schema/API; discovery imports perform no setup. Browser writes use `page.evaluate(fetch)` through actual routing, never `page.request` to the wrong backend. Held route responses are actual200/401, explicitly drained and unregistered before fixture teardown. Source title in the privacy race comes from the actual dated packaged Fed edition; synthetic faults are not claimed as live source validation. No provider refresh is required.

## Parent verification and documentation

No dependency installation or database migration is required by this child. Existing local PostgreSQL/MongoDB and a compiled API are prerequisites for the inherited isolated fixture; existing configured operator key is reused. Preserve current data/services.

Parent authorized actions after serial integration:

```bash
pnpm format
pnpm check
pnpm build
E2E_BROWSER=chrome pnpm e2e:run --project=api --grep @OPS-AUDIT-001
E2E_BROWSER=chrome pnpm e2e:run --project=desktop --grep @OPS-AUDIT-001
E2E_BROWSER=chrome pnpm e2e:run --project=mobile --grep @OPS-AUDIT-001
```

Use the existing/printed `pnpm dev` web URL at `/#ops`, sign in and choose Audit activity. The existing test UI (`E2E_BROWSER=chrome pnpm e2e:ui`) can select these exact IDs/tags instead; keep watch off. Rebuild packaged assets using the established Android build flow, then `E2E_BROWSER=chrome pnpm android:test:ui`, select OFFLINE490 and run manually. New code requires rebuilt assets/APK; a phone is not updated by the commit. Physical keyboard/TalkBack, device layout and user design approval remain separate acceptance.

Expected: strict and private read responses, exact stable chronological paging, actual401 prevents stale content restoration, prior immutable rows/goals unchanged, device noAPI. For failures provide `artifacts/e2e/latest.md` run time, selected project/IDs, owned-schema/API annotation and failing assertion/trace; do not share configured keys, raw audit targets or unrelated private data. Record actual run/gate evidence before scoped hooks-disabled local commit; no push.

Root tracker suggestions: register above IDs in CATALOG and coverage plan; update README/status/TODO TEAM007/delivery matrix for the bounded activity browser and its exact limitations. DEV-015/017/021 remain open for named roles, four-eyes review, full successful-action attribution/support audit, broader production observability/security and release acceptance.

## Parent verification

Parent verification: connected run2026-09-14T04-18-51-933Z-86121 passed30/34 including all8 API cases,10 selected existing publication/cleanup/worker/evidence regressions and12 other audit browser instances. WEB481 on desktop/mobile used an exact text locator that omitted the displayed section prefix; it was scoped to the actual paragraph while retaining the request-only semantics and row-count checks. The shared session guard initially replaced the cleanup-specific sign-in recovery message; restored that guidance while retaining the shared invalidation barrier and unchanged cleanup test. Final four-case rerun passed4/4; all34 selected scenarios have passing evidence across these runs. Exact handoffs: artifacts/ops-audit-connected-initial-handoff.md and ops-audit-connected-handoff.md. Rebuilt device assets passed4/4 selected offline cases in4.7seconds (see artifacts/ops-audit-offline-handoff.md). WEB480390px captures from both projects were inspected; no overflow and keyboard pages/filter/navigation passed. Initial typecheck found optional filter values in URLSearchParams; explicitly omitted absent values and reran gates. Format/check passed140 units (37contracts,91API,12tooling); documentation-inclusive final logs are artifacts/ops-audit-final-format.log and ops-audit-final-check.log. Resource audit2026-09-14T04:24:18.511Z found zero temporary PostgreSQL/Mongo resources, exact original account/financial digests and28 migrations preserved. READING-FOLLOW-001 was committed99be437. Shared device assets include the change; final native packaging/physical-device acceptance remain separate.
