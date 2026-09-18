# FUNDS-BONDS-001 — Indian mutual funds, bonds, XIRR and deposit comparisons

- **Status:** Partial
- **Implemented / recorded:** Current and historical AMFI NAV ingestion/review; July/August SBI Contra and February2026 Axis NIFTY50 ETF original disclosures with exact retained AMFI mapping and reconciliation; CCIL indicative government-yield history; shared reader/offline display and private cash-flow/accrual/XIRR/duration/deposit calculations are authored. See SRC015–SRC017 for current source-specific scope. Initial Kotak fee/fund-size factsheets, CCIL source-reported curve history, matched sovereign settlement and exact historical ICRA credit attachment to encrypted saved comparisons are also authored. The API1982 exact-row receipt-integrity repair is authored and awaits its scoped retry.
- **Pending:** Actual evaluated-price and secondary-market trading-liquidity source evidence; verified conventions for any wider curve valuation/cashflow use. Manual validation, permitted source activation and physical-device acceptance remain separate. Broader issuer/agency/AMC coverage is expansion, not evidence that these authored initial workflows are missing.
- **Next action / inputs:** Developer researches remaining credit/liquidity and current source quotation linkage; no repeated request for already-verified SBI/Axis workbooks. Operator records applicable source rights; user validates existing source-specific cases and device behavior.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

See [current delivery summary](current-delivery.md) for the batch-wide distinction between code, missing functionality and validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### FUNDS-BONDS-001 — Indian mutual funds, bonds, XIRR and deposit comparisons

- **Status:** Partial: permission-gated AMFI NAV workflow and owned cash-flow/accrual/XIRR/duration/deposit comparisons authored; source activation, AMC look-through and bond quotes/ratings pending. Verification not run; migration055 authored.
- **Scope:** Spec → shared web/app UI/UX → API/contracts → durable data/provenance → offline behavior → test cases → documentation. Record missing external access/format evidence explicitly; implement all independently possible layers.
- **Reusable prompt:** Deliver indian mutual funds, bonds, xirr and deposit comparisons with real-source evidence, strict versioned data, complete navigation/recovery and authored API/browser/offline tests. Follow DELIVERY-TEAM-004 boundaries and provide precise integration notes.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on FUNDS-BONDS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Research-ready
- **User input needed now:** No for the independent next step.
- **Decision:** No user input needed for the next step: research primary documentation, record evidence and implement only verified source/domain behavior. Research-ready is not a claim that all inputs or permissions are already available.
- **Recorded answer / authority:** User: use free sources first and have the agent determine regulations, source usage and formats; do not ask the user to discover them.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** Before live redistribution/offline bundling, establish dataset-specific rights. Ask only for an actual agreement or paid decision that research cannot supply.
- **Next action:** Developer: verify source terms and add holdings/bond feeds. Operator: activate only permitted sources.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

## Current AMFI format transition — specification, 2026-09-15

