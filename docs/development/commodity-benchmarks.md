# Reviewed monthly commodity benchmarks

Implementation authored, not executed or activated. Gold, silver and copper extend the existing World Bank monthly oil and ECB daily-reference FX implementations. These are global monthly nominal-US-dollar benchmarks, not EOD quotes, tradable prices or Indian retail bullion prices. No monthly-to-daily interpolation or automatic INR conversion is introduced.

## Primary source evidence

The fixed [World Bank historical monthly workbook](https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx) was downloaded for read-only format research on2026-09-15. Its original SHA256 is `9fdcfa8a2aed9a1bb545a10c1a5ce036c6a0acd4766f450424ca800b4b5a0225`; reported update September02 2026. The visible Monthly Prices sheet identifies Copper/BM in USD per metric ton, Gold/BR and Silver/BT in USD per troy ounce. Copper/gold use integer display; silver uses one decimal. Exact original lexical cells are retained, including binary-serialization tails; integer arithmetic reproduces the workbook display using half-away-from-zero rounding. Missing cells remain missing, never zero/interpolated. Grid begins January2000 and rejects duplicate/missing/incomplete periods.

The [dataset catalogue](https://datacatalog.worldbank.org/search/dataset/0038238/commodity-prices-history-and-projections) explicitly lists CC BY4. [Dataset terms](https://www.worldbank.org/ext/en/legal/terms-conditions/datasets) require World Bank and known-provider attribution, no endorsement, and respect for any indicator-specific third-party exceptions. Independent publication review records applicable retention/display/offline evidence. This is not blanket approval of every provider source or EIA/LSEG daily series.

The committed `.xlsx` fixture is a reconstructed selected-cell workbook, **not the original provider file**. It copies only the selected exact factual series into minimal declared OOXML; unrelated source sheets/content are omitted. The paired `.provenance.json` records the original hash, retrieval research date, attribution and transformation. Tests label this source-layout reconstruction as simulation; expected August2026 values4411 (Gold),14326 (Copper) and65.4 (Silver) came from original inspected cells. No parser or E2E was executed during research. Production capture must retain the actual original with independent review, not this fixture.

## Workflow and data

Operations → Commodities allows a manually selected original XLSX or a user-triggered download from the fixed official URL. Record rights, then capture. PostgreSQL104 retains capture identity, immutable parsed receipts/quarantine, reviewer audit and a publication gate; MongoDB retains original bytes/hash/acquisition/rights. Upload retrieval time is unknown, distinct from server retention time; a provider download records actual retrieval time. Invalid layouts remain quarantined with original bytes. XML relationships/macros/formulas cannot execute, and selected hidden/formula cells fail closed. The generic selected-column reader preserves the existing oil wrapper's exact contract.

A different named approver must inspect the original, source precision/units and rights before publication. Reconstruction from retained original must match the stored receipt. Source current/read/evidence paths hold the same publication gate lock as reviews; withdrawal removes current access and does not silently fall back to older data. Operations queues page20 captures with an explicit older cursor, so old captures remain reachable. Reviewed original downloads validate identity and SHA256 before web/native export.

Reader `#commodities` shows source update/retention/review, explicit stale context after62 days, selected commodity/year, exact source cells and reviewed-edition selection. Downloaded snapshots include the reviewed structured receipt; original bytes and uninstalled editions remain visibly unavailable offline. Web changes reach Android/iOS through the existing user-run package/snapshot/rebuild process; installed apps do not update automatically. No server credentials reach React and no user holdings/goal model is changed.

## Manual acceptance

No new dependencies. User applies migration104, starts normal API/PostgreSQL/MongoDB/web and runs:

`pnpm sdlc "Validate monthly commodity coverage" -- --grep "E2E-(API-171[0-2]|WEB-1710|OFFLINE-1710)"`

API1710–1712 cover retained reconstructed-layout/exact-source fixtures, independent reviewer denial, history/receipt, withdrawal, quarantine and precision/unit/formula refusal. WEB1710 authors actual Ops upload/review→reader commodity/year transitions→withdrawal on desktop/mobile. OFFLINE1710 preserves typed monthly receipt and truthful missing-original/malformed-snapshot failures. Existing oil parser coverage should be included when the user deliberately validates the shared reader refactor. Keep watch mode off; report case ID and saved failure context. No tests, checks, builds, migration, service, source ingestion job or commit were run by the agent.

Remaining SRC009: actual source activation/current-file validation and external daily/EOD contributed-series rights. Source Description metadata identifies a Gold method change in June2025 (monthly spot-rate average replaces the earlier London-fixing basis); the reader explicitly displays that discontinuity and named per-series providers. Future independent reviews must recheck source definitions as well as headers and prices. Gold/silver/copper monthly data does not resolve those daily-source gates or imply complete commodity-universe coverage.

## Scheduled source capture

Source automation is authored through the existing Automatic research workflow: `commodity-benchmarks`, disabled by default, initial interval1440 minutes. Enabling requires recorded dataset/attribution/third-party evidence. The existing worker invokes the fixed original provider, then rechecks enabled state and unchanged rights before retaining a draft or quarantine. Identical original bytes reuse the prior source capture; raw and request-run history remain distinct. No automated publication policy applies: a different named reviewer must publish. Disabling prevents a fetch already in progress from committing a newly admitted capture once the changed setting is observed. No scheduler/service was started by the agent.

API1713 authors actual isolated database/Mongo capture with an explicitly injected reconstructed-file provider response (no external fetch), duplicate-byte reuse and pause-after-fetch denial. WEB1711 authors the actual configure/rights/enable/pause form with fixture workers disabled. API1714 covers equal-timestamp pagination and unknown cursor. Manual selected command now: `pnpm sdlc "Validate commodity onboarding" -- --grep "E2E-(API-171[0-4]|WEB-171[01]|OFFLINE-1710)"`.
