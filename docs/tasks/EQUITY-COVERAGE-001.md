# EQUITY-COVERAGE-001 — Indian equity reference, prices, actions, fundamentals and sectors

- **Status:** Partial
- **Implemented / recorded:** NSE identities, Nifty50 constituents, retained UDiFF prices and paginated history, corporate-action CSV, IndAS/banking/general-insurance/life-insurance results, reviewed split/bonus/dividend normalization and pure-consolidation identity bridges are authored across API, Operations, reader and offline workflows. Validation is pending.
- **Pending:** BSE security/price access and dual-source reconciliation, additional financial/XBRL formats, rights/merger/demerger accounting, broader index history and permitted automatic acquisition. These gaps are separate from user-run validation.
- **Next action / inputs:** Developer: verify remaining exchange formats and usage rights; implement missing ingestion.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

See [current delivery summary](current-delivery.md) for the batch-wide distinction between code, missing functionality and validation.

2026-09-15: [SRC-003](SRC-003.md) adds a reviewed pure-consolidation security bridge, preserving old/new ISINs, distinct suspension/resumption dates, original notices and a nominal price comparison. Migration110 and API1780–1783/WEB1780/OFFLINE1780 are authored. The bridge cannot qualify a suspended interval as daily returns or change holdings. Other complex actions and automatic original-notice acquisition remain gaps; this child does not complete all equity coverage. [Spec and source research](../development/equity-consolidation.md).

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### EQUITY-COVERAGE-001 — Indian equity reference, prices, actions, fundamentals and sectors

- **Status:** Partial: five-family storage/review/public/offline workflow authored; automated NSE master/Nifty50 constituents plus official versioned UDiFF price ZIP parser/fetch. Corporate-action/fundamental parsers and broader historical coverage still pending. Verification not run; migration049 authored.
- **Scope:** Spec → shared web/app UI/UX → API/contracts → durable data/provenance → offline behavior → test cases → documentation. Record missing external access/format evidence explicitly; implement all independently possible layers.
- **Reusable prompt:** Deliver indian equity reference, prices, actions, fundamentals and sectors with real-source evidence, strict versioned data, complete navigation/recovery and authored API/browser/offline tests. Follow DELIVERY-TEAM-004 boundaries and provide precise integration notes.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on EQUITY-COVERAGE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Research-ready
- **User input needed now:** No for the independent next step.
- **Decision:** No user input needed for the next step: research primary documentation, record evidence and implement only verified source/domain behavior. Research-ready is not a claim that all inputs or permissions are already available.
- **Recorded answer / authority:** User: use free sources first and have the agent determine regulations, source usage and formats; do not ask the user to discover them.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** Before live redistribution/offline bundling, establish dataset-specific rights. Ask only for an actual agreement or paid decision that research cannot supply.
- **Next action:** Developer: verify remaining exchange formats and usage rights; implement missing ingestion.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

## Corporate-action CSV slice — 2026-09-15

Specification: accept the official NSE nine-column corporate-action download through the existing permission-confirmed Operations import, retain raw bytes, resolve exact symbol/series against published NSE identities as of the earlier of ex-date and capture date, reject missing/ambiguous joins, and store the joined identity edition/hash. Keep capture effective date separate from ex-date (future announced ex-dates are allowed); never infer cash/split ratios or adjust holdings from free text. Draft/review/withdrawal, company views and offline snapshots reuse migration049 and existing workflows. No new database table or package is required. API/browser/offline acceptance must cover strict source dates/layout, replay, identity provenance, source review and mobile/keyboard navigation. User runs all validation.

