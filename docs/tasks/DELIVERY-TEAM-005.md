# DELIVERY-TEAM-005 — Pickup queue implementation batch

- **Status:** Implemented; validation pending for the bounded batch below. The whole roadmap is not complete.
- **Implemented:** Nine authored slices across source coverage, privacy, monitoring, public sharing and reader diagnostics, with contracts, actual storage/API workflows, shared web/app behavior, cases and documentation.
- **Pending:** User-run gates, additive migrations, applicable configuration and rebuilt Android acceptance. Parent functional gaps are listed below and remain Partial.
- **Next action / inputs:** Reconcile its bounded source/privacy/operations children; retain explicitly missing source and device requirements.
- **Verification:** No format/check/lint/typecheck/build/test/E2E/provider ingestion/service/migration/commit/push was executed by agents. Baseline HEAD `a2c53a0`; no earlier result establishes acceptance of this batch.

## Specification and implementation boundary

Follow the recorded pickup order using parallel ownership: privacy/support/channel work, monitoring/calendar/event work and equity/fund source work. Root owns shared module wiring, migrations/exports, saved failure diagnostics and shared trackers. Each feature specification and reusable task prompt lives in its linked task record. Implement actual source/storage/receipt paths; synthetic test fixtures are labelled and do not replace real application behavior. Preserve admission, privacy, immutable revisions, exact arithmetic and source rights. Never infer completion from code presence or a historical commit.

## Delivered scope and remaining functional gaps

| Task                                                                    | Authored behavior and layers                                                                                                                                                                                                         | Still missing / next owner action                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [DEV-017 support access](DEV-017.md)                                    | Administrator-only feedback reads; transactional audit; receipt-holder dated access history; saved history available offline. Existing feedback audit storage indexed by migration058; shared UI and API cases.                      | Broader support/security controls remain part of DEV-017. A recorded access is authorized delivery, not proof a person read it.                                                                                   |
| [DEV-017 private history](../development/private-history-encryption.md) | Owner/record-bound AES-GCM encryption for new opted-in private AI payloads, authorized read/export, key rotation, legacy upgrade and deletion. Migration061; same connected Android API/UI.                                          | Configure server-only keys. Old plaintext rows remain until owner access/completion or expiry; backups are not rewritten. Other PII encryption, KMS and MFA remain.                                               |
| [DEV-021 monitoring](DEV-021.md)                                        | Shared PostgreSQL request samples, multi-process incident episodes, acknowledge/retire controls, actual protected API and Operations UI. Migration059; offline shows connected-only state.                                           | Independent uptime hosting, external notification and measured restore/performance/security/device acceptance remain. In-process sampling cannot report while the entire deployment is down.                      |
| [Equity actions and fundamentals](EQUITY-COVERAGE-001.md)               | Verified-layout NSE action CSV and bounded rendered IndAS revenue/profit parser; exact dates/scales, identity/source provenance, stored review and company web/offline views. Existing version tables reused.                        | Automated download/backfill, direct XBRL, other statements/fields, exact adjustment ratios, adjusted prices and broader exchange/sector histories remain. No arbitrary purpose text is treated as an exact ratio. |
| [BLS calendar](RESEARCH-AUTO-002.md)                                    | Official ICS parser with supported timezone rules, retained source-isolated capture/history, automatic research configuration and web/offline calendar selection. Migration062.                                                      | Remaining calendars and original numerical publication vintages remain. Capture/worker/live acceptance is unrun.                                                                                                  |
| [Current AMFI NAV](FUNDS-BONDS-001.md)                                  | Current eight-column Plan/Option and legacy six-column formats, versioned receipts, stored review and scheme web/offline display/search. Existing JSON editions reused.                                                              | Actual source activation, broader scheme/history reconciliation, holdings/look-through and bond quote/credit feeds remain.                                                                                        |
| [Historical Fed policy](EVENT-SCENARIOS-001.md)                         | Two fixed official2024 statements retained through normal raw capture/draft review; reviewed event → exact mixed-fraction bound extraction → independent scenario review → immutable public/offline receipt. Existing tables reused. | Other RBI/macro/earnings/governance/liquidity packs and verified outcomes remain. Prior-decision change is not consensus surprise or portfolio impact.                                                            |
| [Public reading share](DEV-029.md)                                      | Canonical public HTTPS links, browser share/copy fallback, restricted Android native chooser and truthful local/offline unavailable state. Reuses public reader API; no DB needed.                                                   | Public deployment/device acceptance, WhatsApp business automation and iOS remain. Opening a chooser does not prove delivery.                                                                                      |
| [Reader diagnostics](READER-DIAGNOSTICS-001.md)                         | Safe category/phase/incident on transaction503, sanitized logging and real isolated missing-storage/recovery case. API120 now reports useful safe context; capture is mandatory. No new UI/schema required.                          | Original API120503 cause is unresolved until next manual evidence; this is diagnostic implementation, not a claimed root-cause fix.                                                                               |

