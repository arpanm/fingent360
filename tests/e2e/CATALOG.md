# End-to-end case catalogue

All cases below are **authored, not executed** in this SDLC change. No pass/fail is claimed. Task status and manual verification live in [TODO.md](../../TODO.md). Stable IDs appear in the UI, errors and reports. Browser cases run separately under desktop and mobile projects.

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

## Runner acceptance — user performs these once

1. Run `pnpm e2e:ui`; confirm listing alone makes no test requests or starts the app/databases.
2. Select the `api` project and E2E-API-001; click its play button. Confirm only that case executes and shows status, step and duration.
3. Click Run all with both databases, API and web running. Confirm API plus desktop/mobile results; E2E-API-004 is explicitly skipped unless opted in.
4. To inspect a failure, close the runner and launch with `E2E_API_URL=http://127.0.0.1:4199 pnpm e2e:ui` (an unused local port). Run E2E-API-001. Confirm connection failure, affected step and source line are shown. Relaunch normally afterward.
5. Run `pnpm e2e:run --project=api --grep E2E-API-001`; open `pnpm e2e:report`. Confirm the saved HTML result and machine-readable results.json exist under that run's artifact directory.
6. Reopen the UI; keep watch/eye icons OFF. Edit a test definition and confirm it is not executed until the user clicks Run.

## Planned feature coverage

[plans/product-coverage.md](plans/product-coverage.md) maps each future task to required acceptance scenarios. Planned scenarios are not runnable passing placeholders. When implementing a task, create concrete `.spec.ts` cases, replace its planned entries with executable IDs and link both directions to TODO.

## BUG-001 regression acceptance — manual user steps

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
| E2E-WEB-020 | desktop/mobile | User refreshes real GDP, views history/source, reloads persisted values without overflow                            |

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

BUG-006: E2E-WEB-020 now asserts viewport containment while the provenance table is expanded, followed by normal History/Source clicks. Verified desktop/mobile in full run 2026-09-12T15-42-10-408Z-58293 (32 passed, E2E-API-004 intentionally skipped).

SDLC-003: manual format/check/commit/E2E workflow acceptance is recorded in plans/product-coverage.md; isolated orchestration regression cases are in tests/unit/sdlc.test.mjs. Existing API/browser cases are run by the wrapper without modification. Verification pending.

SDLC-002: [manual report and handoff acceptance](plans/sdlc-002-acceptance.md) covers SDLC-UI-001–005 and SDLC-DOC-001. Reporter regression definitions live in tests/unit/handoff.test.mjs. Execution pending.

Restart regression: after stopping pre-fix dev watchers, launch two dev sessions sequentially and record both printed API/web pairs. Make a harmless source edit to trigger API recompilation/restart. Both sessions must retain their own ports without EADDRINUSE. Launch the test UI for the latest session and manually run E2E-API-001/002/030 and E2E-WEB-001/030; also open the first session's printed web URL and confirm it remains usable. This manual scenario specifically covers watcher configuration lifetime; verification pending.

Lint follow-up: manually rerun `pnpm format` and `pnpm check` before the scenarios below. The two reported `no-unused-expressions` violations were replaced with equivalent conditionals; existing ESLint coverage checks this correction. No runtime behavior change or additional E2E case is needed. Verification pending.

Start a second root pnpm dev while the previous session runs. Open the newly printed web URL and a newly launched E2E UI; its target URLs must match. Run E2E-API-001/002/030 and E2E-WEB-001/030 to verify connectivity and account Origin handling. A second E2E UI/report listener must choose another free port without stopping the first. For database-port conflicts, use a disposable local setup and confirm selected Compose bindings match .env connection URLs and retained data; never remove volumes. Automated unit definitions cover allocator/env mapping and run under pnpm check. All execution remains manual.