Research evidence: [official corporate-actions page](https://www.nseindia.com/companies-listing/corporate-filings-actions?symbol=TCS) exposes its CSV download; official search-indexed page headings list SYMBOL, COMPANY NAME, SERIES, PURPOSE, FACE VALUE, EX-DATE, RECORD DATE, BOOK CLOSURE START DATE and BOOK CLOSURE END DATE. The accessible page is a dynamic empty shell, so no real downloaded CSV or live numeric fixture is claimed verified. DD-MMM-YYYY is the explicitly supported parser version; a differently formatted export rejects rather than guesses. [NSE terms](https://www.nseindia.com/static/nse-terms-of-use) remain a separate usage constraint; download visibility does not grant redistribution. No permission was accepted and no provider job ran.

Input record: no new question. Prior user instruction authorizes primary-source research and free-source priority. A deployment-specific permission basis and representative downloaded-file acceptance remain operator activation inputs; the agent does not invent either. Automatic corporate-action acquisition is still pending a verified supported endpoint and permitted use; this slice is a manual source-download parser, not automatic scraping.

Additional date evidence: the [official filings summary](https://www.nseindia.com/companies-listing/corporate-filings-application?id=allAnnouncements) presents corporate-action ex-dates as `11-Sep-2026`, supporting the DD-MMM-YYYY reader. No figures from that page were copied into test fixtures. Public search did not yield an official supported API contract for automatic corporate-action acquisition; third-party cookie/session scraping examples are not an official integration contract and were not used.

Implementation authored: `equity-actions.ts` strict nine-column parser and source metadata; published identity join/provenance and immutable replay in the existing API; dedicated source selection/instructions in Operations; date detail in shared web/Android company view; existing Mongo/PostgreSQL snapshot pipeline reuse. Migration not applicable: JSONB records already carry this family; no new package dependency. Fixtures are explicitly synthetic; they do not claim real export validation.

Verification pending (not run): contract golden/rejection cases; E2E-API-904/905, E2E-WEB-904 desktop/mobile, E2E-OFFLINE-904 local handler. UI source selection/file upload and rebuilt physical Android acceptance also remain manual. Services for connected cases: PostgreSQL/MongoDB, migrated API and web; use printed dev URL → #equities and Operations → Indian equity data. User command: `pnpm sdlc "Add NSE corporate-action CSV ingestion" -- --grep 'EQUITY-COVERAGE-001'`. Failure evidence: exact test ID/project, run directory, status/error body, source/parser version (no private documents/credentials). No format/check/build/E2E/provider call/migration/commit was run by this agent.

Remaining functional gaps: automatic corporate-action acquisition, fundamental source parsers, price-adjustment/accounting policies, broader exchange/sector history and backfill. Rights and real-download acceptance remain distinct from this authored parser implementation. Parent remains Partial; next pickup can research fundamentals without waiting for these manual validation gates.

## Next-source research: financial statements — 2026-09-15

The next concrete parser target is **NSE Integrated Filing — Financial — Ind AS**, rather than an invented generic financial CSV. The [official XBRL information page](https://www.nseindia.com/static/companies-listing/xbrl-information) publishes separate formats/taxonomies for Ind AS, other-than-banks, REIT/InvIT, general/life insurance, banks and NBFCs. These are not interchangeable. The Ind AS integrated-filing taxonomy is linked at `https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Taxonomy%20Integrated%20filing%20finance%20%28IndAS%29.zip`; its current utility is linked at `https://nsearchives.nseindia.com//web/mediaattachment/2026-07/Integrated_Filing_Finance_Ind_AS_20260706165729.zip`.

An [official rendered PANACHE filing](https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_154496_30042026011808_iXBRL_WEB.html) confirms explicit ISIN, presentation currency, rounding scale, standalone/consolidated and audited flags, separate quarterly/year-to-date periods and distinct total-profit versus owners-of-parent profit rows. This rules out guessing that every profit row is PAT or that every financial value is rupees. No source financial numbers were copied into fixtures.

Exact format gap: the web reader cannot decode the linked ZIP (`Unsupported content-type: application/zip`); a bounded direct read-only download of the official taxonomy timed out. The accessible rendered report establishes semantic labels but not a verified XML namespace/tag/context/unit mapping. Therefore no XBRL parser was falsely declared implemented. Next research action: retrieve that public taxonomy archive and a matching actual instance file, freeze its namespace and context/unit handling, then implement fail-closed Ind AS revenue/total period profit/assets/equity/EPS mapping with exact-scale golden cases. Bank/NBFC/insurance versions remain separate follow-ups. No private user input is needed now; this is an agent-owned public format retrieval gap, not a request for the user to research financial reporting.

Static-review correction: historical corporate actions resolve identities as of their ex-date, capped at the capture date for future announcements. A later reused symbol cannot retarget an older action. Missing historical identity rejects; synthetic golden cases cover the regression. Direct row parser also checks exact column count.

### Fundamental slice specification — supersedes initial retrieval gap

Alternative official downloads succeeded using a clearly identified documentation-research user agent. The linked legacy Ind AS taxonomy ZIP has SHA256 `2760bdcda96c4ed472add9559a7001c215cd2a8aad9cb0db195f69af791c45af`; its actual namespace is `http://www.bseindia.com/xbrl/fin/2020-03-31/in-bse-fin`. A representative official rendered Integrated Ind AS report was also read as HTML. Taxonomy access is no longer a blocker; complete XBRL instance-context handling is a separate remaining implementation.

The independently complete first fundamental slice parses **the official rendered Integrated Ind AS HTML**, using its general-information table and first financial-results table. Extract every reporting column's revenue from operations and total profit/loss for the period, preserving exact monetary scale, ISIN, period, audited/unaudited and consolidated/standalone. Reject duplicate/missing required rows, altered widths, invalid dates/decimals, non-INR, unsupported scaling, active markup and future periods. Do not confuse owners-of-parent profit with total period profit. Reuse raw retention, publication, company display and offline snapshot. No new migration/dependency; source-specific API validation plus an Operations HTML option are required. Tests use a synthetic minimal representation of the observed layout, never copied real financial figures.

Fundamental implementation authored: `equity-fundamentals.ts` reads actual observed Integrated Ind AS HTML table structure, extracts revenue/total period profit per reporting column, preserves exact signs/scale and rejects unsafe/ambiguous layouts. API restricts source URL to the official rendered-report path; Operations accepts HTML with an explicit original URL, and shared reader/offline models reuse existing tables and views. Schema first then adapter/API/UI and synthetic fixture cases were authored. E2E-API-906, E2E-WEB-906 desktop/mobile, E2E-OFFLINE-906 and contract golden/rejection tests are pending user-run validation. Existing manual command remains `pnpm sdlc "Add Indian equity source parsers" -- --grep 'EQUITY-COVERAGE-001'`; require DB/API/web for connected cases and a rebuilt offline package for app acceptance.

Current implemented-versus-pending clarification: corporate-action CSV and **two fundamental metrics from rendered Ind AS HTML** are authored end to end through retained review/publication/snapshots. This does not complete all fundamental parsers: direct XBRL, assets/equity/debt/EPS, other reporting taxonomies, automatic acquisitions and adjusted/history coverage remain. No questions for the user are needed to continue independent source research. Initial taxonomy-download failure above is historical and was recovered, not an active blocker.

## Adjusted-window specification — 2026-09-15

Implement a separate immutable, independently reviewed adjustment-window receipt. Preserve raw closes with `adjusted:false`; never mutate them. The receipt binds exact admitted NSE prices, identities, source hashes, complete selected-window corporate-action CSV and preparer/reviewer coverage attestation. Empty action windows require an explicit header-only original export and independent completeness review; missing source is not no-action evidence. Stable identity/symbol coverage, duplicate prices/actions, unknown purpose, multiple same-day actions, missing dividend previous-close reference or withdrawn source invalidate qualification.

Official evidence: [NSE action listing](https://www.nseindia.com/companies-listing/corporate-filings-actions?symbol=KOTAKBANK&tabIndex=equity) documents exact split face-value wording and bonus A:B; [NSE educational corporate-action methodology](https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Corporate_Action_Dividends_Bonus_splits_etc.pdf), pages10–12, defines bonus shares, face-value split and cash dividend price effects. Parse only anchored verified purpose grammars, preserve the exact purpose and rational numerator/denominator. Cash-dividend backward normalization uses the exact last admitted pre-ex-date close and is labelled a versioned research normalization, not an exchange-produced adjusted series, reinvested total return or causal model. Dataset display/retention permissions remain source-specific.

Acceptance: no price accounting through binary floats; immutable rational factors and decimal normalized closes; raw-vs-normalized UI, evidence and coverage-window navigation, review/withdrawal and source readmission, actual calibration receipt linkage, shared offline receipts, authored API/browser/offline1340–1349. No deterministic execution or production permission claims.

## Reviewed adjustment windows — 2026-09-15 implementation

Separate adjustment receipts now bind exact admitted company prices/identities/actions and an original company-filtered NSE CSV covering explicit first/last trading dates. Preparation records source coverage and permission evidence; an independent named publisher confirms coverage before admission. A valid header-only export can represent an independently checked no-action window; missing data cannot. Underlying source withdrawal/changed bindings invalidate the public/offline adjustment view and prevent new calibration receipts from using it.

The versioned parser accepts the source-confirmed anchored bonus, face-value subdivision and simple cash-dividend purpose forms only. See also [NSE Hindalco action grammar](https://www.nseindia.com/companies-listing/corporate-filings-actions?symbol=HINDALCO) and [NSE TCS interim-dividend grammar](https://www.nseindia.com/companies-listing/corporate-filings-actions?symbol=TCS). Mixed purposes, rights, mergers, unverified forms and multiple same-day actions are rejected. Missing close endpoints/ex-date quotes, ambiguous identities/closes and price gaps over seven days reject preparation. Source-window completeness is explicitly a recorded independent review, not inferred automatically from a sparse price series.

Bonus/split factors and backward cash-dividend normalization use positive reduced integer rationals. Cash dividends use the exact last retained pre-ex-date close. Displayed normalized prices round half-up to12decimal places; raw closes remain exact and `adjusted:false`. This is research normalization, not a vendor-adjusted series, tax calculation or reinvested total return. The normalized source window can now feed the actual private FX/company OLS diagnostic and be retained in its encrypted reconstruction receipt. Other statistical sample/freshness/conflict requirements still apply; empirical co-movement never becomes a causal portfolio forecast.

Migration076 stores immutable coverage inputs, source-bound receipts and independent publication/withdrawal reviews; MongoDB retains the complete original input. Operations → Price normalization supplies company/window/file/coverage/rights and review forms. Company details show factor evidence and raw-versus-normalized closes; saved calibrations show the exact receipt used. Shared offline snapshots reject changed source bindings and prohibit source review writes.

Authored tests: API1340 actual retained bonus normalization/replay/withdrawal;1341 source withdrawal readmission;1342 split/dividend rational outcomes and unsupported purposes;1343 actual private calibration persistence with admission and withdrawal; WEB1340 company factor/price comparison; OFFLINE1340 exact binding preservation/rejection. No deterministic execution. Manual command: `pnpm sdlc "Add reviewed corporate action normalization windows" -- --grep "E2E-(API|WEB|OFFLINE)-134[0-9]"`, after the documented migration076/DB/dev prerequisites. Physical Android acceptance requires the normal manual app rebuild. Report selected project/case and saved run artifacts for any failure. No dependency added, no local commit before user-run gates.

Remaining parent scope: automatic action acquisition, broader action grammars/complex events, remaining financial fields/XBRL metrics and broader historical backfill are not completed by this normalization workflow. Actual source permissions and manual validation remain explicit gates.

### Expanded financial statements — 2026-09-15

NSE rendered IndAS parser v2 now authors reported balance-sheet and indirect cash-flow totals with exact aggregate equations, original unit/period/basis, named independent review, retained-original reparse, web/app reader and offline reconstruction. See [SRC-005](SRC-005.md) for full scope,1510–1511 cases and manual next actions. This removes the balance-sheet/cash-flow-total authoring gap only; broad source coverage and real 25-company validation are not declared complete. No deterministic execution or commit.

## Saved full-inventory repair — 2026-09-19

The saved full run1789752953639-97020 includes failed cases tagged to this task. Confirmed causes, scoped authored repairs and remaining verification are recorded in [the full-audit RCA](../development/full-audit-2026-09-19.md). User runs `SDLC_AUTO_REPAIR=0 pnpm sdlc "Repair full audit failures" --story SDLC-REPAIR-016`. No new passing evidence or automatic bug resolution is claimed; this bounded repair does not remove broader source/device/functional requirements recorded above.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789836492361-20464.
<!-- sdlc-validation:end -->