[Current delivery](current-delivery.md) and [TODO](../../TODO.md) retain the broader parent gaps, including causal impact and buy/rebalance policies. This batch does not claim those missing requirements are implemented.

## Research and inputs

Primary evidence and exact limits are recorded in [equity coverage](../product/equity-coverage.md), [BLS calendar](../development/bls-release-calendar.md), [AMFI](../product/funds-bonds.md), [Fed pack](../development/fed-policy-pack.md) and [broker research](BROKER-PARSERS-002.md). Read-only source-format research was performed; no live ingestion or provider-generation job ran. Free public sources were prioritized; browsing a document does not activate a source or approve every reuse.

All five official broker download paths were checked. A complete export schema/sample was unavailable in the inspected public evidence; **0/5 named parsers** remains accurate. The coordinator asked whether a Zerodha Console export could later be provided in anonymized form. No answer received. Only layout/precision and invented rows are needed; never credentials, PAN, account IDs or real holdings. Generic mapped import stays available. No further user answer is needed for the next independent source/privacy research steps.

## Integration and data

Registered migrations058,059,061,062 in the normal migration runner;060 is unused, not a missing migration. No dependency changes. Monitoring store/controller/worker is wired in AppModule and test-process shutdown; new contract exports are registered. Calendar snapshots now retain separate BEA/BLS entries while preserving the legacy BEA field. New source/financial/AMFI/Fed data use existing retained documents and immutable structured JSON editions rather than duplicate tables.

Private AI encryption requires `PRIVATE_DATA_ACTIVE_KEY` and `PRIVATE_DATA_KEYS` in ignored server `.env` or a secret manager; see the linked key lifecycle instructions. Do not put them in browser settings or the APK. Opted-out operation does not need these keys. Missing keys never cause plaintext fallback.

## Manual activation and focused validation

Review the complete working tree first: `pnpm sdlc` stages all nonignored changes. Existing PostgreSQL/MongoDB and normal migration-owner configuration are required. When testing the normal local application, use:

```sh
pnpm db:up
pnpm db:migrate
pnpm dev
```

Use the web URL printed by the launcher; do not assume5173. Restart an existing dev session through the normal user workflow if it predates the changes. Configure encryption keys only if enabling private AI history. Source publication remains subject to its existing permitted-source and reviewer gates.

In another terminal, a focused batch run (format/check → gated commit → selected E2E) is:

```sh
pnpm sdlc "Implement pickup queue source privacy and operations slices" -- --grep 'E2E-(API|WEB|OFFLINE)-(904|905|906|1070|1084|1250|1251|1252|1253|1254|1255|1260|1270|1271|1272)\b|E2E-API-1115\b'
```

This still runs the existing complete check gates, but selects the new/changed E2E cases instead of the whole E2E suite. API uses actual isolated storage; WEB runs desktop/mobile; OFFLINE uses the existing offline test harness. `pnpm sdlc "Implement pickup queue slices" --checks-only` skips E2E when only gates/commit are wanted. Do not run both commands by habit; choose the intended workflow.

For the original reader failure after diagnostic validation, the separate user-run reproduction remains:

```sh
pnpm e2e:run --project=api --grep 'E2E-API-120\b'
```

That case refreshes its actual external source and needs the existing external-source prerequisites. Return its safe code/phase/incident and saved error context if it still fails.

UI destinations: Operations → Indian equity data / Fund data / Automatic research / Event scenarios / Quality overview; public More → Indian companies / Funds and bonds / Release calendar; Privacy → My AI request history; Feedback → delivery receipt/access history; reading detail → More → sharing. Keyboard, narrow-screen, Back, retry and offline states are authored acceptance, not observed passes.

For updated packaged content and Android UI/native sharing, follow the existing `pnpm android:snapshot` (only after source review), then `pnpm android:build` and manually install the printed APK. Repository edits do not update an installed offline APK. Physical share chooser, screenshots, rotation, microphone and gesture acceptance remain user/device actions. No APK was generated in this batch.

