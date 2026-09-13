# EVIDENCE-LINKS-001 integration handoff

Authored in isolated `artifacts/task-worktrees/evidence-links-001`, branch `codex/evidence-links-001`, base `0a91aff`. Implementation is ready for parent review and parent-controlled format/check/integration tests. No deterministic commands, migrations, services, browser automation, dependency installation, commits or pushes were run by this agent. The latest local commit remains the base commit; this feature is uncommitted pending the mandatory gates.

## Outcome and layers

- Specification: `docs/product/research-connections.md` defines the user-owned personal connection, accepted sources, exact version bindings, immutable minimal receipt, privacy, lifecycle and acceptance.
- Contracts/workflow: strict request/query/response schemas; one exact owned holding (ISIN + holdings snapshot version) or goal (UUID + version); note 1–1000 trimmed characters, renewed consent, create/edit/reaffirm/remove and immutable historical editions. Shared deterministic domain code contains no financial calculations.
- Database/API: additive migration024; account → connection → source lock order with session revalidation after every account lock; published/non-draft source validation under source-row lock; foreign ownership rejection, expectedVersion conflict, account-scoped same-request replay, 200 active connection bound, immutable revisions/request receipts, account cascade and export. GET `/api/v1/account/research-connections?itemId=...`, GET `/history`, GET `/:id/history`, PUT `/:id` with discriminated action.
- UI/UX: Reader entry binds its exact shown edition; owned target selection, personal note, consent, review and saved state. Workspace under More/My money, links from Holdings/Goals, exact source receipts, current-source reader/original-site links, history including removals, editing, changed-input review/reaffirmation, explicit cancellation, conflict recovery, failed-request retry and loading/empty/unavailable states. Keyboard heading focus, native controls, draft navigation guard and 360px CSS are authored. Account sign-in safely returns to the encoded original connection route.
- Data/provenance: existing permitted stored Fed/ECB/PIB/World Bank only, hash required; no provider/private-data call. Minimal receipt includes item ID, edition, hash, source name/URL, effective label and publication/retrieval dates, and omits article title/summary/body. Withdrawal never exposes copied source text through connection state/history. Older published editions remain bound until explicit reaffirmation; unpublished drafts do not supersede publication.
- On-device: identical domain validations using actual dated bundled publications and local owned financial records; serialized durable storage; account isolation, request replay, export and deletion. Bundle-generation date visible. New published/withdrawn bundles recompute review without rewriting private history.
- Automation: not applicable; all operations are user-triggered. No background connection refresh, financial action, private synchronization or provider query.
- Tests: 12 API cases, 13 browser case definitions (desktop/mobile), and 10 offline cases authored, not run. Actual account/schema APIs and real copied dated Fed source underpin API/browser paths. Synthetic fault editions/outages are explicitly identified. No test setup side effects during discovery.

## Scoped integration manifest

New files:

- `packages/contracts/src/research-connections.ts`
- `apps/api/src/research-connections.ts`
- `infra/migrations/024_research_connections.sql`
- `apps/web/src/ResearchConnections.tsx`
- `apps/web/src/research-connections.css`
- `apps/web/src/offline/research-connections.ts`
- `tests/e2e/helpers/research-connection-fixture.ts`
- `tests/e2e/cases/api/research-connections.spec.ts`
- `tests/e2e/cases/browser/research-connections.spec.ts`
- `tests/e2e/cases/offline/research-connections.spec.ts`
- `docs/product/research-connections.md`
- `docs/development/research-connections-handoff.md`

Shared registrations to merge carefully alongside other agents:

- `packages/contracts/src/index.ts`: new export.
- `packages/contracts/src/privacy.ts`: required `researchConnections` history in private exports.
- `apps/api/src/app.ts`: controller registration.
- `apps/api/src/migrate.ts`: migration024 after integrated021–023; preserve root-integrated migration021/022 and other registrations.
- `apps/api/src/privacy.ts`: include owned connection revision export.
- `apps/web/src/offline/index.ts`: local handler registration.
- `apps/web/src/offline/accounts.ts`: export and account-deletion map; preserve root-integrated report tombstones, retention limits and their deletion fences.
- `apps/web/src/App.tsx`: route and More entry.
- `apps/web/src/navigation.ts`: My money section.
- `apps/web/src/AccountGate.tsx`: allowlisted connection return routes with encoded query data.
- `apps/web/src/Account.tsx`: plain-language return label avoids displaying the edition/hash route as account UI text.
- `apps/web/src/Discovery.tsx`: exact published source Reader entry.
- `apps/web/src/Holdings.tsx`, `apps/web/src/Goals.tsx`: workspace links.
- `apps/web/src/Privacy.tsx`: export description includes research connections.

