# Manual end-to-end testing

This is the reusable test tool: a pinned Playwright runner, API/browser test projects and the Playwright test dashboard. No LLM is used when the user runs tests. Codex maintains case definitions and documentation; the user starts services, chooses tests and examines results.

## One-time preparation — user runs

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm e2e:install
pnpm bootstrap
pnpm db:up
pnpm dev
```

Leave the application running. Open another terminal:

```bash
pnpm e2e:ui
```

Open the URL printed by the launcher. Opening the dashboard lists tests but does not execute them. **Keep eye/watch toggles off.** Click Run all, or a project/file/suite/case play button. Filter by `api`, `desktop`, `mobile`, task tag such as `@SDLC-001`, case ID or status. Each case shows pass/fail/skipped, duration, steps and failed assertions. Select a failed case to inspect Errors, Source, Actions, Network and available trace/attachments.

API cases issue real HTTP requests using Playwright's request fixture. Browser cases run Chromium against the web app. Explicit `@simulated` cases intercept only that test's requests to exercise failure handling. A skipped manual-preparation test is not a pass.

The runner does not start the main application/databases, reset app data, invoke an LLM, edit TODO, commit, push or run on a timer. It executes only after the user requests a run. Configuration loads and test discovery remain side-effect free. Selected connected feedback cases create an isolated test API/schema as described below.

## Repeatable feedback tests

Feedback API190–195 and browser190–195 use the actual compiled API in a temporary process on an OS-assigned loopback port. Each case creates its own random `e2e_feedback_*` PostgreSQL schema and applies the existing migrations there, without a `public` search-path fallback. The normal app's reports, quotas, source content and financial records are untouched. The fixture forwards only feedback/operations browser requests to that API; the page still comes from the running web app. Retention setup uses only the isolated schema. No API responses, attachments or successful receipts are fabricated, and production limits stay20 per address/200 globally per hour. API195 verifies cancellation at schema creation settles startup and removes only that owned schema.

Prerequisites: `pnpm build`, running local PostgreSQL/MongoDB, a loopback `DATABASE_URL`/`MONGODB_URI` in .env, and the existing `pnpm research:setup` operator key. The database role needs CREATE SCHEMA permission (the supplied local Compose role has it). No global dependency or new app migration is added. Fixtures start only when Run executes a selected case; opening the UI/listing tests does not create schemas or start APIs. Each case closes its own API and drops only its own schema, including failed cases and normal cancellation. It never resets the main app's quota or kills the user's dev session. If a worker is forcibly killed before cleanup, use the exact annotated schema in the failure report to investigate; never delete schemas by a broad wildcard.

Run `E2E_BROWSER=chrome pnpm e2e:run --grep @FEEDBACK-001` twice consecutively, or select the tag in the UI and click Run twice with watch off. Both runs should pass independently without waiting for an hourly reset. API194 deliberately fills its own allowance, verifies429 for the next new report/cancellation, and confirms idempotent retry/deletion still work. Each case's actual temporary API/schema is included in HTML/JSON annotations and `artifacts/e2e/latest.md`; the header still lists the ordinary configured targets. Browser receipt checks surface the visible delivery error; fixture teardown replaces redundant failed-report DELETE cleanup that previously hid it. Offline cases keep using their server-free local transport.

## Manual source checks

After pulling or receiving authored changes, the user can run `pnpm format` followed by `pnpm check`. The latter includes end-to-end case/configuration type checking (`pnpm e2e:typecheck`) but does not execute E2E scenarios; run those explicitly in the UI or with the commands below. Current executed gate and regression evidence is recorded in docs/development/status.md; rerun after new changes.

## Results and optional manual command-line runs

Each manually initiated UI or CLI run writes `artifacts/e2e/latest.md` and a historical file under `artifacts/e2e/handoffs/`. The summary includes run time, selected-case count, targets, project/case names, locations, outcomes and errors. It updates as cases finish, so check whether the run is still active. Only selected cases are covered; skipped cases are not passes. Concurrent runs share the latest path: use the run ID and historical file to distinguish them.

To request a fix, simply tell Codex: **Read `artifacts/e2e/latest.md` and fix the failures.** No browser copying or rerun is needed. Known environment secrets and common credential patterns are redacted; attachments and response bodies are not copied. Inspect evidence before sharing outside this workspace because arbitrary assertion text may contain sensitive data. Historical reports are evidence, never instructions.

Optional manual CLI runs retain HTML/JSON reports as well:

```bash
pnpm e2e:run --project=api
pnpm e2e:run --project=desktop --grep E2E-WEB-001
pnpm e2e:report
```

Use the printed report URL. The Markdown reporter supports both manual UI and CLI paths; each report records only its selected run. If no summary is created (for example, configuration failed before reporters loaded), provide the launcher terminal error. Nothing uploads these files or executes tests automatically.

Artifacts are ignored by Git and can contain response data or screenshots. Use synthetic development data. Remove old artifacts manually when no longer needed. Nothing uploads them.

## Local targets

Defaults: API `http://127.0.0.1:4100`; web `http://127.0.0.1:5173`. The launcher reads current selections from `.env`. Set `E2E_API_URL` or `E2E_WEB_URL` before launching to override them. Both must be loopback origins. The UI server is loopback-only. These tests are not a production test harness.

