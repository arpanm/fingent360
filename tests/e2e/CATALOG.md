# End-to-end case catalogue

## BEA-001 — official release metadata

| Cases          | Projects       | Acceptance                                                                                                                                                           |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API320–324     | api            | Ordinary live RSS and actual raw/hash/draft/publication; captured replay dedup; independent failure; withdrawal/redaction/republication; corrected editions          |
| API325–328     | api            | Owned connection/replay/privacy and unchanged finances; actual report/inbox compatibility; ops/Origin/input denial; source-lock withdrawal/evidence race             |
| WEB320–324     | desktop/mobile | Real source filter/Scan/Stories/reader/history/evidence/Back, Operations publication/withdrawal, empty/fault retry, owned connection workflow and withdrawn controls |
| OFFLINE350–353 | offline        | Genuine dated BEA bundle and zeroAPI reading; durable connection/report/inbox/export/deletion; explicit synthetic withdrawn and pre-BEA bundle behavior              |

Tag @BEA-001:19connected and4offline executions. Only API320 is @external; simulations are explicitly labelled and successful application responses remain actual. Four parser unit cases retain captured provenance. Status records execution; native hardware acceptance is separate.

## CONNECTION-REVIEWS-001 — private review inbox

| Cases          | Projects       | Acceptance                                                                                                                                                                                             |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API310–311     | api            | Actual owned evaluation/coalescing/ack/reopen/resolution, exact unchanged finances, privacy and concurrent replay                                                                                      |
| API312–314     | api            | 600-head turnover preserving1000immutable revisions; actual source-wait expiry401/zero writes;1000-operation capacity, dated expiry, replay and cross-action conflict                                  |
| WEB310         | desktop/mobile | Manual check, dated notices/filter/ack/reload, actual owned receipt, failed current refresh, keyboard/mobile                                                                                           |
| WEB311–313     | desktop/mobile | Actual committed check/ack response loss and historical-only replay during GET outage/TTL reuse; actual receipt401 versus held old successful inbox; Close pending receipt fences late reopening/focus |
| OFFLINE340–343 | offline        | Real dated bundle/local owned notices, reload/export/delete/noAPI; actual600-head turnover; historical replay after later changes;1000-operation capacity/expiry with actual local handlers            |

Tag @CONNECTION-REVIEWS-001:13connected and4offline executions. Synthetic publication, faults and dated receipt states are explicit. Selected execution evidence is in status; physical-phone/screen-reader acceptance remains separate.

## REPORTS-003 — optional report research receipts

| Cases          | Projects       | Acceptance                                                                                                                                                                                                                       |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API290–294     | api            | Exact v1/v2 reconstruction; canonical replay/conflicting selection; foreign/stale/removed selection; bounds/consent/Origin; capture-time changed/withdrawn source and changed/removed goal warnings                              |
| API295–299     | api            | Actual source-lock withdrawal/expiry; worker fault/retry from stored snapshot; cancel/delete/actual late finish; capacity/hourly bounds; private export/account cascade                                                          |
| WEB290–294     | desktop/mobile | Real opt-in review/issued receipt/JSON; plain v1; selection outage/retry;360px keyboard/Escape/Back; actual lost committed response with exact retry                                                                             |
| WEB295–299,301 | desktop/mobile | Competing edit conflict/discard/review; changed/withdrawn context navigation; actual escaped print window; individual deletion; guest return; immediate actual401 cleanup despite delayed polling                                |
| OFFLINE330–339 | offline        | Real dated bundle/v2/HTML/no network; exact v1/v2/replay; account isolation; bounds/inert text; changed goals; cancel/delete/tombstone; export/cascade; actual100-request limits; synthetic bundle withdrawal via actual handler |

Tag @REPORTS-003. Thirty-one definitions produce32 connected and10offline selections. Source changes, permission/capacity/worker faults are labelled simulations; successful persistence and outputs use the actual application. Browser print invocation is intercepted for assertions, so physical printing/Android user acceptance is separate. Status records executed evidence.

## GOAL-SCENARIOS-001 — contribution plan comparisons

| Cases      | Projects       | Acceptance                                                                                                                                                                                                                  |
| ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API280     | api            | Exact extreme paise/1200months; immutable baseline; create/replay; foreign denial; simultaneous adoption once; unrelated goal retained; allocation review; export/cascade                                                   |
| API281–282 | api            | Different payload sameID, stale/deleted goal conflicts; actual owned account lock revocation rejects401 before comparison write                                                                                             |
| WEB280–281 | desktop/mobile | Real comparison/adoption; failed post-adoption GET retains historical receipt without current claim; guest return; keyboard/mobile/Back and draft cancellation                                                              |
| WEB282–283 | desktop/mobile | Initial503/unreadable JSON keyboard Retry; actual committed save with lost acknowledgement, changed goal, identical replay and failed refresh; adoption remains disabled until valid current context and unchanged baseline |
| OFFLINE320 | offline        | Shared exact local comparison/save/adopt/reload/export/delete with no API requests                                                                                                                                          |

Tag @GOAL-SCENARIOS-001;11connected selections plus1offline case. Unit tests cover exact arithmetic and rejection of unsupported growth inputs/extra alternatives. Execution is recorded independently in status; physical phone acceptance is not implied.

## EVIDENCE-LINKS-001 — personal research connections

