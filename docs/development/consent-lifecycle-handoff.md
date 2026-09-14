# CONSENT-LIFECYCLE-001 handoff

Implementation authored on main at baseline `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`; verification and gated commit remain user-run. No test/discovery, format/check, type check, build, dependency installation, provider request, migration, service or commit was executed. Existing uncommitted regression, named-operator, goals, source, event, benchmark, import and material-alert work is preserved. Root owns aggregate trackers and migration registration.

## Exact manifest

New files (16):

- `docs/product/consent-lifecycle.md`; this handoff.
- `packages/contracts/src/consents.ts`; `packages/contracts/test/consents.test.mjs`.
- `infra/migrations/043_consent_lifecycle.sql`.
- `apps/api/src/consent-store.ts`; `apps/api/src/consents.ts`.
- `apps/web/src/PurposeConsents.tsx`; `apps/web/src/purpose-consents.css`; `apps/web/src/consent-export.ts`.
- `apps/web/src/offline/consents.ts`.
- `tests/e2e/helpers/consent-fixture.ts`; `tests/e2e/helpers/consent-dispatch-process.mjs`.
- `tests/e2e/cases/api/consents.spec.ts`; `tests/e2e/cases/browser/consents.spec.ts`; `tests/e2e/cases/offline/consents.spec.ts`.

Additive existing files (18):

- `packages/contracts/src/index.ts`, `assistance.ts`, `report-schedules.ts`, `privacy.ts`: exports, evaluated purpose views and bounded/complete privacy history.
- `apps/api/src/app.ts`: controller registration only; `assistance.ts`: explicit external grant, current private-record/version binding, dispatch/final result admission; `library.ts`: dated opt-in and chronological fallback; `report-schedules.ts`: active purpose admission, future-only renewal and worker enforcement; `privacy.ts`: initial current/history consent snapshot under existing account/session admission.
- `apps/web/src/Privacy.tsx`: complete consent pagination and child registration; `SmartHelp.tsx`: current grant disclosure/recovery, independent query help and local stale-result/session clearing; `Saved.tsx`: real first For-you purpose disclosure; `ReportSchedules.tsx`: current purpose and first active-schedule disclosure.
- `apps/web/src/offline/index.ts`: handler registration; `accounts.ts`: consent export and owner deletion key; `assistance.ts`: evaluated purpose view without remote capability; `library.ts`: first opt-in and revoked/expired fallback; `report-schedules.ts`: expiry/revocation admission and dated first opt-in.

Total 34 feature files. Root's existing `apps/api/src/migrate.ts` registration includes043. No new dependency. Shared app/index/privacy/account edits preserve all concurrent event, ECB/oil, material-auto, private-export pagination and worker-health seams. Do not replace those files wholesale from an older worktree.

## Policy and layer acceptance

Four purposes: external AI private context; personalized reading order; scheduled saved-record reviews; automatic material checks. Account creation never grants them. Existing explicit For-you configuration may supply an unknown-date legacy basis; existing immutable active-schedule request receipts may supply their actual dated basis. Reads never invent history. External AI and automatic material checks have no legacy basis. New actual opt-in actions record their first head in the same transaction, with their displayed purpose disclosure. An explicit revoked/expired head requires Privacy renewal.

Strict reviewed changes use UUID replay identity, expected version and fixed policy version. Grant/renew choose no expiry or a future expiry within366 days. Dates and transition/receipt actions reconcile; known future grant/change/basis dates cannot authorize use. Exact retries return historical receipts; changed reuse or stale versions conflict. Ledger events are immutable with account-delete-only cascade. There are at most four heads per account, no lifetime history cap, and numeric sequence pages of100 rows. Complete Privacy JSON follows every owner/boundary page, requires the final retained sequence and rechecks the current owner before download. Own read/export/deletion and financial records remain available after revocation.

