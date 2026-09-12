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

Open http://127.0.0.1:9323. Opening the dashboard lists tests but does not execute them. **Keep eye/watch toggles off.** Click Run all, or a project/file/suite/case play button. Filter by `api`, `desktop`, `mobile`, task tag such as `@SDLC-001`, case ID or status. Each case shows pass/fail/skipped, duration, steps and failed assertions. Select a failed case to inspect Errors, Source, Actions, Network and available trace/attachments.

API cases issue real HTTP requests using Playwright's request fixture. Browser cases run Chromium against the web app. Explicit `@simulated` cases intercept only that test's requests to exercise failure handling. A skipped manual-preparation test is not a pass.

The runner does not start services, migrate/seed/reset databases, invoke an LLM, edit TODO, commit, push or run on a timer. It executes only after the user requests a run. Configuration loads and test discovery must remain side-effect free.

## Manual source checks

After pulling or receiving authored changes, the user can run `pnpm format` followed by `pnpm check`. The latter includes end-to-end case/configuration type checking (`pnpm e2e:typecheck`) but does not execute E2E scenarios; run those explicitly in the UI or with the commands below. Source formatting and all checks are pending for this change.

## Results and optional manual command-line runs

The UI shows results for the current session. For persistent reports, the user can manually run:

```bash
pnpm e2e:run
pnpm e2e:run --project=api
pnpm e2e:run --project=desktop --grep E2E-WEB-001
pnpm e2e:run --grep @SDLC-001
pnpm e2e:report
```

Each command-line run writes `artifacts/e2e/<run-id>/report/index.html`, `results.json` and failure artifacts in `results/`. The report command opens the newest saved HTML report at http://127.0.0.1:9324. Previous runs are preserved. UI-session reporter output is not promised as persistent history; use the explicit command-line run when retaining evidence is needed. Share the case ID, failed assertion, relevant error/trace and run ID with Codex, with sensitive data removed. Codex records provided evidence in TODO; it does not run the failing test itself.

Artifacts are ignored by Git and can contain response data or screenshots. Use synthetic development data. Remove old artifacts manually when no longer needed. Nothing uploads them.

## Local targets

Defaults: API `http://127.0.0.1:4100`; web `http://127.0.0.1:5173`. Set `E2E_API_URL` or `E2E_WEB_URL` before launching for different local ports. Both must be loopback origins. The UI server is loopback-only. These tests are not a production test harness.

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