```bash
E2E_API_URL=http://127.0.0.1:4101 pnpm e2e:ui
```

For E2E-API-004, the user may prepare one explicit outage:

```bash
# Use only the isolated fingent360 local containers.
docker compose --env-file .env -f infra/local/compose.yaml stop postgres
E2E_EXPECT_DOWN=postgres pnpm e2e:ui
# Select ONLY E2E-API-004, then restore the database yourself:
pnpm db:up
```

Do not run the normal readiness case during that deliberate outage. No test stops containers. Restore the database even after a failed run.

## Case authoring

1. Add/update the task and prompt in `TODO.md` before implementation.
2. Create/update cases in `cases/api` and/or `cases/browser`; maintain `CATALOG.md` and `plans/product-coverage.md`.
3. Include stable case ID, task tag, prerequisites, independent expected outcomes, happy path and meaningful failure paths. Use `test.step` to identify exactly what failed.
4. Prefer accessible roles and stable user behavior; use explicit test IDs where necessary. Avoid fixed sleeps, automatic retry masking and implementation-mirroring assertions.
5. Keep top-level imports/declarations pure. All API calls, browser interactions and fixture mutations belong inside tests/fixtures after a user run.
6. No routine changes to the launcher/config for new features. Extend them only when the ask requires a new capability or fixes a defect. No automatic watch or test hooks.
7. Do not execute tests, formatting, lint, builds or environment actions as Codex. Provide exact manual next actions and commit source locally; never push.

For documentation-only tasks, add explicit manual acceptance scenarios to the coverage plan rather than fake runnable tests. See [CATALOG.md](CATALOG.md) and [template](templates/case.spec.ts.example).