External dispatch uses account SHARE, source admission, current private-record existence/version and exact active purpose before starting the fixed-host transport. The remote promise is awaited outside database locks. Already admitted requests may have been transmitted before a later revocation; they cannot be recalled. Final output rechecks account/source/private record binding and the identical active grant version. Revoke→renew cannot restore an older provider result. Goal edit/removal, holdings replacement and saved-reading removal/version changes discard old private candidates. Internal bindings are never added to public response sources or provider context. Query-based help is independent of the external grant and returns only still-current references.

For-you ranking uses chronological order while the reading purpose is inactive, preserving saved choices and showing the reason. Existing explicit filters/mutes continue. Page identity includes evaluated consent state/version. The final authorization/expiry check occurs after possible storage waits.

Scheduled capture retains worker-control admission first and account-before-schedule locks. Candidate selection excludes denied/expired/future heads and no-head accounts without actual schedule opt-in receipts. Actual capture checks purpose before and after saved-record reads and at final write; failure rolls back jobs, occurrences, due cursor and capacity. Existing captured jobs/reports remain. Renewal after lapse moves active schedules to the next future occurrence, records those effects without rewriting immutable schedule editions and leaves paused schedules paused. No consent-lapse catch-up.

`automatic-material-checks` is a separate purpose consumed by MATERIAL-AUTO-001. Its automatic state binds the consent version on explicit Enable. Renewal cannot silently resume an old enabled baseline; explicitly Enable/Resume again for a fresh baseline and next24-hour due. That child owns its worker/settings/due-state implementation and API790+/WEB790+/OFFLINE790+ cases. This child owns the common fourth-purpose schema, ledger, Privacy UI and enforcement helpers.

Privacy UI supports initial/empty/history loading, date validation, grant/renew/revoke review, explicit confirmation, edit/cancel, exact retry, conflict re-review, saved receipt, current-read failure/recovery, keyboard focus and responsive controls. A saved/replayed receipt does not establish current permission. The parent Privacy request barrier removes this child and downloads on real401; held earlier results cannot restore private state. SmartHelp links directly to Privacy and keeps query-based own-record help usable. Separate on-device state uses the same reducer, serialized persistence, owner export/deletion and no network capability. The installed bundle date remains visible in local reading; local scheduling runs only while that app is open.

## Authored cases

| IDs        | Acceptance                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API760     | Four default absences, strict review/date/version/query/Origin validation, concurrent exact replay, stale/changed reuse, foreign owner isolation and unchanged exact goals/holdings                                                                                          |
| API761     | Genuine dated public source, actual For-you opt-in, revocation chronological fallback, blocked re-enable, explicit renewal and independently usable own-record query assistance                                                                                              |
| API762     | More than100 actual immutable events, numeric fixed-boundary pagination despite a later change, owner export, immutable UPDATE denial and account cascade                                                                                                                    |
| API763     | Actual schedule opt-in, simulated expired clock state, real worker capture denial, next-future renewal effect without catch-up, immutable original schedule, subsequent permitted capture and preserved report after revoke/pause/delete                                     |
| API764     | Actual recovery reset ahead of account waiter returns401 with no grant/event                                                                                                                                                                                                 |
| API765     | Actual consent-head table wait followed by session expiry returns401 without private payload                                                                                                                                                                                 |
| API766     | Actual prior-generation preference storage shape gives labeled unknown-date legacy basis without GET writes; no external grant inferred                                                                                                                                      |
| API767     | Actual controller/AccountStore with explicitly synthetic non-network transport: ungranted private sharing never dispatches; real revoke→renew during pending transport discards output; real goal deletion during transport and edit between load/dispatch suppress old text |
| API768     | Actual schedule worker blocked on private-record table, test clock-state expiry, full snapshot/occurrence/capacity/cursor rollback                                                                                                                                           |
| WEB760     | Normal keyboard/mobile review/cancel, grant, chosen expiry, renewal/revoke, history, Back, overflow and explicit harmless synthetic screenshot                                                                                                                               |
| WEB761     | Actual committed response lost, exact replay after later revocation, simulated currentGET503 retains historical receipt and no current card, refresh restores revoked truth                                                                                                  |
| WEB762     | Real history401 clears Privacy while a valid earlier GET is held; drain cannot restore protected controls                                                                                                                                                                    |
| WEB763     | Competing change keeps draft and requires explicit re-review/confirmation as a renewal                                                                                                                                                                                       |
| WEB764     | All consent-history pages downloaded; real later-page401 produces no partial download                                                                                                                                                                                        |
| OFFLINE760 | Real persisted bridge grants/replays/revokes/reloads, retains query help and records, exports/deletes owned ledger and emits zeroAPI requests                                                                                                                                |
| OFFLINE761 | Real local handlers with labeled clock-state simulation enforce scheduled expiry, no catch-up renewal, immutable editions, pause/resume denial and chronological reading fallback                                                                                            |
| OFFLINE762 | More than100 persisted local decisions, complete Privacy download and zeroAPI                                                                                                                                                                                                |