Root-owned TODO/README/status/CATALOG/coverage plan/delivery matrix were intentionally untouched. There were no pre-existing uncommitted edits in this worktree at start. All current edits belong to EVIDENCE-LINKS-001; no other agent worktree was edited.

## Root tracker/catalog suggestions

TODO TEAM-003 child: implemented/authored; verification pending root execution. Preserve broader DEV-005/006/010/016/017 gaps: this feature adds explicit personal connections, not automatic exposure, sector mapping, causal inference, advice or quantified impacts. README should describe research connections and migration024, differentiate required rebuilt/reinstalled APK from already installed builds, and link specification. Status must contain actual gate/run IDs once known. Delivery matrix should list the concrete layers above and leave phone/visual acceptance separate.

| IDs        | Project         | Authored acceptance                                                                                                                                                                                                                        |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API260     | api             | Exact actual stored publication/owned holding, concurrent same-request replay, unchanged exact holdings/goals                                                                                                                              |
| API261     | api             | Foreign state/history/write and target ownership denial                                                                                                                                                                                    |
| API262     | api             | Strict unknown fields, note bounds, consent/origin, inert injection text                                                                                                                                                                   |
| API263     | api             | Stale source hash/target/connection versions and competing edits                                                                                                                                                                           |
| API264     | api             | Edit/remove history, replay, PostgreSQL immutable-update/delete rejection                                                                                                                                                                  |
| API265     | api             | Synthetic source withdrawal, review, source-text omission, no reaffirmation                                                                                                                                                                |
| API266     | api             | Synthetic draft/publication progression, note edit retains warning, explicit reaffirm                                                                                                                                                      |
| API267     | api             | Changed/removed goals, original target receipt, same-identity reaffirm constraint                                                                                                                                                          |
| API268     | api             | Holding replacement/removal, rejected rebind, unchanged financial records                                                                                                                                                                  |
| API269     | api             | Export and account cascade across heads/revisions/requests                                                                                                                                                                                 |
| API276     | api             | Actual recovery reset queued ahead of admitted fresh PUT/replay PUT/private GET; post-lock session recheck rejects each with401 and preserves exact original revision/request count                                                        |
| WEB260     | desktop/mobile  | Actual reader → goal → consent/review/save/reload and dated source receipt screenshot                                                                                                                                                      |
| WEB261     | desktop/mobile  | Edit/remove and private history                                                                                                                                                                                                            |
| WEB262     | desktop/mobile  | 360px keyboard focus, review Back, cancelled navigation and draft cancellation                                                                                                                                                             |
| WEB263     | desktop/mobile  | Explicitly simulated failed save, same-request retry                                                                                                                                                                                       |
| WEB264     | desktop/mobile  | Actual goal change/reaffirm, exact unchanged financial records                                                                                                                                                                             |
| WEB265     | desktop/mobile  | Synthetic withdrawal and minimal receipt UI                                                                                                                                                                                                |
| WEB266     | desktop/mobile  | Actual competing edit, stale draft and cancel/reload recovery                                                                                                                                                                              |
| WEB267     | desktop/mobile  | Empty records and Holdings/Goals navigation                                                                                                                                                                                                |
| WEB268     | desktop/mobile  | Explicitly simulated list outage/retry                                                                                                                                                                                                     |
| WEB269     | desktop/mobile  | Sign-in returns exact reader edition; injected personal HTML renders inert                                                                                                                                                                 |
| WEB276     | desktop/mobile  | Actual create/edit/remove receipts remain visible during explicitly simulated post-save GET503; history proves writes and retry restores context                                                                                           |
| WEB277     | desktop/mobile  | Actual committed PUT with simulated lost response, then synthetic source withdrawal plus actual goal change; same-request replay with GET503 preserves historical receipt as pending and authoritative retry restores both review warnings |
| OFFLINE300 | offline         | Actual bundled reader → goal workflow, dated notice, durable reload, zero network                                                                                                                                                          |
| OFFLINE301 | offline         | Holding edit/remove and persisted history                                                                                                                                                                                                  |
| OFFLINE302 | offline         | Local account/target/history isolation                                                                                                                                                                                                     |
| OFFLINE303 | offline         | Same-request replay and stale edit conflict after reload                                                                                                                                                                                   |
| OFFLINE304 | offline         | Actual local goal change and UI reaffirmation                                                                                                                                                                                              |
| OFFLINE305 | offline         | Replaced holdings/removed goals, unchanged financial state                                                                                                                                                                                 |
| OFFLINE306 | offline         | Bounds/consent/hash, inert HTML and no network                                                                                                                                                                                             |
| OFFLINE307 | offline         | Holdings/Goals → receipt → actual bundled reader                                                                                                                                                                                           |
| OFFLINE308 | offline         | Export/deletion, deleted UUID/request reuse, exact financial preservation                                                                                                                                                                  |
| OFFLINE309 | offline adapter | Explicit synthetic rebuilt-bundle/withdrawal simulation invoking actual local handler; original receipts preserved                                                                                                                         |

