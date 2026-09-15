# RESEARCH-AUTO-002 handoff

Implementation authored, not executed. Contracts, API, durable schedules/attempts, raw calendar retention, public calendar reader, Operations controls, offline adapter and test cases are present. Shared wiring and trackers are integrated. No tests, lint, format, typechecks, build, migration, ingestion, service or commit was run by this worker.

## Integration

- Contracts export `research-auto.js` and `research-auto-policy.js`.
- Factory `RESEARCH_AUTO_STORE => new ResearchAutoStore(config, discovery, config.RESEARCH_AUTO_ENABLED ?? true, policies)` injects `DISCOVERY_STORE` and `RESEARCH_AUTO_POLICY`; registered `ResearchAutoWorker` and both `ResearchAutoController`/`ResearchCalendarController`. Isolated API harnesses set RESEARCH_AUTO_ENABLED=false; direct worker test enables only local glossary.
- Registered additive `054_research_automation.sql`. Runtime grants include the new schedule/run/edition and publication-policy tables. Tables preserve all existing data.
- Operations tab **Automatic research** renders `ResearchAutomation` using authenticated existing request wrapper; public More route **Release calendar**, hash `#research-calendar`, renders `ResearchCalendar`.
- Snapshot includes server `/research-calendar` response as `researchCalendar`; offline GET dispatch uses `offlineResearchCalendar(bundle.researchCalendar, edition)` with ordinary offline error handling. Snapshots include current calendar body only and filter unavailable history links. No worker runs on device. Shared Android code requires user rebuild/reinstall to take effect.

## Delivered behavior

One per-minute timer selects one due enabled source, globally serialized through PostgreSQL session advisory lock. Six-hour defaults enable existing eligible sources plus fixed BEA calendar. Stored opt-out survives restart and initialization. Hourly to weekly intervals are configurable. Each claim creates a durable UUID; `research_auto_runs.discovery_run_id` links the discovery/source-run/raw-body graph; calendar runs link capture_hash to Mongo `research_calendar_raw` and immutable PG `research_calendar_editions`. Content-addressed capture and existing discovery fingerprinting make repeat ingestion safe. A crashed process releases its lock; next claim marks prior unfinished attempts failed before retrying. Failures retain old publications and defer retry 15 minutes. An in-flight capture may complete after a pause. Timer shutdown drains before pools close.

Existing feed adapters retain raw sources through DiscoveryStore and create reviewed-publishing candidates. A reviewed per-source policy can authorize eligible official stories automatically; otherwise individual human review remains required. After admitted publication, existing Today/Explore/Stories readers receive actual admitted content. Pausing fetching does not delete historical data. Generic errors contain no credentials/provider body dumps.

BEA ICS is researched at its official subscription page. UTC times, UID, SEQUENCE, cancellation and line folding are parsed. Empty/oversized/incomplete/ambiguous/duplicated documents fail instead of replacing last good edition. Public reader shows upcoming/all retained dates, source links, capture age, historical capture selection and explicit retry. Capture dates are not original release vintages or actual release confirmation.

## Authored acceptance

| ID               | Coverage                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| E2E-API-1050     | Actual operator authentication, invalid source/interval rejection, persisted pause                                       |
| E2E-API-1051     | Actual PG synthetic calendar fixture, read/replay, immutable-delete guard, invalid edition                               |
| E2E-API-1052     | Strict UTC, malformed/duplicate, folded-line parser cases                                                                |
| E2E-API-1056     | Real worker + DiscoveryStore + owned PG: glossary creates actual drafts and linked run once; future due avoids duplicate |
| E2E-WEB-1053     | Desktop/mobile actual API calendar, select retained edition, simulated storage failure/retry, Today return               |
| E2E-OFFLINE-1054 | Shared on-device calendar route and truthful vintage explanation                                                         |
| E2E-OFFLINE-1055 | Empty snapshot and unavailable historical-capture rejection                                                              |

Manual visual acceptance: narrow Android/desktop layouts, keyboard interval and capture selects, readable time zones, pause/enabled statuses; make a real eligible source due and inspect the UUID-linked raw capture/draft then publish and confirm Today/Stories. Simulated fixtures are labelled; no claim of live source execution. No schema/format or package installation is introduced.

## User-run next actions

After root finishes integrations: `pnpm db:up`, `pnpm db:migrate`, then restart `pnpm dev`. Use the printed web URL and `/#ops` → Automatic research or `/#research-calendar`. Run `pnpm sdlc "Add automatic research and retained release calendar" -- --grep RESEARCH-AUTO-002` for the gated commit and focused tests; API, desktop, mobile and offline projects need the existing DB/API/web/offline harness prerequisites. Watch/eye toggles remain off. On failure send the exact failed ID/project/error and `artifacts/e2e/latest.md` run reference, not a complete passing-suite log. No commit hash is created by this worker; gating remains user-run.

## Explicit remaining scope

Verified machine-calendar ingestion for RBI/MoSPI/Fed and original historical numerical publication-vintage archives are not implemented by this adapter. Retained BEA calendar captures do not complete those source families. Calendar values are scheduled events only, not numeric macro releases. External rights or review-required discovery sources are not silently enabled. Automatic image generation and evaluation lineage have separate integrated workstreams and acceptance records. These authored slices do not establish broad DEV-011/018 verification.

## Added automatic news-to-feed publication

The earlier draft-only behavior is extended with explicitly approved source policies. RESEARCH_AUTO_POLICY → new ResearchAutoPolicyStore(config, discovery), ResearchAutoPolicyController, the fourth ResearchAutoStore policy argument and contract exports are integrated. Migration054 now includes versioned proposal/head/approval/per-item receipt tables. ResearchAutoPublication is already nested inside the Operations component.

Operators review actual source terms and publication scope once, propose a policy, then approve it (a different named publisher in named mode). It expires and binds source/rights/adapter fingerprint and current authority versions. The worker verifies retained official raw bytes and source hash, then commits eligible news publication with source/policy/role admission. Successful revisions become visible in Today/Stories through normal feed reads. Missing provenance or changed authority/source is excluded with a durable receipt and status explanation. At most50 drafts per source run; default without policy stays manual review. Existing/future official drafts are explicitly in scope. No LLM auto-publication.

Authored API1057 exercises actual synthetic official-format RSS stored in owned Mongo/PG → approved policy → actual public story and one receipt; API1058 denies named self-approval. WEB1059 covers rights/scope review, propose/approve and status. No provider was called and no tests executed. Run the existing RESEARCH-AUTO-002 filtered SDLC command. To activate production behavior, load source policies and review terms before proposal/approval, then enable source capture; no per-story intervention is required for qualifying items while policy remains active.

Final queue fix: source-specific bounded SQL replaces discovery.operations inventory materialization. Latest-attempt ordering places new versions first and rotates exclusions; migration054 retains each exclusion attempt while enforcing uniqueness only on successful editions, with source-prefix/draft/attempt indexes. API1060 authors >50 other-source heads, an invalid first batch, next-batch actual publication and subsequent retry fairness. API1060 is the focused regression for the root coverage tracker. No execution or gated commit performed. Smallest validation: `pnpm sdlc "Fix automatic publication queue fairness" -- --project=api --grep E2E-API-1060`; requires normal owned PostgreSQL/Mongo/API harness prerequisites. Expected three batches of 50 receipts, no foreign-source receipts, one published story and every malformed draft retried. Send failed ID/error and saved run reference if it fails.