| Cases          | Projects       | Acceptance                                                                                                                                                                                                                                        |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API260–269     | api            | Exact published/owned binding; same-request replay; foreign denial; strict input/consent; stale/concurrent writes; immutable edit/remove history; source withdrawal/update/reaffirm; removed/changed goal/holding; private export/account cascade |
| API276–277     | api            | Actual recovery ahead of account wait; actual source-row wait with session expiry;401 leaves receipts unchanged                                                                                                                                   |
| WEB260–269     | desktop/mobile | Reader→choose→review→save/reload; edit/remove/history; keyboard360px/Back/draft cancellation; failed save retry; target/source review; competing edits; empty navigation; list retry; sign-in return and inert text                               |
| WEB276–278     | desktop/mobile | Actual writes with simulated failed refresh; lost acknowledgement and historical replay after real target change/synthetic withdrawal; manual reload invalidates current context, preserves receipts and recovers                                 |
| OFFLINE300–309 | offline        | Dated real bundled reader; local goal/holding persistence/history/ownership; replay/conflict; changed/removed targets; consent/bounds; navigation; export/deletion; explicit synthetic bundle update/withdrawal via actual handler                |

Tag @EVIDENCE-LINKS-001. Twelve API and thirteen browser definitions produce38 connected selections; ten offline cases are separate. Tests create owned isolated records and never infer a pass from authorship. OFFLINE309 intentionally exercises the actual bundle-lifecycle handler;300–308 cover packaged persistence. Execution and physical-device acceptance are recorded separately in status.

## AUTH-WAIT-001 — revoked/expired database waiters

| Case        | Acceptance                                                                                                                                   | Project         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| E2E-API-300 | CSV/XLSX preview authorization after reset; reject401 without private mutation, then positive new-session control                            | api             |
| E2E-API-301 | Fresh confirmation and confirmed receipt replay; reject401 without private mutation, then positive new-session control                       | api             |
| E2E-API-302 | Goal creation after reset; reject401 without private mutation, then positive new-session control                                             | api             |
| E2E-API-303 | Goal edit/delete after reset; reject401 without private mutation, then positive new-session control                                          | api             |
| E2E-API-304 | Allocation private context and revision writes; reject401 without private mutation, then positive new-session control                        | api             |
| E2E-API-305 | New report and issued request replay; reject401 without private mutation, then positive new-session control                                  | api             |
| E2E-API-306 | Report deletion and tombstone replay; reject401 without private mutation, then positive new-session control                                  | api             |
| E2E-API-307 | Report cancellation with ordered account/job blockers; reject401 without private mutation, then positive new-session control                 | api             |
| E2E-API-308 | Report retry with ordered account/job blockers; reject401 without private mutation, then positive new-session control                        | api             |
| E2E-API-309 | Real session expiry after transaction start and before lock admission; reject401 without private mutation, then positive new-session control | api             |
| E2E-WEB-300 | Actual recovery, revoked allocation save, sign-in and successful save with retained history                                                  | desktop, mobile |

Tag @AUTH-WAIT-001. Per-test schemas and actual HTTP requests establish the race using observed locks; trace/video/screenshots are disabled around credentials. No application sessions or data are reset. On-device serialized handlers are outside the PostgreSQL waiter defect; existing offline recovery tests remain. Status records execution separately.

## RETENTION-001 — bounded operator cleanup

| Case           | Acceptance                                                                                 | Projects        |
| -------------- | ------------------------------------------------------------------------------------------ | --------------- |
| E2E-API250     | Fixed-category expiry cleanup, fresh/financial/evidence preservation and count-only result | api             |
| E2E-API251     | Authorization, Origin, malformed bounds and no side effects                                | api             |
| E2E-API252     | Two operators, concurrent replay and immutable completed results                           | api             |
| E2E-API253     | Actual SQL failure rolls back all categories; retry completes                              | api             |
| E2E-API254     | Confirmed receipts survive ordinary preview expiry/capacity handling                       | api             |
| E2E-API255     | Owned connection interruption rolls back before same-preview retry                         | api             |
| E2E-API256     | Scrubbed feedback keeps receipt/deletion protections without resurrection                  | api             |
| E2E-API257     | All category caps and truthful remaining counts                                            | api             |
| E2E-WEB250     | Loading, preview, Cancel/Escape/keyboard confirm, result focus/history/reload/mobile       | desktop, mobile |
| E2E-WEB251     | Failed history read retries into real empty state                                          | desktop, mobile |
| E2E-WEB252     | Lost real preview/execution responses retry without duplicate cleanup                      | desktop, mobile |
| E2E-WEB253     | Actual failed transaction displays rollback and keyboard retry                             | desktop, mobile |
| E2E-WEB254     | Expired operator session returns to sign-in and saved preview                              | desktop, mobile |
| E2E-OFFLINE280 | Connected requirement, keyboard settings/reading navigation, no API traffic                | offline         |
| E2E-OFFLINE281 | Confirmed local receipt/draft capacity preserved across expiry/reload                      | offline         |

Tag @RETENTION-001. Selected fixtures own actual isolated APIs/schemas; no production quota or expiry policy is changed. Count records contain no private content. Execution evidence is in status.

## XLSX-001 — exact standard workbook import