## Required gates and concrete remaining acceptance

No dependencies changed. Parent integrates authored files, merges shared registrations, and runs authorized `pnpm format` and `pnpm check` before any scoped local commit. Current compilation must be rebuilt before the isolated APIs start. Apply `pnpm db:migrate` against the intended existing app databases after successful build; migration024 is additive. PostgreSQL and MongoDB must be available, the local DB role needs CREATE SCHEMA for fixtures, and the usual web app/API must be running for connected browsing. Root `pnpm dev` prints the actual web/API URLs; typical web URL is `http://localhost:5173/#connections`.

User reproduction commands after integration, using the existing documented services:

```bash
pnpm format
pnpm check
pnpm db:migrate
pnpm dev
# Separate terminal; use the printed app and test URLs:
E2E_BROWSER=chrome pnpm e2e:ui
# Filter @EVIDENCE-LINKS-001; select api, desktop and mobile; click Run, watch off.
# Optional selected saved run:
E2E_BROWSER=chrome pnpm e2e:run --project=api --grep @EVIDENCE-LINKS-001
E2E_BROWSER=chrome pnpm e2e:run --project=desktop --project=mobile --grep @EVIDENCE-LINKS-001
# Repackage public bundle/UI and run the existing offline UI:
pnpm android:web
E2E_BROWSER=chrome pnpm android:test:ui
# Select E2E-OFFLINE-300–309 / @EVIDENCE-LINKS-001; click Run, watch off.
```

Expected: persisted personal connections use only selected owned records and exact dated editions; conflicting writes do not overwrite; withdrawal has no copied article text; reaffirm creates a new dated receipt; financial records remain byte-equivalent; exports include history and account deletion removes it; packaged tests make no outgoing API requests.

Remaining verification: every format/type/lint/build/test result is pending parent execution. OFFLINE309 intentionally isolates actual local-handler bundle lifecycle from bridge persistence;300–308 verify the packaged bridge. A physical Android package must be rebuilt/reinstalled to include this code; no existing APK was modified here. Parent should visually inspect the saved/review/error screens, then record separate physical-phone TalkBack, hardware/native Back, portrait/landscape/text-zoom and user-design acceptance. These manual outcomes are not implied by automated passes. Retest source withdrawal/source update while editing, cancellation and account switch manually if relevant failures arise.

For failures report `artifacts/e2e/latest.md`, exact run time/ID, selected project/case IDs, failing assertion, relevant screenshot/trace, and the fixture's annotated owned API/schema. Do not share private user notes or successful credentials. Keep watch mode off. Root owns the final gated local commit hash and any integration corrections; never push automatically.

Peer-review corrections authored before refreeze: all private connection routes revalidate their session after acquiring the account lock; API276 authors a deterministic isolated lock-wait regression against actual recovery reset, fresh writes, replay and private reads (recovery traces/video/screenshots off). A validated PUT receipt cannot establish current source or target state, because same-request replay returns an immutable historical revision; the UI marks context unavailable until an authoritative GET succeeds, preserves existing warnings, and withholds current-source links and reaffirmation. WEB277 covers actual receipt replay after an actual target change and explicitly simulated source withdrawal/GET503. Earlier corrections: the owned-target select uses a standalone htmlFor/id label, OFFLINE309 awaits the asynchronous finance handler, and the UI applies the validated successful PUT revision/removal immediately before optional GET refresh. Edit-note results retain prior review warnings. A failed refresh leaves saved receipts visible with a distinct refresh error, unavailable current-context notice and Retry; failed PUT still preserves its exact review/request for retry. WEB276 covers actual create/edit/remove plus simulated subsequent GET503. All corrections remain awaiting parent gates.

Final peer corrections: manual reload clears current-context readiness immediately while preserving saved receipts/history (WEB278 actual initial success then simulated503). Saving rechecks authentication after the publication row lock, not only the account row lock. API277 observes a real isolated source-row wait, then expires the owned session before releasing it and requires401/no insertion. Integrate AUTH-WAIT's AccountStore clock_timestamp expiry change before this gate. No execution by reviewing agent.

Parent integration: explicit textarea label/ID preserves field discovery after edit/Back; technical receipt IDs/hashes use a native keyboard disclosure. API277 reuses its held single-pool client for expiry/count queries instead of waiting on itself. Actual passing runs, final gates and APK boundary are in status.md.
