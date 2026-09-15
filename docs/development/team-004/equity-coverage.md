# EQUITY-COVERAGE-001 handoff

Implementation: bounded evidence workflow authored; broad Indian-equity coverage remains partial. No tests, builds, formatting, typechecks, migrations, source ingestion, service operations, commits or pushes were run. HEAD inspected during authoring: `efd28d3` (`Add scoped failure repair`). Other team changes are present and preserved; this work awaits user gates.

## Integration

- Export `./equity-coverage.js` from contracts index.
- Register `EquityCoverageController`, `OpsEquityCoverageController`, `equityCoverageProvider(config)` in the API app module.
- Register additive `049_equity_coverage.sql` in migrations and the isolated API fixture migration list.
- Register `EquityCoverage` at `#equities` with More link. Register `EquityCoverageOperations` in Operations with `{ request, onDenied }` or default optional props.
- Keep 3 MB JSON parsing scoped to `/api/v1/ops/equities/import`; request body source limit is 2 MB.
- Register offline `handleEquityCoverage`, `OfflineBundle.equityCoverage?: unknown`; snapshot builder obtains `GET /equities/snapshot` and stores its complete validated `EquitySnapshotSchema` result. An absent snapshot returns honest empty coverage.
- `equityCompanyForTrace(pgClient, isin)` is exported for actual same-transaction impact evidence; its result is `EquityCompanySchema` or404. Consumers must re-admit on later reads, retain edition references and respect `truncated`. They must not infer missing financial values.

## Test inventory for root catalogue

| IDs                 | Authored behavior                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E-API-900         | Real isolated five-family normalized ingestion, Mongo receipt, public exact values, identical replay, conflicting request ID, atomic snapshot and withdrawal.          |
| E2E-API-901         | Unauthenticated/missing-rights/malformed source refusal; no public data fabricated.                                                                                    |
| E2E-WEB-900         | Actual API-backed company list/detail, five families, evidence, Escape and mobile layout.                                                                              |
| E2E-WEB-901         | Empty search and retryable absence, no mock source cards.                                                                                                              |
| E2E-OFFLINE-900     | Packaged snapshot endpoint/reader, zero API network.                                                                                                                   |
| Four contract tests | Explicitly synthetic fixture preserves money scale/large volume; duplicates/unknown fields/period boundaries rejected; NSE header drift; Nifty weights remain unknown. |

Synthetic fixtures use an actual valid ISIN solely as a key, with visibly synthetic company names and values. They must never be ingested into the normal application as market facts. E2E helpers have no import/discovery side effects; only user-selected execution provisions the existing isolated fixture.

## User-run acceptance

No dependency changes. PostgreSQL and MongoDB must be available; apply the additive migration with `pnpm db:migrate`, then run/restart the app using the existing `pnpm dev` command and its printed URL. Open `/#equities` and Operations → Equity coverage. Use actual permitted source files; do not upload broker/private holdings to this public source workflow.

Run `pnpm sdlc "Add reviewed equity evidence coverage" -- --grep EQUITY-COVERAGE-001` for API, desktop and mobile configured projects. For device acceptance: `pnpm android:snapshot`, `pnpm android:web`, then `pnpm android:test -- --grep EQUITY-COVERAGE-001`; generate the installable APK using `pnpm android:build` and reinstall it. These are manual user commands, not agent execution. The user command owns format/check, gated local commit and selected E2E. Review aggregate working-tree scope first: the script stages other nonignored team changes as well. For only gating/commit use `pnpm sdlc "Add reviewed equity evidence coverage" --checks-only`.

Expected: supplied actual sources produce a private draft, inspection matches retained text, permitted review makes exact evidence visible, withdrawal removes it from connected reads and new snapshots, and the Android package shows only its dated snapshot. Report the failed case ID/project and saved error-context/report path; do not rerun the full suite automatically.

## Pending source acceptance and limits

See `docs/product/equity-coverage.md` for official research links and exact per-family gaps. Only NSE securities and Nifty50 constituent fixed CSV adapters are authored. Price, action and fundamental ingestion use an explicit normalized evidence format; actual UDiFF/corporate-action/iXBRL parsers and broad historical/bitemporal coverage remain pending. BSE integration, constituent removals/history/weights, original filing extraction and automatic corporate-action adjustments are not implemented. Source permission is recorded from an operator attestation and must be verified for deployment. This child cannot mark SRC001–006 or the full parent complete.

### UDiFF extension

Authored the official schema20260630 price parser and fixed dated ZIP fetch, archive/CSV retention, CRC/size/header/date/OHLC/identity checks, excluded-scope row counts, Operations source picker/import/fetch, searchable price-only companies and OHLC details. New `equity-udiff.ts` contracts export through `equity-coverage.ts`; API helper `equity-udiff-archive.ts` needs no provider registration or dependency. Existing JSONB migration049 accommodates the additional versioned metadata. No shared root integration changes required. API902 and WEB902 plus synthetic parser and archive unit cases added; root CATALOG/coverage tracker should include them.

Source-internal ISIN/symbol/instrument reconciliation is implemented. Historical master crosswalk, BSE prices, actions/fundamentals source-specific parsers and unattended backfills remain separate gaps. No tested/production-complete claim. No commands, migrations, provider app ingestion or commits were run. User next actions: `pnpm db:migrate` if049 unapplied, `pnpm dev`, then `pnpm sdlc "Add reviewed NSE UDiFF prices" -- --grep EQUITY-COVERAGE-001` (API/desktop/mobile). For Android rebuild: `pnpm android:snapshot`, `pnpm android:web`, `pnpm android:test -- --grep EQUITY-COVERAGE-001`, `pnpm android:build`; reinstall APK. Report failure run ID, case ID and saved report path. Existing HEAD when last inspected: `efd28d3`; all changes await user-run gates.