| Case            | Contract                                                                                                                                                                     | Projects        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| E2E-API-240     | Blank template, exact workbook preview/confirmation/replay, ownership, stale version and pending/confirmed privacy metadata without raw bytes                                | api             |
| E2E-API-241     | Formulas, qualified active XML, external links, DTD, numeric precision, inherited date/scientific styles and reconciliation failures preserve saved holdings                 | api             |
| E2E-API-242     | Legacy array and new CSV preview receipts export before/after confirmation                                                                                                   | api             |
| E2E-WEB-240     | Keyboard downloads validate actual blank/sample bytes; invalid upload preserves draft; real independent-library workbook review/consent/save/reload preserves exact holdings | desktop, mobile |
| E2E-OFFLINE-290 | Same workbook UI/worker and local save/reload/privacy/account deletion without API traffic                                                                                   | offline         |

Tag @XLSX-001. Cases use synthetic user inputs with the actual API/database or packaged local transport. Existing PORTFOLIO/PRIVACY cases remain regression coverage. Unit tests cover ZIP/CRC/expansion, lexical precision, format rejection and actual worker timeout/termination/capacity. Execution evidence is recorded separately in status.

## REPORTS-002 — individual record-report deletion

| Case            | Contract                                                                                                                                                                                        | Projects        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| E2E-API-224     | Owned terminal deletion removes stored snapshot/output, preserves financial records, reclaims capacity and blocks original request replay; foreign/stale/Origin checks and metadata-only export | api             |
| E2E-API-225     | Cancel then concurrent delete fences an actual late worker finish                                                                                                                               | api             |
| E2E-API-226     | Full capacity and new-request budget recovery preserve replay/deletion availability                                                                                                             | api             |
| E2E-WEB-223     | Confirmation/cancel/Escape/focus, permanent deletion, visible reclaimed capacity and reload                                                                                                     | desktop, mobile |
| E2E-WEB-224     | Real deletion from another session and controlled late list response cannot restore the reader/card                                                                                             | desktop, mobile |
| E2E-WEB-225     | A usable real earlier response is rendered while a newer simulated slow read remains pending                                                                                                    | desktop, mobile |
| E2E-OFFLINE-263 | Device deletion, replay/privacy/ownership/capacity and persisted result without API traffic                                                                                                     | offline         |
| E2E-OFFLINE-264 | Device deletion and explicitly simulated late response preserve absence across reload                                                                                                           | offline         |

Tag `@REPORTS-002`; connected cases use the existing isolated actual application fixture. Only controlled concurrency transport is simulated. Authored cases do not imply passes; exact execution evidence is in [status](../../docs/development/status.md).

## FEEDBACK-TEST-001 — repeatable isolated feedback integration

API190–195 and WEB190–195 now use a fresh temporary schema and actual loopback API per selected test. Existing UI/media/ownership/review/deletion assertions remain; API193's expiry setup uses only the owned schema. Production rate limits and app data are unchanged. Discovery has no fixture side effects. Tests still require the running web app/local databases and compiled API; see [runner setup and lifecycle](README.md#repeatable-feedback-tests).

**E2E-API-194** (@FEEDBACK-001 @FEEDBACK-TEST-001, api):20 actual reports succeed,21st returns429 without a row or committed quota increment, identical receipt retry still succeeds, owned deletion works, and an absent-ID cancellation is rejected without creating a tombstone. Repeat the feedback tag twice: each case's schema/API remains independent and teardown removes only owned resources. Final verification is recorded in [status](../../docs/development/status.md), not inferred from fixture creation.

**E2E-API-195** (@FEEDBACK-001 @FEEDBACK-TEST-001, api): disconnect a separately owned fixture at its schema-created notification during startup. It must exit successfully, remove that exact schema, and preserve the current case's independent schema. No process or schema outside those test resources is stopped/removed.

## UI-RACES-001 — settings readiness and step focus

WEB060/194 retain their original save/edit and actual receipt/retry assertions. WEB194 explicitly awaits loaded controls before changing delivery. New cases run in desktop/mobile with `@UI-RACES-001`:

| ID          | Acceptance                                                                                                            | Data and fault scope                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| E2E-WEB-067 | Late animation callbacks cannot redirect horizon input into monthly contribution; review/save preserves exact amounts | Controlled frames; owned real account/goal/API                |
| E2E-WEB-095 | Late animation callbacks cannot redirect purchase cost into quantity; review/confirm persists exact row               | Controlled frames; owned real account/holdings/API            |
| E2E-WEB-196 | Delivery form appears only after saved settings load; pause survives reload with its origin intact                    | Held real IndexedDB-open notification; real local persistence |
| E2E-WEB-197 | Storage-open failure exposes Retry and no placeholder settings; retry then pause/reload works                         | One simulated open error; recovery uses real IndexedDB        |

The timing fixtures reproduce application bugs; they do not fabricate successful API responses or bypass validation. WEB067/095 delete only their owned synthetic accounts. Existing offline cases exercise the rebuilt shared UI without a server. Exact execution evidence is in [status](../../docs/development/status.md).

**UX-002 implemented coverage:** The cases below exercise the new persisted discovery, library, money, assistance, learning and media flows. See [CTA inventory](../../docs/development/ux2-cta-inventory.md) for actual UI/API paths. The broader [acceptance plan](plans/mobile-experience-acceptance.md) still includes physical-device, user-research and release gates that automated cases cannot establish.

