# End-to-end case catalogue

All cases below are **authored, not executed** in this SDLC change. No pass/fail is claimed. Task status and manual verification live in [TODO.md](../../TODO.md). Stable IDs appear in the UI, errors and reports. Browser cases run separately under desktop and mobile projects.

| ID | Task | Project / scenario | Prerequisites | Expected outcome | Kind |
| --- | --- | --- | --- | --- | --- |
| E2E-API-001 | SETUP-001, SDLC-001 | API liveness | Local API started | HTTP 200, strict shared schema, recent timestamp | Real API |
| E2E-API-002 | SETUP-001, SDLC-001 | Database readiness | API and both dedicated databases up | HTTP 200; PostgreSQL and MongoDB up | Real integration |
| E2E-API-003 | SETUP-001, SDLC-001 | Unknown route | API started | HTTP 404 with error status | Real API |
| E2E-API-004 | SETUP-001, SDLC-001 | Deliberate DB outage | User stops one dedicated container; opts in with E2E_EXPECT_DOWN | Ready 503 and selected DB down; live 200 | Manual preparation; skipped by default |
| E2E-WEB-001 | SETUP-001, SDLC-001 | Home → actual API | Web/API up | API connected; honest scope; three planned areas | Real integration |
| E2E-WEB-002 | SETUP-001, SDLC-001 | Unavailable API | Web up | API unavailable shown after 503 | Simulated network failure |
| E2E-WEB-003 | SETUP-001, SDLC-001 | Invalid API contract | Web up | Invalid timestamp cannot display API connected | Simulated invalid payload |
| E2E-WEB-004 | SETUP-001, SDLC-001 | Responsive/keyboard | Web up | No horizontal overflow; home link keyboard accessible | Real browser |

## Runner acceptance — user performs these once

1. Run `pnpm e2e:ui`; confirm listing alone makes no test requests or starts the app/databases.
2. Select the `api` project and E2E-API-001; click its play button. Confirm only that case executes and shows status, step and duration.
3. Click Run all with both databases, API and web running. Confirm API plus desktop/mobile results; E2E-API-004 is explicitly skipped unless opted in.
4. To inspect a failure, close the runner and launch with `E2E_API_URL=http://127.0.0.1:4199 pnpm e2e:ui` (an unused local port). Run E2E-API-001. Confirm connection failure, affected step and source line are shown. Relaunch normally afterward.
5. Run `pnpm e2e:run --project=api --grep E2E-API-001`; open `pnpm e2e:report`. Confirm the saved HTML result and machine-readable results.json exist under that run's artifact directory.
6. Reopen the UI; keep watch/eye icons OFF. Edit a test definition and confirm it is not executed until the user clicks Run.

## Planned feature coverage

[plans/product-coverage.md](plans/product-coverage.md) maps each future task to required acceptance scenarios. Planned scenarios are not runnable passing placeholders. When implementing a task, create concrete `.spec.ts` cases, replace its planned entries with executable IDs and link both directions to TODO.
