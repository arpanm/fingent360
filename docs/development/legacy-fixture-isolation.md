# Legacy source fixture isolation

Task: LEGACY-FIXTURE-ISOLATION-001 / DEV-021. Status: specification and authoring; execution is user-owned.

API070, WEB070 and WEB181 currently write source registry revisions or glossary ingestion history through the configured normal API. Restoring a source's visible status does not remove its immutable revisions. These three cases will use the existing per-test application process, random PostgreSQL schema and matching MongoDB database. Their stable IDs and successful persistence, publication, history and UI assertions remain.

## Boundary and contract

- A dedicated source fixture extends the existing feedback fixture. API requests use its actual isolated API context. Browser requests retain their visible application origin; only the exact public `/api/v1/sources` and `/api/v1/discovery/catalog` paths are additionally forwarded. Existing protected `/api/v1/ops` forwarding remains inherited. Ordinary reading cases WEB180/182 continue using their existing published-data context.
- Browser operator login/logout must use browser `fetch`, so the context's forwarding and cookie jar apply. `page.request` bypasses browser routes and must not perform these mutations.
- All setup is lazy fixture execution, never an import or discovery effect. Existing process teardown closes the actual API and drops only its exact random owned schema/database, including on cancellation.
- The fixture reads the configured normal source tables before/after each selected case in separate read-only snapshots, comparing row digests without exposing source text or credentials. It never restores or deletes normal rows. A changed digest fails visibly; the check is not a claim about all application tables or unrelated concurrent activity.
- WEB181 selects only the application's authored glossary synchronizer. Actual discovery/source-run and edition writes occur in the owned schema. It makes no upstream request and is not described as live provider validation.
- No success responses are mocked. Synthetic registry metadata remains explicitly labelled; no real rights approval is invented. Sensitive trace/video/automatic screenshots remain disabled.

## Acceptance and reused layers

API070 retains unauthorized/origin/schema rejection, private creation, approved publication, optimistic conflict, immutable history and explicit unpublication. It additionally proves the created head/revisions exist in the owned database. WEB070 retains credential clearing, real operator login, two saves, visible history, Escape, durable reload and sign-out, with the saved rows checked in the owned database. WEB181 retains disabled-before-selection, a real successful glossary refresh, independent run status and selection retention; it additionally reads the actual owned run and heads after reload.

The existing source contracts, API, PostgreSQL/Mongo schema, responsive Operations/source UI and fixture lifecycle provide all product layers. This change introduces no product workflow, migration, numerical calculation, provider, dependency, worker or offline behavior. Desktop and mobile projects cover the existing UI; this authoring does not establish physical-device or visual acceptance. Existing packaged Operations acceptance remains applicable.

Normal source preservation covers `research_sources`, `research_source_revisions`, `discovery_items`, `discovery_versions`, `discovery_runs` and `discovery_source_runs`. The selected glossary path does not write raw Mongo documents. The existing fixture owns its Mongo namespace nonetheless. Concurrent normal ingestion/publication must not be run during the bounded digest checks; unexpected changes fail rather than being repaired.

## Remaining suite boundary

This child is limited to the three named cases. The handoff inventories other global mutators and external-provider checks; completing these three does not establish that an unrestricted full suite is isolated or provider-free. No tests are skipped and no runner defaults change. New regression IDs are unnecessary because the ownership assertions strengthen the existing cases directly.

## Verification

No tests, checks, builds, migrations, services, providers or commits are run by the author. After integration, the user runs the documented SDLC gate and explicitly selects API070, WEB070 and WEB181. Expected result: one API plus two browser cases on desktop/mobile, five selections, with actual owned storage and unchanged normal source digests. A failure report must retain run ID, project, case ID and safe fixture namespace annotation; never include the operator key, database URL or private artifacts.