| Cases                             | Projects       | Implemented acceptance                                                                                                                       |
| --------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| API120 / API123                   | API            | Fixed real feed → draft/review/publication/withdrawal/evidence; protected operations sessions and failed-login limiter                       |
| API121 / API122                   | API            | Library ownership, idempotent saves/reminders, stable feed cursors/search, ranked reasons/reset, worker delivery and withdrawal cancellation |
| API140 / API141                   | API            | Versioned sourced quiz/poll, real attempts/votes/aggregates, validation and owned prior-entry suggestions                                    |
| API150                            | API            | Authenticated query fallback, explicit history scope and isolation; provider adapters use separate synthetic unit fixtures                   |
| API160                            | API            | Idempotent source-edition SVG/caption generation, review and source-withdrawal propagation                                                   |
| WEB020 / WEB070                   | desktop/mobile | Separate operations refresh/source editing, investor provenance readers, row expansion/focus/Back restoration                                |
| WEB064 / WEB094 / WEB065 / WEB113 | desktop/mobile | Guided money forms, explicit prior-input Apply, Back steps and dirty-route/native-Back protection                                            |
| WEB120 / WEB121                   | desktop/mobile | Saved search/status, preferences, schedule/edit/cancel/snooze and live in-app reminders preserving drafts                                    |
| WEB130 / WEB131 / WEB132          | desktop/mobile | Real scan/story reader, filtered Back, save/reaction Undo, persisted reminder and view state                                                 |
| WEB133 / WEB134 / WEB135          | desktop/mobile | Originating tab/More/root navigation, innermost Back, deliberate/cancelled gestures,320–430px/landscape/large text and public screenshots    |
| WEB136                            | desktop/mobile | Related primary-source term preview, keyboard/Escape and full contextual reader                                                              |
| WEB140 / WEB150 / WEB160          | desktop/mobile | Sourced learning, query assistance explicitly applied, reviewed visual/caption controls and actual WebM download                             |

The full integration run2026-09-13T04-24-09-866Z-83652 passed110 with one intentional API004 outage skip. Case definitions describe coverage; current execution evidence is recorded at the top of TODO and in artifacts/e2e/latest.md. Historical notes below apply to their original change only. Task status and manual verification live in [TODO.md](../../TODO.md). Stable IDs appear in the UI, errors and reports. Browser cases run separately under desktop and mobile projects.

| ID          | Task                         | Project / scenario   | Prerequisites                                                    | Expected outcome                                      | Kind                                   |
| ----------- | ---------------------------- | -------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| E2E-API-001 | SETUP-001, SDLC-001          | API liveness         | Local API started                                                | HTTP 200, strict shared schema, recent timestamp      | Real API                               |
| E2E-API-002 | SETUP-001, SDLC-001          | Database readiness   | API and both dedicated databases up                              | HTTP 200; PostgreSQL and MongoDB up                   | Real integration                       |
| E2E-API-003 | SETUP-001, SDLC-001, BUG-002 | Unknown route        | API started                                                      | HTTP 404, application/json and JSON statusCode/error  | Real API                               |
| E2E-API-004 | SETUP-001, SDLC-001          | Deliberate DB outage | User stops one dedicated container; opts in with E2E_EXPECT_DOWN | Ready 503 and selected DB down; live 200              | Manual preparation; skipped by default |
| E2E-WEB-001 | SETUP-001, SDLC-001          | Home → actual API    | Web/API up                                                       | API connected; honest scope; three planned areas      | Real integration                       |
| E2E-WEB-002 | SETUP-001, SDLC-001          | Unavailable API      | Web up                                                           | API unavailable shown after 503                       | Simulated network failure              |
| E2E-WEB-003 | SETUP-001, SDLC-001          | Invalid API contract | Web up                                                           | Invalid timestamp cannot display API connected        | Simulated invalid payload              |
| E2E-WEB-004 | SETUP-001, SDLC-001          | Responsive/keyboard  | Web up                                                           | No horizontal overflow; home link keyboard accessible | Real browser                           |

## UX-001 connected experience

Current results are recorded in TODO and the saved run reports. Cases use real owned database records; temporary account inputs are explicitly synthetic test data, never fallback product data. Existing regression cases still apply.

| ID                | Projects       | Expected behavior                                                                                                                           |
| ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E-API-110       | api            | Anonymous denial, exact large costs, consistent owned overview, session persistence, isolation, goal removal and inbox preference agreement |
| E2E-WEB-033       | desktop/mobile | Sign-in returns to an allowlisted private page; external redirect parameters are ignored                                                    |
| E2E-WEB-110       | desktop/mobile | Overview → registration → saved goal → manual holding → persisted overview totals and setup progress                                        |
| E2E-WEB-111       | desktop/mobile | Persistent bottom/rail navigation, skip link, route focus, no overflow and unknown-route recovery                                           |
| E2E-WEB-112       | desktop/mobile | Simulated overview storage outage offers retry without inventing an empty account; recovery uses the real API                               |
| E2E-WEB-062 / 092 | desktop/mobile | Goals/holdings distinguish401 sign-in from503 outage and preserve drafts when discard is cancelled                                          |
| E2E-WEB-063 / 093 | desktop/mobile | A held initial real API response cannot overwrite a newly saved goal or an entered holdings draft                                           |

WEB060/090 cover guided goal editing and manual holdings/CSV review/confirmation. WEB020 covers actual provider refresh, chart/provenance, and secondary operator controls. [UX-DOC-001–005](../../docs/product/experience.md) define visual and cross-layer review criteria. No new dependencies or migration are required: `/account/overview` reads existing records in one authenticated repeatable-read transaction. Full run `2026-09-12T17-03-42-614Z-70343` passed 68 executions, zero failed, with E2E-API-004 intentionally skipped; all cases above passed under their listed projects.