Keep watch/eye toggles off. Report first failed stage or exact test ID/project, saved run directory and redacted error context. Never include keys/private history/broker data. No new local commit was made because gates are manual; nothing was pushed.

## Documentation acceptance

Confirm every delivered slice links to its specification/current summary; TODO remains a task list; parent gaps are not relabelled completed; catalogue/coverage list exact stable IDs; research claims distinguish verified layout from live activation; no historical pass is applied to new files. No application test is manufactured for documentation-only status reconciliation.

## Static integration review

Cross-agent read-only review found and corrected a tentative-calendar-status loss (unsupported TENTATIVE now fails closed), a monitoring test-ID collision (new cases1270–1272), and missing named-viewer mutation coverage. Historical Fed raw HTML fixtures use .html.txt so formatting does not alter their retained-byte hashes. Root wired exports/migrations/worker lifecycle and reviewed safe reader diagnostics. Static review is not execution or a pass claim.

### Source acquisition additions — 2026-09-15

SBI Contra August2026 portfolio disclosure now has original capture, independent AMFI mapping/review, exact source discrepancy handling and shared web/Android/offline reading (migration092; API1530–1532, WEB1530, OFFLINE1530). Original weight inconsistencies remain visible; this does not claim complete fund exposure or other AMC layouts. AMFI historical NAV capture retains multiple dates per scheme and reconciles retained history (migration093; API1540–1541, WEB1540, OFFLINE1540). RBI MPC calendar acquisition retains the official FY2026–27 release and dates with no invented time, behind recorded source permission and disabled-by-default scheduling (migration094; API1550–1551, WEB1550, OFFLINE1550).

These changes are authored, not executed. User applies migrations and starts normal services, then selects the relevant family with `pnpm sdlc "Validate source acquisition" -- --grep "E2E-(API|WEB|OFFLINE)-(153[0-2]|154[01]|155[01])"`. Offline/app tests need the documented rebuilt web assets; installed Android packages require rebuild/reinstallation. Source permission/activation and physical-device acceptance remain separate from code completion.

## Source transport bound correction — 2026-09-15

Static integration inspection found new source import/capture endpoints inherited the100KB generic JSON bound even though their strict domain contracts accept larger original files. Scope: add route-specific bounded JSON parsing for India CPI/calendar, positioning, institutional-flow, oil, SBI, CCIL and adjustment inputs; preserve ordinary endpoint bound and every domain-size/parser validation. Allow JSON escaping overhead, never globally relax all requests. API1630 authors an actual >100KB original-structure oil capture and separately asserts generic route413 and domain oversize400. No source rows or credentials are fetched by this test. Backend transport-only correction reuses all UI/file limits, retained data models and original source handling; no migration/dependency. Tests/gates remain user-run.

### Channel, native parity and expectation acceptance — authored, not run

- API1600–1604, WEB1600, OFFLINE1600: opt-in WhatsApp verification, encrypted delivery, signed receipts, retry/consent/deletion and offline refusal. Provider transport is injected in tests; no real messages. Migration098.
- API1610, WEB1610–1612: iOS feedback-origin and shared native bridge acceptance; physical IOS1612–1619 cover actual capture/voice/queue/device behavior. Browser simulation does not prove native execution.
- API1620–1621, WEB1620, OFFLINE1620: original SPF GDP survey median retention, independent review and exact BEA comparison, retrospective timing and withdrawn/changed offline source refusal. Migration096.
- WEB1640–1643 and physical IOS1644–1649: three-broker native return correlation, expiry and explicit completion; actual provider activation/device acceptance remains manual.

User-run focused connected selection after migration and dev setup: `pnpm sdlc "Validate channels and expectation workflows" -- --grep "E2E-(API|WEB)-(160[0-4]|161[0-2]|162[01]|164[0-3])"`. Offline/native acceptance uses the separate documented package/device procedures. Changes remain uncommitted pending successful manual gates.

WEB1622 adds actual SPF Operations upload, changed-permission confirmation reset, author self-review rejection, independent publication, original inspection and withdrawal. Review receipt replay rechecks authorization after its database wait. WEB1660–1662 cover actual account export through the simulated iOS native completion/cancel/failure bridge; physical IOS1663–1669 cover protected native file lifecycle and share-sheet acceptance. All are authored, not executed. Focused user command: `pnpm sdlc "Validate source review and iOS export" -- --grep "E2E-WEB-(1622|166[0-2])"`.