Primary research found a concrete ingestion gap: the [official NAV download page](https://www.amfiindia.com/net-asset-value/nav-download) now links current `NAVAll.txt` with eight columns including Plan and Option; the former six-column report is `Original_NAVAll.txt`, and AMFI states the old download lasts only until 30 September 2026. The existing six-column-only parser would reject the current report. [Current source](https://portal.amfiindia.com/spages/NAVAll.txt) and [legacy source](https://portal.amfiindia.com/spages/Original_NAVAll.txt) were inspected read-only, not imported or published.

Acceptance: explicitly version both headers; current rows preserve plan/option exactly, including missing plan as unknown; old editions remain readable; capture records exact parser/source provenance, raw document and ordinary review; source UI explains transition; reader and Android/offline distinguish similarly named plan/options. No guessing plan from names, unknown headers/column shifts reject. Reuse existing JSONB schema and snapshot pipeline, no migration. Add contract and API/browser/offline cases without executing them.

Input: no new question; user has already requested free-source-first research. Written AMFI permission remains the existing deployment activation gate, not grounds to skip parser implementation. No permission has been accepted; no source job ran.

Implementation authored: exact six/eight-column header detection and edition parser/source version; optional plan/option preserving backward-compatible old records; current NAV fetch uses the supported NAVAll endpoint; connected/offline search and reader detail distinguish plan/option. Existing raw Mongo + PostgreSQL edition/review + package snapshot paths reused. No new DB migration/package.

Cases authored, not executed: E2E-API-1084, E2E-WEB-1084 desktop/mobile, E2E-OFFLINE-1084, plus unit golden/rejection coverage. Manual command: `pnpm sdlc "Support current AMFI NAV plan and option format" -- --grep 'FUNDS-BONDS-001'`. Connected cases require configured DBs/API/web; visit printed dev URL → #funds-bonds. Physical Android requires rebuilt/reinstalled package and current permitted snapshot. Report failed ID/project, run artifact and redacted response details. No format/check/test/build/migration/provider ingestion/commit ran.

Remaining: permission/live-source acceptance, historical acquisition, fund look-through, bond quotes/ratings and broader accounting conventions. This source compatibility slice does not close the parent. No new user answer needed for independent next research.

## Look-through and bond-feed source pickup — 2026-09-15

Primary source research and a concrete implementation specification are recorded in [fund look-through source research](../development/fund-lookthrough-source-research.md). PPFAS, Groww and HDFC current monthly original XLSX links were located, but their workbook bytes could not be read through available access: direct requests returned HTTP 403; the browser download exposed no local artifact. Source headers, identity mappings and reconciliation rules therefore remain unverified, and no guessed provider parser was added. CCIL clean-price methodology was verified, but its exact bond feed layout, credit source and redistribution rights remain missing.

The three AMC disclaimers require written permission for public/commercial reuse. The user already authorized independent source research; no repeat general permission question is needed. A concrete existing dataset agreement and readable original file are the later input triggers. No user answer has been received for those inputs. The parent remains Partial, with source activation separate from authoring and validation.

No test, format, check, build, migration, service, ingestion, commit or push was run. This pickup added research/specification only, so it uses the manual acceptance checklist in the research note and creates no artificial passing E2E case. Manual next action for the documentation gates: `pnpm sdlc "Record verified fund and bond source access gaps" --checks-only`. Existing product validation remains `pnpm e2e:run --grep 'FUNDS-BONDS-001'` with configured DB/API/web and the printed development URL → #funds-bonds. Report the failing case/project and saved run artifact; physical Android acceptance remains separate.

## Source-input update — 2026-09-15

Root research retrieved and inspected an original SBI Contra monthly workbook from the official portfolio browser page. [Verified layout, hash, precision and source inconsistency](../development/fund-lookthrough-source-research.md#sbi-original-workbook-access-resolved--2026-09-15). The generic “no readable workbook” blocker is resolved for this initial provider. Independent strict parser/capture/review/mapping and shared reader work is active; other AMC layouts and publication rights remain separate. No test, application ingestion or provider activation was run.

## SBI Contra look-through specification — 2026-09-15

Implement the verified original SBI Contra August2026 XLSX as a bounded versioned adapter, not a guessed universal AMC parser. Enforce workbook/scheme/date/header/section layout and displayed decimal precision; retain exact raw bytes privately in Mongo and hash/parsed receipt in PostgreSQL. Inert artwork/printer/external-link metadata may be retained but never executed, followed or rendered. Cash AUM and derivatives remain separate. Validate section amount sums and AUM within stated source rounding tolerance; preserve reported weights and flag material weight inconsistencies. Quarantine all parse failures; a reviewed limited-quality edition must keep warnings and cannot claim reliable complete exposure. AMFI code mapping requires a current admitted scheme observation plus independent reviewer confirmation; no fuzzy automatic plan binding. Publish/withdraw with named distinct review and immutable audit. Public reader and bundled app show disclosure lag, original source link, amount/weight differences, allocations and separate derivatives; no current holdings/credit/model inference. Tests1530–1539 authored, manual execution only. No new dependency needed (existing fflate/XML libraries in contracts).

## SBI portfolio disclosure implementation — 2026-09-15

Authored the original-source capture, bounded versioned XLSX parser, exact displayed precision, retained raw bytes, quarantine, independent AMFI identity mapping/review, connected fund reader and shared offline Android admission. Specification and complete layer/acceptance record: [SBI disclosure](../development/sbi-portfolio.md). Migration092, API1530–1532, WEB1530 and OFFLINE1530 are authored, not executed. Source discrepancy remains visible; no renormalized weights, automatic complete exposure or all-AMC coverage claim. Other months/layouts require representative primary evidence and separately versioned parsers. Actual deployment source permission and manual validation remain outstanding. Existing parent gaps are preserved.

Reusable next prompt: Read the SBI source research and specification, extend only a primary-source-verified additional scheme/month layout with synthetic representative fixtures, preserve immutable raw/version/review provenance and exact reconciliation, connect existing review/public/offline paths, author tests and update this tracker. Never infer permission or execute validation automatically.

## Verified SBI archive extension — 2026-09-15

The original July Contra workbook was obtained through its observed archive link and inspected. StructuralV2 now discovers variable section/row positions, validates selected original URL/date, preserves option premiums and small-weight markers, and independently reconciles cached source totals without executing formulas. Operations month selection, exact capture identity, shared reader/archive and offline schemas updated; oldV1 reconstruction retained. API1533–1534, WEB1531, OFFLINE1531 authored. [Complete evidence and specification](../development/sbi-portfolio.md#structural-archive-extension--2026-09-15). Other AMC/scheme layouts and actual deployment permission remain outstanding; no execution or verification claim.

## Original acceptance audit — 2026-09-15

DEV022 explicitly requests scheme/share-class identity, NAV/history/mergers, disclosed look-through lags, bond clean/dirty price/accrual/duration/credit/liquidity, exact XIRR and deposit alternatives. Initial AMFI identities/history, SBI/Axis disclosed portfolios and private comparison arithmetic are implemented. At the time of that audit, fund-merger lineage was missing; the implementation below supersedes that gap. `funds-bonds.ts` retains a user-supplied credit description and warns that market quotes/ratings and liquidity/default behavior are not supplied; CCIL bucket yields are not an identified bond quote. Bond source/credit/liquidity remain concrete parent gaps; the authored merger lineage closes the announced-lineage gap without claiming investor-specific conversion ratios. The original checklist does not demand every AMC/month/industry, and coverage expansion must not obscure which accepted functional layers are actually missing. No implementation status is inferred from source availability or code authoring. Documentation-only reconciliation; no gates/commit executed.

## Fund merger lineage specification — 2026-09-15

Retain the original9December2021 HDFC merger notice PDF and an explicit bounded human extraction for the three named merging schemes, their distinct14/20January2022 close-of-business effective dates and Large and Mid Cap destination. The source supplies no AMFI plan codes or actual conversion ratio. Independent named review must choose exact retained published old/new AMFI observations and confirm the original, plan identity and absent ratio. Keep source hash, unknown upload retrieval time, capture time, effective-day/close precision and review history. Do not rewrite holdings, combine NAV series, assert tax treatment or interpret the separate segregated-portfolio illustration as merger units. Add paginated Ops capture/review/withdraw/source download, public plan-linked history, shared web/app reader and downloaded current admission. No new provider credentials; per-capture permission evidence is required. Existing source raw store plus migration119 editions/reviews; public snapshots exclude permission evidence.

## Merger original research and delivery — 2026-09-15

Primary source: [HDFC9December2021 notice](https://files.hdfcfund.com/s3fs-public/2021-12/1859%20-%20Notice-cum-Addendum%20-%20Scheme%20Merger%20Proposal.pdf). The original one-page notice announces Long Term Advantage and EOF1126D May2017 into Large and Mid Cap at14January2022 close, and EOF1100D June2017 at20January2022 close. It contains a separate illustrative segregated-portfolio unit example; that is not a merger ratio. No plan-code allocation or actual investor execution confirmation is established. HDFC source access is not a redistribution licence; permission evidence remains required. Review original terms, not copied article summaries. No broker/customer records or full copyrighted PDF were committed.

Implemented bounded announced-merger lineage: strict fixed-notice terms and exact date/precision validation, original PDF envelope/quarantine/hash retention with upload retrieval time honestly unknown, paginated private Operations queue and source download, independent named review with distinct old/new published AMFI observations, immutable notice/review history and replay identity. Historical names bind exact retained AMFI originals rather than requiring the latest renamed display name. Public read/snapshot re-admits each bound NAV edition; withdrawal of either invalidates current lineage. Shared web/Android reader shows plan codes, known/unknown implications, source/provenance and empty/error/reload/pagination. Operations accepts actual original uploads and clearly separates manual extraction from PDF interpretation. Offline reads only downloaded, exact admitted NAV bindings; Operations remains denied. Holdings, tax calculations, units and NAV histories are never rewritten or joined as continuous returns.

Code: `fund-mergers.ts` contracts/API/offline helper, `FundMergers.tsx`, migration119. Root wires existing fund detail/Operations and snapshot production. No dependency changes or provider jobs. Cases API1900 independent plan mapping/public read/NAV withdrawal; API1901 quarantine/replay mismatch; WEB1900 actual selected fund reader; WEB1901 actual upload form and pending independent review; OFFLINE1900 exact downloaded identity admission, absent-source redaction and no local mutation. Synthetic minimal PDF envelopes exercise workflow without claiming actual legal source or provider parser validation. None executed.

Manual next actions: existing PostgreSQL/MongoDB/API/web, user `pnpm db:migrate` for119; then `pnpm sdlc "Add retained fund merger lineage" --grep 'E2E-(API|WEB|OFFLINE)-190[01]'`. Open printed web URL→Operations→Fund mergers; import only permitted original, sign in separately to review exact historical AMFI plan captures. Investor route `#funds-bonds`→selected plan shows lineage after review. Rebuild/snapshot Android manually for offline testing. Expected no automatic unit, cashflow or NAV-series conversion; missing/withdrawn identities remove public admission. Report failed ID/project and saved artifact/error context. No format/check/build/tests/migrations/services/ingestion/commit ran; HEAD `a2c53a0`, shared changes remain awaiting manual gates. Bond quotes/security terms/credit/liquidity remain parent requirements; broader merger originals and actual account allocation need their own verified evidence.

Sovereign source-pack implementation: see [SRC-017](SRC-017.md), migration121, cases1920–1921. This closes the initial source-backed historical clean/accrued/dirty illustration, not corporate rating/liquidity or current secondary-market coverage.

Initial corporate credit source: [SRC-018](SRC-018.md) retains the exact licensed ICRA original and distinguishes agency withdrawal from editorial withdrawal. No trading liquidity or current price is inferred.

## Saved bond source-evidence specification — 2026-09-15

Optional explicit ISIN and exact published corporate-rating edition attachment to the existing bond comparison. Preserve input reference and immutable output policy/source projection inside the already-encrypted private receipt; no new plaintext table or migration. Source must be independently published, exact known hash, same selected ISIN, not agency-withdrawn and applicable to the explicit historical settlement assessment date: publication through90days inclusive and before instrument maturity. This conservative90day internal admission rule is not an agency surveillance promise. Historical settlement cannot imply current credit status; May evidence may be used for May illustration, not September current credit claims. Pure preview, connected save and offline save use one shared policy. New saves fail closed on missing/unpublished/stale/withdrawn evidence; existing idempotent receipts reconstruct/export their historical capture after later withdrawal, without being re-used as fresh source admission. No invented cashflows or coupons: user-supplied settlement/cashflows remain distinct and source selection does not populate them automatically. Price basis is user-entered estimate, evaluated quote unavailable, trading liquidity unknown, default/suitability unmodelled, no recommendation. UI selects exact evidence, shows errors/reload and saved capture, retains original input on reload, and does not require source attachment for explicit assumption-only comparisons. API/browser/offline cases1980 onward; deterministic execution manual.

### Saved credit evidence implementation handoff

Optional exact credit reference and versioned policy are now saved inside existing encrypted bond receipts (079 storage reused, no127 migration). API re-admits selected editorial source under a review lock; common policy rejects missing/agency-withdrawn/expired-window evidence. Input settlement date is explicit historical assessment, not current rating claim. Existing immutable receipt replay/list/privacy export remains reconstructible after source withdrawal; fresh IDs cannot reuse withdrawn source. Shared form supports paginated source choices, retry, preview and saved provenance; offline handler uses the downloaded exact published version, preserving native local-storage protection and existing export/deletion. General cashflow/accrual method is not silently replaced by source coupon terms.

Authored API1980 encrypted receipt/export/withdrawal/replay/deletion; API1981 agency withdrawal and stale assessment; WEB1980 real source selector/preview/save/reload; OFFLINE1980 downloaded admission/withdrawal/historical export/deletion. User inputs in these calculations are explicitly illustrative; ICRA original is genuine and attributed. No new dependencies/migration. Manual prerequisites: existing services, migration125 already applied; run `pnpm sdlc "Attach historical credit evidence to bond receipts" -- --grep "E2E-(API|WEB|OFFLINE)-198[01]"`; printed webURL `/#funds-bonds` → Bond & deposit comparison. Expected saved evidence contains exact edition/hash/ISIN and distinguishes user price from verified historical agency opinion; report runID/project/case/errorcontext. No gates/tests/commit executed; HEADa2c53a0 and shared working tree remain awaiting manual gates.

## API1982 exact rating-row repair — 2026-09-18

The supplied user-run API1982 failure showed that the receipt schema accepted a hybrid observation: each field satisfied its enum or date shape, but a selected ISIN could be paired with another canonical instrument's coupon or an invented valid maturity. Source hash/version and input-reference checks did not establish that the complete saved observation was the verified row.

`BondEvidencePolicySchema` now requires an attached observation to equal the complete canonical source row selected by ISIN. This applies at shared contract boundaries used by connected saves/replay, exports, browser parsing and offline storage; valid historical receipts still parse after editorial withdrawal because validation remains against their retained versioned facts, not current publication state. The focused contract regression accepts the genuine row and rejects a canonical-shaped cross-instrument coupon hybrid. Existing API1982 additionally covers altered maturity, source facts and missing input reference. No API route, database schema, migration, dependency, UI or source activation changed.

Authored only: formatting, checks, builds and tests were not run. With the existing dependencies and no services required for this contract-only API case, the smallest exact retry is `pnpm e2e:run tests/e2e/cases/api/bond-evidence.spec.ts --project=api --grep 'E2E-API-1982 saved receipt contract rejects altered source facts and unreferenced opinions while preserving historical originals @FUNDS-BONDS-001$'`. Expected: the valid retained receipt parses, every altered receipt throws, and the case passes. On failure report the case/project, assertion, run ID and saved report path. BUG-e3878578217ee412 remains Open until user-run passing evidence is reconciled. Current price and trading-liquidity source gaps, broader source activation and physical-device acceptance remain unchanged.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789669163056-59061.
<!-- sdlc-validation:end -->