## Runner acceptance — user performs these once

1. Run `pnpm e2e:ui`; confirm listing alone makes no test requests or starts the app/databases.
2. Select the `api` project and E2E-API-001; click its play button. Confirm only that case executes and shows status, step and duration.
3. Click Run all with both databases, API and web running. Confirm API plus desktop/mobile results; E2E-API-004 is explicitly skipped unless opted in.
4. To inspect a failure, close the runner and launch with `E2E_API_URL=http://127.0.0.1:4199 pnpm e2e:ui` (an unused local port). Run E2E-API-001. Confirm connection failure, affected step and source line are shown. Relaunch normally afterward.
5. Run `pnpm e2e:run --project=api --grep E2E-API-001`; open `pnpm e2e:report`. Confirm the saved HTML result and machine-readable results.json exist under that run's artifact directory.
6. Reopen the UI; keep watch/eye icons OFF. Edit a test definition and confirm it is not executed until the user clicks Run.

## Planned feature coverage

[plans/product-coverage.md](plans/product-coverage.md) maps each future task to required acceptance scenarios. Planned scenarios are not runnable passing placeholders. When implementing a task, create concrete `.spec.ts` cases, replace its planned entries with executable IDs and link both directions to TODO.

## BUG-001 historical regression acceptance — superseded by DEV-PORTS-001

- With an existing dev session using 5173/4100, invoke a second `pnpm dev`: expect a named occupied-port error before build output, and the original app remains running.
- Stop only the original dev session via Ctrl-C, then invoke `pnpm dev`: expect normal startup on the documented ports. Never terminate an unrelated listener.
- Cancel a stalled browser installer. With Google Chrome installed, launch `E2E_BROWSER=chrome pnpm e2e:ui`; select desktop and E2E-WEB-001–004, then click Run. Expect execution without managed Chromium/FFmpeg installation. Repeat with mobile. Screenshot/trace evidence remains available; video is intentionally disabled.
- If managed Chromium is installed, launch without E2E_BROWSER and confirm those same cases still select managed Chromium.
- These definitions were not executed by Codex. Report run IDs and failures before recording a pass.

BUG-002: user reported E2E-API-003 returning HTML after a successful 404 assertion. Corrected prefix mounting and added explicit format assertions; rerun pending, not marked passed.

## DEV-001 document acceptance

[DOC-001–DOC-015](plans/dev-001-acceptance.md) are authored manual review cases for screen flows, data semantics and failure states. Review pending; no runnable placeholders or passing results added. Services are not required. Convert scenarios to executable cases as their features are delivered.

Latest user report: formatting/checks and all tests passed before DEV-001; no run IDs or individual case details supplied. Earlier failure notes above remain historical; this report does not establish separate outage/runner acceptance.

## SLICE-001 executable journey cases

Prerequisites: current build, manual `pnpm db:migrate`, PostgreSQL/MongoDB and API/web running. Filter `@SLICE-001`. All cases are implemented; execution is pending the user's Run action, not blocked on more case authoring.

| ID          | Project        | Expected behavior                                                                                     |
| ----------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| E2E-API-010 | api            | Synthetic catalog has explicit scenario/source provenance                                             |
| E2E-API-011 | api            | Persist/reload exact values; replay stable; competing writes reject; old reviews preserve input       |
| E2E-API-012 | api            | Invalid CSV/mismatch cannot mutate; valid preview confirms once                                       |
| E2E-API-013 | api            | Unauthorized/cross-workspace access rejects; invalid financial inputs reject; deletion revokes access |
| E2E-WEB-010 | desktop/mobile | Event/company → CSV → repeat-type goals → review/stale → persisted reload; no overflow                |
| E2E-WEB-011 | desktop/mobile | Mismatch blocks confirmation; over-allocation displays correction                                     |
| E2E-WEB-012 | desktop/mobile | Simulated failed save preserves edits, then real save succeeds                                        |

Tests create/delete isolated virtual workspaces. No user workspace is reused. See [manual walkthrough](../../docs/development/working-journey.md). Foundation browser assertions now describe the working synthetic landing page.

## BUG-003 — shared workspace setup failure

User reported E2E-API-011–013 returning 503 during session creation. Those scenarios remain user-reported failed. The common assertion now includes the failed response text (never the successful access key). Unit regressions cover cause classification, redaction and rollback. User must apply the migration successfully and rerun these API cases; cause and recovery are not yet verified.

## DATA-001 real-source cases

Prerequisites: research:setup, rebuilt/restarted API, db:migrate, both databases, web and external World Bank access. Run @DATA-001 manually. No mock provider in these cases; no hardcoded current values. Traces/video/screenshots disabled to avoid recording the operator key. Cases keep accepted real macro data for subsequent UI use.

| ID          | Projects       | Expected result                                                                                                     |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| E2E-API-020 | api            | Real refresh persists observations and hash-verifiable Mongo evidence; history/repeated refresh retain revision IDs |
| E2E-API-021 | api            | Missing/wrong operator key rejects; arbitrary source/URL fields reject; unknown evidence is 404                     |
| E2E-WEB-020 | desktop/mobile | Operator refreshes real GDP; investor views contextual history/source and returns to original row without overflow  |