API1650–1651 and WEB1650 author the standalone uptime observer against owned temporary HTTP targets and a durable independent journal: actual failure/recovery, restart, stale clock, unsafe target refusal and keyboard review. No application database or new migration/dependency. DEV021 initial operational code is complete; measured release/deployment acceptance is pending. User runs `pnpm sdlc "Validate independent uptime observer" -- --grep "E2E-(API-165[01]|WEB-1650)"`; independently deploy using the documented `pnpm uptime:monitor` command. No service was started.

API1670–1671, WEB1670/1672 and OFFLINE1670 author the original Cleveland Fed CPI model snapshot/BLS actual workflow: source retention, independent review, real Operations submission, withdrawal, exact monthly comparison and capture/review knowledge cutoff. Migration100; no new dependency. A current model page is never relabelled historical consensus. User runs `pnpm sdlc "Validate CPI model snapshots" -- --grep "E2E-(API|WEB|OFFLINE)-167[012]"` after migration/setup; offline build remains separate. CCIL controller prefixes were corrected to use the application's existing `/api/v1` prefix exactly once; existing1571–1572 actual endpoint cases cover this correction. Nothing executed.

API1690–1691, WEB1690 and OFFLINE1690 cover opt-in recurring WhatsApp: encrypted schedule versions, actual occurrence/outbox receipts, filtered source selection, missed-run skip, consent pause/delete and owner lifecycle. Migration102; existing default-disabled dispatch configuration. API1605 adds session expiry after an actual outbox read wait; all user-facing channel/schedule transactions re-admit the account after storage work. No external messages or validation executed.

API1700–1701, WEB1700/1702 and OFFLINE1700 cover seven-family exact qualitative mechanisms bound to independently released governance and reconstructed holding/goal receipts. Exact family, direction uncertainty, stale/conflict handling and unchanged holding/goal outcomes are asserted. No universal numerical causal effect is claimed. No migration/dependency. User-run selections: `pnpm sdlc "Validate channel schedules and transmission context" -- --grep "E2E-(API|WEB|OFFLINE)-(1605|169[01]|170[012])"`.

SRC014 initial registry implementation complete: API1680–1685, WEB1680–1682 and OFFLINE1680 cover exact retained original bytes, precision-aware metadata, independent publication, supersession/withdrawal, keyset continuation, expired replay admission and late-response UI guards. Migration101 and disabled-by-default source-permission configuration. This is a source registry, not qualified legal applicability/advice approval. User command after manual setup: `pnpm sdlc "Validate regulatory original registry" -- --grep "E2E-(API-168[0-5]|WEB-168[0-2]|OFFLINE-1680)"`. No source activation or validation executed.

Source integration follow-up: API1573,1622–1623 and1672 cover post-storage expiry admission and explicit reviewed-snapshot capacity; API1624/1673 and WEB1624/1673 cover actual101-draft GDP/CPI queues, microsecond-preserving25-record continuation and refresh/reset. No migration/dependency. User-run selected acceptance: `pnpm sdlc "Validate source queue continuation" -- --grep "E2E-(API|WEB)-(1573|162[234]|167[23])"`. No validation was executed.

API1720–1721, WEB1720 and OFFLINE1720 author the Axis NIFTY50 ETF February2026 original workbook adapter:50 equity rows, TREPS/current assets, source reconciliation, actual Operations upload/independent AMFI identity mapping and exact downloaded NAV admission. Existing SBI formats remain bounded separately. Shared upload transport accepts the documented2MB original limit; no migration/dependency. User runs `pnpm sdlc "Validate Axis portfolio original" -- --grep "E2E-(API|WEB|OFFLINE)-172[01]"`. Other AMC/scheme/month formats are not claimed supported.

### Additional verified-source workflows — 2026-09-15

- SRC009: API1710–1714, WEB1710–1711 and OFFLINE1710 cover retained monthly Gold/Silver/Copper originals, independent review, stable queue continuation and default-disabled scheduled draft capture. Migration104. Monthly benchmarks are not daily trading quotes; permission and activation remain explicit.
- SRC004/005: API1730–1731, WEB1730 and OFFLINE1730–1731 cover original rendered NSE banking statements, separate amount/ratio units, exact reconciliation, independent review and offline parity. No migration. Other industry formats and actual25-company acceptance remain open.
- SOURCES002: WEB1760–1761 cover specialized reader links and navigation when feed coverage is unavailable. No API/database change; existing source destinations are reused.
- SRC007: API1770–1772, WEB1770 and OFFLINE1770 cover original India GDP release retention, constant-price base isolation, quarantine, independent publication and offline cutoffs. Migration109; default-disabled60-minute current-day discovery retains drafts only. Historical discovery is tracked separately.

