# BEA-001 integration handoff

## Integrated parent result — 2026-09-14

Root integrated19feature files, shared trackers and the actual179-item public bundle. It corrected one helper parenthesis, narrowly normalized the captured scheme-less official URL, refreshed lock-observer statistics and aligned browser/local fixtures with actual contracts.19/19connected BEA and11/11source regressions passed; all19selected offline scenarios have passing evidence across correction runs. Parent reviewed/published43actual drafts, confirmed ordinary replay creates no duplicates and preserved account/financial digests. Format/check passed114units; documentation-inclusive gates precede the scoped local commit. See status for exact runs, source/bundle provenance, manual reproduction and separate APK/phone acceptance. The following is historical authoring guidance.

Authoring is complete on `codex/bea-001`, base `843b975`; no agent tests, discovery, format, checks, builds, provider calls, installs, services, migrations or commits were performed. This worktree began clean. Changes are limited to this feature; root owns TODO/README/status/catalogue/coverage/matrix updates and the gated commit. No dependency or migration028 is required.

## Source decision and evidence

The parent verified ordinary HTTP200 text/xml from https://apps.bea.gov/rss/rss.xml at 2026-09-13T23:47:04.397755Z and checked https://www.bea.gov/help/faq/147 plus https://www.bea.gov/news/current-releases. The exact88,601-byte captured fixture has SHA256446cb4078349673864407af824f8a6f54c1ec9fc54d10d076451ae5c179915f7. Provenance is recorded alongside it. The feed contains both modern releases and legacy first-party archive links. Only `www.bea.gov/news/YYYY/...` headline/link/publication metadata is displayed. Explicit recognized `apps.bea.gov/newsreleases/...htm` entries are skipped. Numerical extensions, descriptions, PDF/calendar/media URLs are not interpreted or fetched. Unknown item fields fail the source, preserve raw evidence and leave prior publications unchanged.

The strict parser reuses existing fast-xml-parser from contracts, validates XML before parsing, rejects entities/DTD/oversize/deep nesting/duplicate URLs/invalid dates and restricts links. Full original RSS remains Mongo evidence. The public BEA evidence response has optional `scope: release-metadata` and only selected title/link/pubDate fields; its hash refers to the full original RSS. UI discloses this distinction. Existing response shapes without scope remain unchanged.

Published BEA sources qualify for explicit personal research connections. Source ID classification and canonical URL validation are shared; existing exact-version ownership/privacy/history/reaffirm/remove behavior applies. REPORTS-003 and CONNECTION-REVIEWS-001 need no source-specific code because they consume the same minimal connection receipt. Their integration is required before API326 and OFFLINE351: these cases deliberately fail when those actual features are absent.

## Manifest

New:

- `packages/contracts/src/bea.ts`: fixed-source constants, strict metadata parser, URL admission and BEA public-withdrawal redaction.
- `apps/api/src/bea-provider.ts`: canonical FeedItem metadata/hash/identity mapping.
- `apps/api/test/bea.test.mjs`: four unit scenarios using actual capture plus explicitly synthetic faults.
- `apps/api/test/fixtures/research/bea-rss.xml`, `bea-provenance.json`: exact actual capture and evidence. Existing fixture ignore preserves original bytes during formatting.
- `tests/e2e/helpers/bea-fixture.ts`: lazy isolated real PostgreSQL/Mongo/store/HTTP helpers; captured-response transport replay is labelled simulation, never a fabricated API success.
- `tests/e2e/cases/api/bea.spec.ts`, `browser/bea.spec.ts`, `offline/bea.spec.ts`.
- `docs/product/bea-releases.md`, this handoff.

Modified:

- `packages/contracts/src/index.ts`, `discovery.ts`, `research.ts`, `research-connections.ts`: exports, optional evidence scope, source classification and connection eligibility.
- `apps/api/src/research-providers.ts`, `discovery.ts`: fixed descriptor/adapter, retained raw ingestion, coherent BEA public history/evidence withdrawal checks and redaction.
- `apps/web/src/Discovery.tsx`: headline-only explanation, evidence-scope disclosure and withdrawn BEA controls.
- `apps/web/src/offline/content.ts`: matching BEA public redaction and unavailable evidence behavior.

No root trackers or existing public bundle are edited. Operations source selection/catalogue/filtering/Today/Explore/Scan/Stories/context/learning use existing schema-driven surfaces. Snapshot export already traverses all public sources and preserves the new optional evidence scope, so no exporter edit is needed. Parent must generate the actual dated bundle after publication.

## Cases to register

All cases use `@BEA-001`; explicit fault/captured-transport simulations additionally use `@TEST-SIMULATION`. API320 alone requests the ordinary live provider (`@external`). Browser cases route public discovery and owned-account calls to the per-test actual API; request setup never uses page.request to bypass browser routes. Operator recordings are disabled.