The source parser's unit cases exercise exact decimals, null, identity, unit, pagination and schema failures using explicitly synthetic wire fixtures only. No fixtures are served in the application.

## ACCOUNT-001 account and watchlist cases

Prerequisites: updated app, PostgreSQL, additive migration; account tests do not require an external fetch. Filter @ACCOUNT-001. Temporary accounts are removed on completion. Credential-bearing traces/video/screenshots are disabled.

| ID          | Projects       | Expected result                                                                                                          |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| E2E-API-030 | api            | Register/save/reload; other account isolated; logout denies private access; login restores list; deletion revokes access |
| E2E-API-031 | api            | Missing/foreign Origin and absent consent reject; HttpOnly cookie; wrong password and duplicate inputs reject            |
| E2E-WEB-030 | desktop/mobile | User registers, selects real indicator, saves/reloads/signs in again, then deletes account; no overflow                  |

Password hashing, cookie parsing, Origin enforcement and bounded rate-limit unit regressions are in apps/api/test/account-security.test.mjs. Execution pending user Run.

## ALERT-001 personal inbox

Run @ALERT-001 manually after latest migration, research:setup and API restart. Provider access required; cases use real GDP observations and temporary accounts. Credentials are excluded from traces/video/screenshots.

- E2E-API-040: source ingestion → followed observation → acknowledgment → reload, independent account read state, foreign Origin/non-followed observation rejected.
- E2E-WEB-040 (desktop/mobile): register → follow GDP → acknowledge actual source observation → reload retains acknowledgment.

Cases are authored, not executed. Read receipts bind to immutable observation IDs; no external message is sent.

## BUG-004 discovery regression — manual acceptance

Open the E2E UI with empty search/status filters and all projects selected. Foundation, journey, macro, account and inbox cases must be listed without collection errors. Capture-disabled specs retain file-scope test.use configuration; no test runs on open. Then manually run the desired cases. If discovery still fails, share the terminal or UI Errors message. No execution claimed.

## BUG-005 compilation regression

The missing AccountStore method brace is corrected. Existing pnpm check compilation catches this regression before runtime; no brace-counting test added. After successful checks/build and migration, manually run E2E-API-030/031/040 and E2E-WEB-030/040. These exercise account deletion and observation acknowledgment on the rebuilt API. No execution claimed.

## DEV-PORTS-001 dynamic-port acceptance

TEAM-001 additions: API/WEB-050 privacy export and sessions; API-060/061 and WEB-060 saved goals; API/WEB-070 source registry; API/WEB-080 inbox preferences; API-090/091 and WEB-090 holdings/CSV. See the feature docs and test names for prerequisites and coverage. These use real database/API paths; registry acceptance records are explicitly synthetic and unpublished after testing.

BUG-006: E2E-WEB-020 now asserts viewport containment while the provenance table is expanded, followed by normal History/Source clicks. Verified desktop/mobile in full run 2026-09-12T15-42-10-408Z-58293 (32 passed, E2E-API-004 intentionally skipped).

SDLC-003: manual format/check/commit/E2E workflow acceptance is recorded in plans/product-coverage.md; isolated orchestration regression cases are in tests/unit/sdlc.test.mjs. Existing API/browser cases are run by the wrapper without modification. Verification pending.

SDLC-002: [manual report and handoff acceptance](plans/sdlc-002-acceptance.md) covers SDLC-UI-001–005 and SDLC-DOC-001. Reporter regression definitions live in tests/unit/handoff.test.mjs. Execution pending.

Restart regression: after stopping pre-fix dev watchers, launch two dev sessions sequentially and record both printed API/web pairs. Make a harmless source edit to trigger API recompilation/restart. Both sessions must retain their own ports without EADDRINUSE. Launch the test UI for the latest session and manually run E2E-API-001/002/030 and E2E-WEB-001/030; also open the first session's printed web URL and confirm it remains usable. This manual scenario specifically covers watcher configuration lifetime; verification pending.

Lint follow-up: manually rerun `pnpm format` and `pnpm check` before the scenarios below. The two reported `no-unused-expressions` violations were replaced with equivalent conditionals; existing ESLint coverage checks this correction. No runtime behavior change or additional E2E case is needed. Verification pending.

Start a second root pnpm dev while the previous session runs. Open the newly printed web URL and a newly launched E2E UI; its target URLs must match. Run E2E-API-001/002/030 and E2E-WEB-001/030 to verify connectivity and account Origin handling. A second E2E UI/report listener must choose another free port without stopping the first. For database-port conflicts, use a disposable local setup and confirm selected Compose bindings match .env connection URLs and retained data; never remove volumes. Automated unit definitions cover allocator/env mapping and run under pnpm check. All execution remains manual.

TEAM-001 verified integration: `2026-09-12T16-09-40-894Z-64656` — 51 passed, zero failed, E2E-API-004 intentionally skipped. Includes new API/WEB050, API060/061+WEB060, API/WEB070, API/WEB080, API090/091+WEB090 and WEB100 desktop/mobile.

### Goal write acknowledgment follow-up

| Case        | Behavior                                                  | Projects        | Tags               | Evidence boundary                                                                                                                                                                      |
| ----------- | --------------------------------------------------------- | --------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E-WEB-066 | Goal save acknowledgment survives subsequent read failure | desktop, mobile | @GOALS-001 @UX-002 | Real goal POST, simulated later browser GET 503, closed create wizard, preserved confirmed card and exactly one persisted goal. Authored; current-run verification tracked separately. |