All cases are authored, not executed. After applying migrations and starting configured local services manually, select `pnpm sdlc "Validate source additions" -- --grep "E2E-(API|WEB|OFFLINE)-(171[0-4]|173[01]|176[01]|177[0-2])"`. Keep Playwright watch mode off. Report the exact failed case, artifact run and error. No dependency changes or commit in this batch.

### Retained history and continued queues — 2026-09-15

- SRC003 API1780–1783, WEB1780 and OFFLINE1780: independently reviewed original share-consolidation notices, both security identities, exact nominal comparison, suspension-aware daily-return exclusion, paginated Operations and offline evidence binding. Migration110. Holdings, fractional entitlements, rights elections, mergers and demergers are not automatically accounted for.
- SRC002 API1800, WEB1800 and OFFLINE1800: retained dated price ranges, complete-day pagination, conflicting same-exchange prices and exact provenance; offline incomplete snapshots refuse misleading history. Existing ingestion/migrations reused.
- SRC007 API1810 and WEB1810: separate25-row India macro edition/quarantine continuation through101 microsecond-ordered records, refresh reset and malformed cursor rejection. Existing array endpoints remain compatible; UI uses bounded page endpoints. Replays recheck operator admission after storage. No migration.

These are authored cases; no tests or services ran. After manual database migration and local services, run `pnpm sdlc "Validate retained source history" -- --grep "E2E-(API|WEB|OFFLINE)-(178[0-3]|1800|1810)"`. Review the complete pending working tree first because SDLC stages all nonignored changes. Report the exact failed case and saved artifact. Baseline remains a2c53a0; no commit/push.

### GDP archive pickup and admission follow-up — 2026-09-15

API1790–1791, WEB1790 and OFFLINE1790 cover the verified public PIB monthly archive callback, distinct legacy release IDs, original timestamps, retained drafts/quarantine, repeated capture and source inspection. New API1811 covers replay admission after an actual database lock wait expires the named session; existing original edition remains exactly once. No new migration/dependency beyond GDP109. Full historical coverage is not claimed merely because monthly pickup exists.

Manual after configured database/API/web startup: `pnpm sdlc "Validate GDP archive and admission" -- --grep "E2E-(API|WEB|OFFLINE)-(179[01]|181[01])"`. No execution/commit/push by the agent.

General-insurance statement coverage: API1820–1821, WEB1820 and OFFLINE1820 author retained original NSE operating results,17 exact amount metrics, solvency in times and claim/combined ratios in percent, independent review and shared/offline display. No migration/dependency. Shareholder PAT, life-insurance and technical-reserve formats are not substituted. Manual `pnpm sdlc "Validate general insurance statements" -- --grep "E2E-(API|WEB|OFFLINE)-182[01]"` with configured local services; cases are not executed.

UX002G WEB1830–1831 author retained-history keyboard focus, same-component commodity edition changes, browser Back and retry of the exact failed edition. Existing source APIs and offline readers are reused. No migration/dependency; physical-device acceptance remains separate. Manual: `pnpm sdlc "Validate source history navigation" -- --grep "E2E-WEB-183[01]"`. No validation or commit was performed.

Life-insurance account coverage: API1840–1841, WEB1840 and OFFLINE1840 author retained original policyholder/shareholder accounts,29 metrics,11 exact reconciliations and independent review/shared-offline projection. Unsupported solvency units and extraordinary-item policies remain explicit rather than guessed. No migration/dependency. Manual `pnpm sdlc "Validate life insurance accounts" -- --grep "E2E-(API|WEB|OFFLINE)-184[01]"`; nothing executed.

Archive API1792 adds future-month400 and partial-source failure retention: successful originals are saved, discovery and retrieval receipts remain inspectable, and incomplete acquisition is distinct from an empty month. Source errors produce safe503 responses. API1860–1866 author actual source-to-event-to-independent-mechanism release and withdrawal for seven event families, using primary-backed fixtures with explicit synthetic admissions. These cases do not prove a numerical causal coefficient. No migration/dependency; user runs `pnpm sdlc "Validate archived source and family bindings" -- --grep "E2E-API-(179[0-2]|186[0-6])"`. Not executed.