| ID         | Concrete behavior                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| API320     | Actual ordinary provider → isolated raw Mongo/hash → draft → review → public reader/evidence/filter                    |
| API321     | Exact parent-captured RSS ingestion/replay, no duplicate drafts, real source catalogue/run counts                      |
| API322     | Simulated HTML failure retained as raw, prior source preserved, independent glossary success                           |
| API323     | Actual editorial withdrawal/public redaction/evidence denial, original internal preservation, republication            |
| API324     | Synthetic headline correction is a new draft; old public edition stays until current-version review                    |
| API325     | Owned BEA goal link, exact replay after withdrawal, foreign history denied, unchanged finances/export/account deletion |
| API326     | Actual v2 selected report and review-inbox compatibility; minimal receipt, withdrawal/replay, no source text           |
| API327     | Missing operations auth, wrong Origin, duplicate/unknown/arbitrary refresh input denied before provider work           |
| API328     | Deterministic owned source-row blocker: withdrawal queued before evidence; old evidence denied after wait              |
| WEB320     | Source/global filter, Scan/Stories, keyboard reader, truthful excerpt/history/context, Back and reload                 |
| WEB321     | Actual Operations source selection/status plus UI publish/withdraw and investor tombstone                              |
| WEB322     | Empty filters and simulated feed/evidence503 with retry to actual API data                                             |
| WEB323     | Reader→owned goal→reason/consent/review/save→reload/privacy; unchanged finances                                        |
| WEB324     | Withdrawn public history omits old headlines after reload; no original/evidence/connection CTA                         |
| OFFLINE350 | Genuine parent-bundled BEA date/evidence/filter/reader/history/reload with zero API traffic                            |
| OFFLINE351 | Actual durable local connection/report/review acknowledgement/removal/replay/export/deletion; zero API                 |
| OFFLINE352 | Explicit synthetic withdrawal bundle, actual local handler, old text redaction and unchanged internal history          |
| OFFLINE353 | Explicit pre-BEA bundle simulation stays empty/unavailable rather than inventing source evidence                       |

Unallocated within this reservation: API329, WEB325–329, OFFLINE354–359. Existing cases are untouched. Authored18 E2E cases plus four unit scenarios are unverified until parent execution.

## Parent integration and validation steps

1. Integrate after EVIDENCE-LINKS, GOAL-SCENARIOS, REPORTS-003 and CONNECTION-REVIEWS-001, preserving their shared exports/privacy changes. Add the manifest/IDs to root trackers. No installation or migration is added for this child.
2. Parent-authorized `pnpm format` and `pnpm check`; use existing PostgreSQL/MongoDB and development services. Rebuild/restart the API through the normal parent-controlled workflow as necessary. No test fixture may touch main data; API tests use owned e2e_feedback schemas/databases.
3. `pnpm e2e:run --project=api --grep @BEA-001` exercises API320–328, including the genuine provider case. Run desktop/mobile cases with `E2E_BROWSER=chrome pnpm e2e:ui`, select WEB320–324, watch off. Inspect the printed test UI URL (preferred9323, otherwise selected free port), not an assumed fixed port. Investor UI uses the URL printed by `pnpm dev`; routes `#ops`, `#sources`, `#explore?source=bea`, `#read/<id>` and `#connections`.
4. After primary rights/access and actual headlines are reviewed, parent explicitly runs `pnpm research:refresh --sources=bea`, reviews/publishes eligible editions in Operations, then `pnpm android:snapshot`. Preserve the actual public snapshot date/hash and existing private records; never seed synthetic headlines into the product bundle. No automatic timer or source refresh is introduced.
5. Rebuild packaged web assets with `pnpm android:web`; `E2E_BROWSER=chrome pnpm android:test:ui`, select OFFLINE350–353 plus adjacent source/connection/report/review cases. Expected: genuine dated BEA data, strict excerpt disclosure, durable owned receipts and zero outgoing API requests. A pre-BEA package is an explicit prerequisite failure, not a skipped/passable empty fixture. APK installation/physical-phone/TalkBack/user-design checks remain independent; do not infer these from browser passes.
6. Failure evidence: run ID/date, actual printed URLs/projects/selected IDs, artifacts/e2e/latest.md and case trace/console where allowed, owned schema annotation and precise assertion. Never include operator keys or private user records. Gate a scoped local commit only after authorized checks succeed; never push.

## Separate remaining work

SOURCE-WITHDRAWAL-001 is registered by root for the pre-existing generic public source disclosure: other providers' public item/history/evidence and saved/source paths can still expose withdrawn content. BEA guards here are scoped and do not claim the broader fix. Preserve internal immutable source/financial/report histories and minimal personal receipts when that follow-up is authored.

SRC-008 remains broader than BEA headlines; no economic time-series canonicalization, prices, forecast, Indian-sector/holding impact or advice is implemented. BLS/BoE/RBI/SEBI source-specific rights/access gates are unchanged. Current provider/rights evidence belongs to the parent; these authored files do not establish production approval.