## ANDROID-001 — native and offline app

Run `pnpm android:web` then `E2E_BROWSER=chrome pnpm android:test` or `pnpm android:test:ui` (manual selection, watch off). The dedicated offline project has no API/database and uses the exact built assets packaged in the APK. Normal projects exclude these cases unless the offline runner supplies its isolated asset URL.

| Case            | Coverage                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| E2E-OFFLINE-010 | Exact persisted goals, holdings preview/confirm/history, export, reload/login                                  |
| E2E-OFFLINE-011 | Local account ownership and deletion isolation                                                                 |
| E2E-OFFLINE-012 | Session expiry on all private domains and durable login throttle/recovery                                      |
| E2E-OFFLINE-201 | Dated reading, save/position/preferences, reminder idempotency/catch-up, learning/query fallback               |
| E2E-OFFLINE-202 | Strict search/cursor filters and truthful unavailable refresh                                                  |
| E2E-OFFLINE-203 | Shared learning-lab math/parser, workspace persistence/isolation, revisions/import conflicts/immutable reviews |
| E2E-OFFLINE-204 | Actual mobile reader/save/feedback/preferences/navigation/settings flow, no network API requests               |
| E2E-API-006     | Credentialed CORS permits only the configured web origin for later CDN deployment                              |

Native install/airplane mode, file pickers, system Back, update persistence, connection recovery and accessibility follow [Android acceptance](plans/android-acceptance.md). Runtime evidence and limitations are in [status](../../docs/development/status.md); authored cases alone are not a pass.

## SOURCES-002 — free sources and connected reading

| Case            | Coverage                                                                                                    | Projects        |
| --------------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| E2E-API-180     | Actual source catalogue, India filtering, Today bound, source-version context and invalid filters           | api             |
| E2E-API-181     | Protected selected refresh, blocked/unknown/duplicate rejection, durable glossary outcomes                  | api             |
| E2E-API-182     | Signed-in source/topic/region corpus parity and cross-filter cursor rejection                               | api             |
| E2E-WEB-170     | Source-backed quiz, saved answer, learning lab and overview reading links                                   | desktop, mobile |
| E2E-WEB-180     | Filters, Scan/Stories arrows, reader/context/Back, empty/reset, source-directory links                      | desktop, mobile |
| E2E-WEB-181     | Operations source selection, real glossary refresh and independent outcomes                                 | desktop, mobile |
| E2E-WEB-182     | PIB source Stories → reader → actual evidence hash/history → linked learning → Back with selection retained | desktop, mobile |
| E2E-OFFLINE-220 | Source → filtered Stories → reader/context → Back/reload without API requests                               | offline         |
| E2E-OFFLINE-221 | Shared source-backed quiz rubrics, exact retry and durable progress                                         | offline         |
| E2E-OFFLINE-222 | Snapshot source/topic filtering, annual edition dates and related context preserved after reload            | offline         |

Use `pnpm e2e:ui`, select @SOURCES-002 and existing discovery/library/media/navigation regressions. Offline uses `pnpm android:test:ui` after building assets. Watch/eye mode remains off. Apply migration015 and refresh/review actual sources first; no source fixtures masquerade as live data. Parser/unit fixtures preserve capture provenance and exercise schema/country/unit/date/URL failures, exact decimals and content-bound cursors. Exact executed evidence lives in status, separately from this catalogue.

## FEEDBACK-001 — screenshot, voice and durable delivery

| Case            | Coverage                                                                                                                      | Projects        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------- |
| E2E-API-190     | Explicit consent payload, private capability, duplicate retries, conflict, cancellation-before-POST and deletion tombstones   | api             |
| E2E-API-191     | Real PNG above default parser limit, dimensions/magic rejection, exact native-origin CORS and unrelated-origin isolation      | api             |
| E2E-API-192     | Protected inbox/detail, private attachments, versioned operator status, stale conflict and deletion                           | api             |
| E2E-API-193     | Only owned synthetic report expired; content/bytes scrubbed and resurrection rejected                                         | api             |
| E2E-WEB-190     | Actual viewport screenshot, crop/privacy cover, consent, server receipt and durable deletion                                  | desktop, mobile |
| E2E-WEB-191     | Launcher choices, Escape/Back, crop retake and deliberate draft discard                                                       | desktop, mobile |
| E2E-WEB-192     | Synthetic audio device with real MediaRecorder/playback/upload/receipt; explicitly simulated microphone input                 | desktop, mobile |
| E2E-WEB-193     | Simulated microphone denial preserves typed feedback and does not submit                                                      | desktop, mobile |
| E2E-WEB-194     | Simulated lost acknowledgment after actual server save; reload/retry returns original receipt and no duplicate after received | desktop, mobile |
| E2E-WEB-195     | Actual operator review followed by submitting user's private receipt status/version refresh                                   | desktop, mobile |
| E2E-OFFLINE-230 | Feedback-only submission survives reload, stays separate/private and sends nothing while disabled                             | offline         |
| E2E-OFFLINE-231 | Unsafe destinations rejected; disabled configuration survives reload                                                          | offline         |
| E2E-OFFLINE-232 | Cancelled consent never queues or delivers a report                                                                           | offline         |
| E2E-OFFLINE-233 | Simulated terminal POST rejection during concurrent deletion still proceeds to eventual DELETE                                | offline         |
| E2E-OFFLINE-234 | Out-of-order simulated receipt checks cannot downgrade a newer persisted receipt version                                      | offline         |
| E2E-OFFLINE-235 | Another tab rereads durable queue after payload-free invalidation; submitted and deleted records become visible consistently  | offline         |

