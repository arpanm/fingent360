# Fingent360

A goal-aware market intelligence and portfolio platform for Indian investors. The development foundation is implemented; financial features and market feeds are still to be built.

## Start locally

Prerequisites: Node.js 24 LTS (Node 26 also supported locally), pnpm 11.23.0 and Docker with Compose.

```bash
cd /Users/arpanmacmini/code/fingent360
pnpm bootstrap
pnpm install --frozen-lockfile
pnpm db:up
pnpm check
pnpm dev
```

If pnpm is missing or differs, install the pinned version with `npm install --global pnpm@11.23.0`. `pnpm bootstrap` creates `.env` only when absent; it never overwrites existing settings.

- Web: http://localhost:5173
- API liveness: http://127.0.0.1:4100/api/v1/health
- Database readiness: http://127.0.0.1:4100/api/v1/ready
- PostgreSQL: localhost:55432; MongoDB: localhost:57017

The database ports intentionally avoid existing services on 5432/27017. Containers have a separate `fingent360` Compose project and persistent named volumes. Credentials in `.env.example` are local development defaults. Bindings are loopback-only. There is no production deployment configuration yet.

`pnpm dev` first builds the workspace, then watches contracts/API/web. Stop with Ctrl-C. `pnpm db:down` stops databases and preserves their data. If you change credentials after first startup, existing database users do not change automatically: migrate credentials rather than deleting volumes. If changing database ports/passwords, update the matching connection URI in `.env` as well.

## Working with Codex

Open this repository folder as the Codex project. Start with [AGENTS.md](AGENTS.md), [accepted decisions](docs/product/decisions.md) and the [development backlog](docs/development/backlog.md). The [full blueprint](docs/product/market-intelligence-platform-plan.md) includes free/paid data candidates, priorities and the 27-item source tracker in sections 10.6–10.10.

A useful next task:

> Read AGENTS.md and the product decisions. Implement DEV-001 from the development backlog: the screen-level PRD and canonical data dictionary for the first oil-shock vertical slice, with acceptance criteria. Preserve the agreed stack and educational initial scope. Update the backlog and status with what was completed.

## Repository map

| Path                   | Responsibility                                                             |
| ---------------------- | -------------------------------------------------------------------------- |
| `apps/web`             | React/Vite responsive starter; shared-contract API check                   |
| `apps/api`             | NestJS API, configuration validation, liveness and real database readiness |
| `packages/contracts`   | Versioned runtime API schemas shared by web and API                        |
| `infra/local`          | Isolated PostgreSQL and MongoDB Compose services                           |
| `scripts`              | Non-destructive environment bootstrap and runtime smoke check              |
| `docs/product`         | Blueprint and accepted conversation decisions                              |
| `docs/development`     | Backlog, verification status and development conventions                   |
| `docs/adr`             | Architecture decisions and rejected alternatives                           |
| `docs/policies`        | Product safety boundary and source trust requirements                      |
| `docs/data-dictionary` | Entry point for future domain contracts                                    |
| `docs/evaluations`     | First vertical-slice acceptance/scenario plan                              |
| `.github/workflows`    | CI checks and real-database API smoke test                                 |

## Verification commands

```bash
pnpm check       # format, lint, strict types, production builds, tests
pnpm db:status
pnpm smoke       # API must be running; requires both databases
pnpm format      # apply formatting
```

`/health` only proves the process is alive. `/ready` returns HTTP 503 when either database is unavailable. Automated API tests exercise both states with a controlled probe; `pnpm smoke` checks real PostgreSQL/MongoDB connections.

The web starter intentionally shows no market statistics or recommendations. Authentication, domain migrations, imports, workers, live providers, PWA install/offline support and recommendation policies are not implemented. See the [current status](docs/development/status.md).

## Source and recovery

Requirements were reviewed against all nine turns of **Market Analysis Review**, including the user's later corrections, and the supplied plan. [Shared conversation](https://chatgpt.com/share/e/6aa4c561-c880-8013-a081-a085a4c1a810).

The earlier runner reported commit `814fe0a063e2f52e04ea99cee5f085b2e3ff4119`. Its bundle download was blocked by Chrome; that commit was not imported. This is a fresh implementation of the agreed foundation, with its own local commit history. The original root plan is retained byte for byte; `docs/product/market-intelligence-platform-plan.md` is the canonical development copy. Edit only the canonical copy going forward.