Counts: 9 API cases + 5 browser cases on desktop/mobile =19 connected selections; 3 offline cases; 5 contract units. All three new private specs disable trace/video/automatic screenshots. Only WEB760 explicitly captures its synthetic purpose region. Held browser route fetches explicitly target the owned API, release and drain before final privacy assertions/teardown. Imports/discovery create no accounts, databases, processes or provider activity. The transport subprocess is invoked only inside API767 and validates its owned loopback schema before using real storage. It never loads `.env`, forwards credentials or calls an external provider.

## Exact user next actions

No dependencies changed. Review the full uncommitted scope, then use the documented manual prerequisites: `pnpm build`, `pnpm db:migrate` (043 and earlier additive migrations;044 for the separate material-auto feature), and `pnpm dev` as needed. PostgreSQL/MongoDB and the API/web are required for connected cases. These commands were not run here. The last configured UI is http://127.0.0.1:5175/#privacy and API http://127.0.0.1:4103; use the URLs printed by the user's current launcher. No current health check is claimed.

Run `pnpm sdlc "Complete purpose consent lifecycle"` only after reviewing that it stages all nonignored changes, including concurrent features. Format/check must pass before its local commit. It does not start services or apply migrations. Keep watch/eye mode off; do not push automatically.

For focused acceptance after the user's prerequisites, select `@CONSENT-LIFECYCLE-001` in `pnpm e2e:ui`, or manually:

```bash
pnpm e2e:run --project=api --project=desktop --project=mobile --grep='@CONSENT-LIFECYCLE-001'
pnpm android:test --grep='@CONSENT-LIFECYCLE-001'
```

The second command uses the existing packaged offline workflow; `pnpm android:test:ui` also allows selecting OFFLINE760–762. Rebuild/reinstall the app through its documented workflow before physical-device acceptance; an existing APK does not update from these source edits. Inspect ordinary mobile control wrapping, date input, focus restoration, policy wording and the explicit WEB760 screenshot separately from API correctness. Use real owned UI choices to verify decline/revoke leaves essential account download/delete and query help accessible. Do not ingest a provider merely to force consent tests.

For failures report run ID/time, selected case/project/target from `artifacts/e2e/latest.md`, first failing assertion/error context and local bundle/package hash when applicable. Omit private downloads, session cookies, passwords and credentials. Parent DEV017 remains partial for its broader privacy/security/regulatory acceptance; this child is not legal certification. Local commit remains `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`; all34 files await user gates/commit, alongside preserved unrelated changes.

## Existing-flow integration follow-up

Static review also updates existing API150/121/330 and OFFLINE360 to assert the actual initial purpose behavior while retaining their original functional assertions. WEB050 scopes its session-status assertion separately from consent loading; WEB762/764 and WEB664 use the actual AccountGate sign-in label. These seven existing test files are additional integration edits beyond the34-file core manifest, not new case IDs or a test pass. Their targeted IDs should accompany the consent/material feature tags in the user's focused run.