Apply migration 016 and use the existing test UI with @FEEDBACK-001; leave watch/eye mode off. Offline cases use dedicated Android assets and require no server. Native acceptance covers viewport capture (not OS/other apps), form masking and review, microphone allow/deny/background stop, restart/CDN-switch queue retention, controlled HTTPS receipt/deletion, same-key update persistence and existing imports/Back. Never reset existing user data. Source recordings, lost acknowledgments and denial simulations are labelled; authored tests are not runtime evidence. Parent records current results/APK identity separately in status. See [complete workflow](../../docs/development/feedback.md), [API](../../docs/development/feedback-api.md), [native acceptance details](../../docs/development/feedback-native.md).

## TEAM-002 — allocations, recovery, record reports and identity

These are implemented bounded workflows, not a claim that the complete roadmap or production acceptance is done. Runtime results and the tested revision are recorded in [status](../../docs/development/status.md).

| Case            | Coverage                                                                                                                         | Projects        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| E2E-API-200     | Exact allocated quantities/cost, oversubscription, concurrent version conflict, changed holdings and revision history            | api             |
| E2E-API-201     | Split quantities, account isolation, removed-goal review and privacy export                                                      | api             |
| E2E-WEB-200     | Choose goal/holding, review, consent, save and reload allocation                                                                 | desktop, mobile |
| E2E-WEB-201     | Mobile keyboard, cancel edit, release allocation and changed-holdings review                                                     | desktop, mobile |
| E2E-OFFLINE-240 | Durable local allocation choose/review/save/reload/history                                                                       | offline         |
| E2E-API-210     | Recovery-code rotation/single use, session revocation, retained data and concurrent login serialization                          | api             |
| E2E-API-211     | Durable recovery failure budget across sessions                                                                                  | api             |
| E2E-API-212     | Global recovery budget admits one concurrent final request then caps counters and per-user cardinality                           | api             |
| E2E-WEB-210     | One-time private code display, actual screenshot privacy-mask pixels, zero upload and forgot-password journey                    | desktop, mobile |
| E2E-OFFLINE-250 | Local code reset, consumed-code rejection, retained records and revoked session                                                  | offline         |
| E2E-OFFLINE-251 | Local recovery failure limits survive reload without changing password                                                           | offline         |
| E2E-OFFLINE-252 | Device recovery budget caps counters and new usernames across concurrent requests and reload                                     | offline         |
| E2E-OFFLINE-253 | Real generated device recovery code is masked in screenshot pixels and discarded without upload                                  | offline         |
| E2E-API-220     | Owned report request, idempotency/conflict, issuance and JSON download                                                           | api             |
| E2E-API-221     | Strict report consent/input rejection without creating jobs                                                                      | api             |
| E2E-API-222     | Test-owned expired leases, exhausted retry, explicit retry and cancellation                                                      | api             |
| E2E-API-223     | Populated exact report, no allocation double count, immutable snapshot after edits, new review flags, privacy/ownership/deletion | api             |
| E2E-WEB-220     | Report create/open/download/reload                                                                                               | desktop, mobile |
| E2E-WEB-221     | Mobile report dialog, Escape, focus return and overflow                                                                          | desktop, mobile |
| E2E-WEB-222     | Populated goals/holdings/allocation report, exact displayed amounts, reload and export                                           | desktop, mobile |
| E2E-OFFLINE-260 | Durable local report create/open/download/reload                                                                                 | offline         |
| E2E-OFFLINE-261 | Queued snapshot survives reload and later goal changes                                                                           | offline         |
| E2E-OFFLINE-262 | Populated local report keeps contribution estimate separate from allocated recorded cost                                         | offline         |
| E2E-API-230     | Actual OpenFIGI mapping, immutable evidence/hash and replay/unchanged edition                                                    | api             |
| E2E-API-231     | Investor/Origin/input denial before provider work and private account preservation                                               | api             |
| E2E-API-232     | Explicitly simulated cooldown/interruption preserves previously stored real evidence                                             | api             |
| E2E-API-233     | Bounded search, invalid/missing identity and evidence ownership                                                                  | api             |
| E2E-WEB-230     | Actual operator identity refresh → directory → evidence/history → keyboard/Back/reload                                           | desktop, mobile |
| E2E-WEB-231     | Simulated read failure → retry actual empty API, missing identity and guest operations gate                                      | desktop, mobile |
| E2E-OFFLINE-270 | Dated real bundled identity/evidence/hash/history and Back without API network                                                   | offline         |
| E2E-OFFLINE-271 | Offline search miss and unsupported refresh preserve stored identities                                                           | offline         |

Use tags `@ALLOCATIONS-001`, `@RECOVERY-001`, `@REPORTS-001`, `@IDENTITY-001`. Connected cases use the real isolated application fixture described in [test setup](README.md#team-002-isolated-application-cases). `@real-provider` requires ordinary OpenFIGI availability; `@simulated` explicitly marks controlled interruption scenarios and is not provider-success evidence. Offline identity cases require a fresh bundle containing at least five actual stored identities. Physical Android install, keyboard, native Back/file export, airplane-mode and same-key update acceptance remain separate from Playwright coverage.