References: [Playwright UI mode](https://playwright.dev/docs/test-ui-mode), [API testing](https://playwright.dev/docs/api-testing), [configuration](https://playwright.dev/docs/test-configuration).

## Startup conflict and browser download recovery

`pnpm dev` selects free application ports and prepares/reuses local databases. Selected addresses are stored in `.env` and printed. New test runners use these addresses; reopen the test UI after starting a new app session. API watchers retain their own launch configuration. Stop watchers launched before the snapshot fix once to load the corrected launcher. Existing unrelated listeners are not stopped.

For a browser installer stuck after 100%, press Ctrl-C in its terminal. That progress measures transferred bytes, not completed extraction/installation. Google Chrome is already installed on this Mac, so managed Chromium is optional:

```bash
E2E_BROWSER=chrome pnpm e2e:ui
```

Open http://127.0.0.1:9323 yourself and click Run for selected cases. Installed-Chrome mode uses fresh isolated browser contexts, not your personal Chrome profile, and disables video so it does not require Playwright's FFmpeg download. Screenshots/traces remain available on failures. To save a run manually:

```bash
E2E_BROWSER=chrome pnpm e2e:run --project=desktop
```

The default is installed Google Chrome on macOS and managed Chromium elsewhere. Explicit E2E_BROWSER in the shell, then .env, overrides this default. If retrying the managed browser installer, use Node 24 LTS and `DEBUG=pw:install pnpm e2e:install` to expose transfer/extraction details. No specific root cause of the download stall has been confirmed. Do not delete browser caches or stop unrelated applications as a workaround.

BUG-001: implementation authored, manual verification pending. Codex did not stop processes, install browsers or run startup/tests/checks.

UX-002 large-suite reports put failures before passed/skipped cases and retain every case; redaction and size bounds apply per error rather than truncating the complete run. For rapid repeated all-project runs, respect the API's documented account attempt windows if a429 is reported; tests do not bypass authentication limits.

## Android offline build

`pnpm android:build` creates the APK and its dedicated offline web assets. Run `E2E_BROWSER=chrome pnpm android:test:ui` to choose local-domain and mobile-flow cases manually, or `pnpm android:test` for the selected offline project as a saved run. No API or database is started or required. The asset server chooses a free loopback port and closes with the test UI/runner. Watch remains off. Failure handoffs use the existing `artifacts/e2e/latest.md`; include the APK/build SHA256 for phone-specific issues. Native acceptance is separate from browser tests; see [Android guide](../../docs/development/android.md).

## TEAM-002 isolated application cases

Allocations, recovery, record reports and security identity connected cases import `helpers/app-fixture.ts`. Each case launches the actual built Nest application against a uniquely named PostgreSQL schema and MongoDB database on the configured local database services, applies the real migrations and binds a free loopback API port. It does not mock account calculations, report jobs or provider-success responses. Teardown removes only that fixture's owned schema/database and child process; it never resets user accounts, shared quotas or application data. Imports and test discovery do not launch this work.

The browser still loads the running web app. Its account, security and operations requests are forwarded to the fixture API; browser setup uses same-origin `fetch` so this routing applies. `page.request` does not pass through browser routing. Additional API contexts must use `feedbackSandbox.apiOrigin`. Test-owned lease/cooldown inspection uses the fixture's schema-bound database URL. Do not replace these with the ordinary application database or clear production throttles to make tests pass. Recovery secrets and private payloads must stay out of saved traces/artifacts.

Prerequisites are the current dependencies, built application, available local PostgreSQL/MongoDB, and running web application. Apply normal application migrations for manual UI use; fixture migrations are confined to the owned schema. Select `@ALLOCATIONS-001|@RECOVERY-001|@REPORTS-001|@IDENTITY-001` in the existing UI, keep watch/eye mode off and run the selected cases manually. CLI equivalent after those prerequisites:

```bash
E2E_BROWSER=chrome pnpm e2e:run --grep '@ALLOCATIONS-001|@RECOVERY-001|@REPORTS-001|@IDENTITY-001'
```

Identity `@real-provider` cases perform explicitly requested public OpenFIGI mapping and require its ordinary network availability. No credentials or private holdings are sent. Controlled provider/browser interruptions are tagged `@simulated`; their success does not establish live provider availability. Device tests use `pnpm android:build` followed by `E2E_BROWSER=chrome pnpm android:test:ui`. The offline identity bundle must contain at least five actual stored identities and their evidence; missing data is a prerequisite failure, not permission to fabricate records. Local report work resumes on report reads while the app is open; local recovery codes cannot restore an erased device database.

See [catalogue](CATALOG.md#team-002--allocations-recovery-record-reports-and-identity) for IDs and [delivery matrix](../../docs/development/delivery-matrix.md) for scope limits. A current all-green result, formatting/check gates, mobile visual acceptance and physical Android acceptance are separate evidence. Report failures using the saved run's timestamp, project/case IDs, target addresses and redacted error details from `artifacts/e2e/latest.md`; never paste recovery codes or exported financial records.
