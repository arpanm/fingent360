# Current implementation status

As of 2026-09-12. The local development foundation is complete and verified.

## Implemented

- React/Vite responsive starter, with runtime-validated API connectivity.
- NestJS `/api/v1/health` liveness and `/api/v1/ready` database readiness endpoints.
- Shared Zod response contracts, validated environment configuration and secret-safe errors.
- Separate PostgreSQL 16 and MongoDB 7 containers, loopback ports and persistent volumes.
- Reproducible pnpm workspace/lockfile; formatting, lint, strict type checks, builds and tests.
- CI workflow definition with real-database smoke check.
- Codex instructions, accepted conversation decisions, blueprint, architecture decision and capability backlog.

## Historical foundation verification on this Mac — before SDLC change

| Check                                           | Result                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                | Passed                                                              |
| `pnpm bootstrap` with existing `.env`           | Preserved the existing file                                         |
| `pnpm check` on Node 26.7.0 / pnpm 11.23.0      | Passed: formatting, ESLint, strict TypeScript, builds and six tests |
| `pnpm db:up`                                    | Both dedicated containers healthy                                   |
| `pnpm smoke` against running API                | Passed: liveness 200; readiness 200, PostgreSQL and MongoDB up      |
| `pnpm dev`                                      | Web on 5173; API on 4100; watchers active                           |
| Desktop and 390px mobile browser inspection     | API connected; no horizontal overflow; no console warnings/errors   |
| Original root plan versus canonical copied plan | Byte-identical at setup                                             |
| `.env` exclusion                                | Confirmed ignored by Git                                            |

CI targets Node 24 LTS; the GitHub workflow itself has not run yet. Local checks above ran on Node 26.7.0. Database image downloads initially stalled, so setup uses the PostgreSQL 16/MongoDB 7 images already cached on this Mac, in new isolated containers and volumes. Existing databases were not modified. The API moved to port 4100 because another local app occupies 4000.

## Not implemented

Live market sources, authentication/tenancy, domain migrations, portfolios/imports, goal calculations, event graph, recommendation engine, workers/outbox, PWA service worker/installability, production deployment and regulated advice remain future work. No source has been onboarded. The full product's Gate 0 is still incomplete. Start with DEV-001 in the backlog.

## Provenance

All nine available turns of “Market Analysis Review” and the revised blueprint were reviewed. The earlier runner's claimed commit `814fe0a063e2f52e04ea99cee5f085b2e3ff4119` was not imported because Chrome blocked the bundle download. This repository contains a fresh implementation of the agreed foundation. Historical chat market claims were not used as verified data. The original root duplicate was later removed at the user’s request after its content was incorporated into README.md. README is the current product document; the docs/product copy is historical reference.

## SDLC change — 2026-09-12

SDLC-001 implementation is written: TODO with task prompts, case catalogue and planned coverage, reusable manual Playwright API/browser dashboard launcher, pinned dependency/lockfile entries, manual-only CI and updated repository instructions. The duplicate root plan is removed and the user's appended README blueprint is preserved.

SDLC-002 remains awaiting user acceptance. No dependency/browser installation, formatting, lint/typecheck/build, test execution or UI verification was performed for this change. The dependency graph was authored using registry metadata; the user's frozen installation validates it. No automated pass is claimed for the new cases. Follow tests/e2e/README.md for manual commands and CATALOG.md for runner acceptance.

## BUG-001 recovery

User reported duplicate development startup failure and browser download stalling at 100%. Read-only inspection found an earlier Fingent360 session still bound to 5173/4100 and an active Playwright downloader. Added a pre-build port-conflict message and optional E2E_BROWSER=chrome mode (video disabled to avoid FFmpeg). The download stall's exact cause remains unconfirmed. No processes were stopped or checks executed; manual acceptance is in tests/e2e/CATALOG.md.

## BUG-002 — pending manual verification

User reported E2E-API-003 receiving HTML for an unknown API route. Source inspection found that the installed Express adapter mounts fallback handlers using the unnormalized global prefix. Updated the prefix to /api/v1 and authored JSON-content-type/error-body regression assertions. No checks or tests run by Codex. User also confirmed development startup succeeded after stopping the old session.