DEV018 completion: API1880, WEB1881 and OFFLINE1882 author exact followed-BEA calendar context with original edition/retrieval/UID/sequence, GDP-title restrictions, cancellation and stale-capture warning. Calendar plans never create notices, urgency or annual World Bank materiality changes. Existing schemas/storage/bundle reused; no migration/dependency. User-run `pnpm sdlc "Validate followed release calendar context" -- --grep "E2E-(API|WEB|OFFLINE)-188[0-2]"`. No execution. IMPACTTRACE implementation status also reconciled to the original evidence-trace requirement: numerical sensitivity was optional where available, not a prerequisite for the educational trace. No calibrated causal forecast or new pass is claimed.

SRC005 initial acceptance authoring complete:25 distinct issuers have independently inspected NSE source/identity/period/basis/scale and revenue/PAT expectations in the cohort manifest. API1890–1892, WEB1890 and OFFLINE1890 cover full-cohort parsing, actual retained duplicate-period publication, losses, malformed grouping and conflicting columns. Source inspection exposed and corrected Indian comma grouping and repeated quarter/YTD key duplication. Original HTTP bytes are not represented by reconstructed fixtures; source reconciliation and execution remain manual. No migration/dependency. `pnpm sdlc "Validate initial fundamentals cohort" -- --grep "E2E-(API|WEB|OFFLINE)-189[0-2]"`.

DEV020/EVENT-SCENARIOS initial educational acceptance complete in code: API1850–1851, WEB1850 and OFFLINE1850 retain a dated original Cleveland Fed historical model estimate and original BLS actual with exact percentage-point comparison. The estimate is a model, not market consensus, and retrospective app capture never claims the app possessed it before release. WEB1672 label updated for compatible capture UI. Existing contracts/storage/import limit reused; no migration/dependency. Manual `pnpm sdlc "Validate historical CPI evidence" -- --grep "E2E-(API-185[01]|WEB-1850|OFFLINE-1850|WEB-1672)"`. No tests or gates executed.

Fund merger lineage: API1900–1901, WEB1900–1901 and OFFLINE1900 retain original HDFC announcement terms, exact independently reviewed AMFI-plan bindings, history and withdrawal across shared/app/offline. Migration119. Announced terms do not establish investor allocation/execution, a conversion ratio or continuous NAV returns; those unknowns remain explicit. Manual `pnpm sdlc "Validate fund merger lineage" -- --grep "E2E-(API|WEB|OFFLINE)-190[01]"`. No execution/commit.

SRC016 initial factsheet workflow: API1910–1912, WEB1910 and OFFLINE1910 cover retained original Kotak fund-size/base-expense data, exact two-plan sums, independent actual AMFI identity binding, source reconstruction, withdrawal and downloaded evidence admission. Migration120. Base expense ratios explicitly exclude brokerage/transaction costs; they are not total expenses or performance forecasts. User applies migrations and runs `pnpm sdlc "Validate AMC factsheet review" -- --grep "E2E-(API|WEB|OFFLINE)-191[0-2]"`. Authored, not executed.

DEV011/RESEARCHAUTO002 original-scope audit closes initial implementation: durable reports/retries, scheduled evidence, reviewed publishing policies, selected verified calendars and original GDP/CPI vintages are authored. Worldwide archive coverage was not an initial acceptance prerequisite. Activation and saved validation remain pending.

## Current source-completion handoff — 2026-09-15

The latest current summaries supersede earlier scope gaps in this historical log: banking/general-insurance/life-insurance statements,25-company financial cohort, GDP archive recovery, dated CPI expectations, exact reading calendars, fund-merger lineage, initial factsheets/pagination, rights/stock-swap terms, historical sovereign calculation, daily oil source and initial exact-ISIN ICRA ratings are now authored. Separate completed child rows expose their delivery in TODO. Manual validation, source activation and installed APK refresh remain pending. Original XBRL/index/BSE access, broker templates/partner authorization and actual evaluated-price/trading-liquidity feeds remain concrete gaps rather than invented implementations. See current-delivery.md and pickup-queue.md for the current active work.

Static root integration corrected named operator identity extraction in fund mergers, sovereign originals and corporate ratings to the actual `identity.id` contract. Their existing independent-review API/browser cases cover this path when the user runs them; no test result is inferred. Shared source controllers, body limits, migrations and offline snapshot handlers were connected. No gates or commit run; baseline remains `a2c53a0`.
