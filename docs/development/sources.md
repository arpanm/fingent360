# SOURCES-001 — Operational source registry

Current integration note,2026-09-15: the shared-key-only description below records the original slice. Named operator permissions and independent review now exist, and the current source-specific workflows are indexed in TODO/README. Historical passes remain revision-specific; they do not validate the latest source/privacy changes.

This slice stores source onboarding metadata in PostgreSQL. It does not activate adapters, retrieve arbitrary URLs, certify licensing rights, or replace the README 27-source roadmap. The database starts empty; no real provider is automatically approved. Operators must supply actual evidence before approving real sources. Public visitors see only the latest approved, published metadata, including its constraints and review evidence. Public metadata must contain no secrets or personal data.

The research operator key controls creation, editing, private drafts and history. The Sources page keeps that key in memory only and supports forgetting it. Each edit checks the expected revision under a row lock and appends a complete snapshot. Stale edits return 409 and require reloading. Database triggers reject revision update/delete; the latest pointer is transactional. Unpublishing removes the current public listing while retaining operator history. The shared key identifies the actor as research_operator; named individual operator identity remains future work.

Migration: infra/migrations/007_sources.sql. API: GET /api/v1/sources (public), GET /operator, GET /:id/history, POST /, PUT /:id (operator). URLs are HTTPS and contain no credentials; registry never fetches them. Reviewed sources require evidence and a nonfuture UTC review time. Only approved metadata may publish. Unknown request fields are rejected.

Manual acceptance: run pnpm format and pnpm check; apply pnpm db:migrate against a disposable local test database; configure pnpm research:setup and start pnpm dev. Open the printed URL at #sources. In a fresh E2E UI, run E2E-API-070 and E2E-WEB-070 in API/desktop/mobile projects, watch mode off. Expect draft privacy, authorized save, persistence, immutable revision history, stale-write rejection and publication withdrawal. Cases retain clearly labelled private synthetic audit fixtures (append-only records); use a disposable test database. Report artifacts/e2e/latest.md on failure. No tests or migrations were executed during authoring.

## Integration verification

Parent verified this feature in full E2E run `2026-09-12T16-09-40-894Z-64656`: 51 passed, zero failed, one intentional outage skip across the entire suite. Format/check passed, including 40 unit tests. New migrations were applied and repeated successfully. PWA installation prompts remain browser-dependent; the offline/cache behavior was exercised on desktop and mobile. Historical authoring-only statements above describe the agent phase before parent integration testing.
