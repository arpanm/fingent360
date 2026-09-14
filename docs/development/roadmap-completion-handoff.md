# ROADMAP-COMPLETE-003 — ongoing end-to-end completion

This request covers remaining Partial/Planned roadmap acceptance. Work is implemented in the shared main checkout over b5cfcd0. The earlier REGRESSION-011 changes were already uncommitted at the start and are preserved. No agent ran formatting, lint/type checks, builds, tests, migrations, services, ingestion, APK generation or commits. Research of official export/source documentation is read-only. A completed implementation is not a test pass or production acceptance.

| Child                     | Current authored scope                                    | Layers and evidence                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GOAL-FEASIBILITY-001      | Implemented                                               | Exact user-entered downside capacity, actual goal-version receipt, immutable037 storage, ownership/replay/delete/privacy/local parity, guided review/history; API600–602, WEB600–601, OFFLINE600 and units         |
| MAPPED-IMPORT-001         | Implemented mapped flow and researched five-platform help | Explicit units/columns/source totals, duplicate consent, saved-baseline preview, actual confirmed replacement/replay/privacy/local parity; API610–613, WEB610–615, OFFLINE610–611 and units                        |
| EVIDENCE-LAYERS-001       | Implemented for admitted stored editions                  | Exact excerpts/offsets/dates, private research notes, source-version/withdrawal admission, current versus unknown analysis, keyboard reader/local parity; API620–623, WEB620–623, OFFLINE620–621 and units         |
| QUALITY-OVERVIEW-001      | Implemented                                               | Protected bounded actual-head summary, retrieval triage, request IDs/safe logs/process counters, connected-only device behavior, objectives/restore/rollback/evaluation plan; API630, WEB630, OFFLINE630 and units |
| NAMED-OPERATORS-001       | Implemented                                               | Named identity/version permissions, protected target inspection and independent material-publication approval; API640–644, WEB640–641 and contract/guard cases                                                     |
| MATERIAL-ALERTS-001       | Implemented                                               | Explicit annual threshold/baseline/coalescing policy, immutable source-bound receipts, privacy/local parity; API660–668, WEB660–665, OFFLINE660–662 and five units                                                 |
| ECB-RATES-001             | Implemented                                               | Fixed official three-series numerical history, immutable evidence/observations, independent review and withdrawal-retirement/local parity; API680–691, WEB680–684, OFFLINE680–681 and ten units                    |
| EVENT-REVIEW-001          | Implemented                                               | Exact source/entity bindings, immutable graph/review receipts, independent approval, public history and offline parity; API700–704, WEB700–701, OFFLINE700–701 and contract/snapshot cases                         |
| BROKER-DIALECTS-001       | Implemented fallback and research                         | Explicitly attested row costs, exact binding/totals, preview/receipt/privacy/local parity; API720–722, WEB720–725, OFFLINE720–722 and seven units. Named parser gates remain                                       |
| EIA-BENCHMARKS-001        | Implemented                                               | World Bank monthly Brent/WTI, exact source/display decimals, retained workbook, review/withdrawal/history and local parity; API740–751, WEB740–744, OFFLINE740–741 and11 units                                     |
| CONSENT-LIFECYCLE-001     | Implemented                                               | Four versioned purpose grants, post-wait private-record/dispatch and worker enforcement, complete history/export and local parity; API760–768, WEB760–764, OFFLINE760–762 and five units                           |
| MATERIAL-AUTO-001         | Implemented                                               | Explicit daily stored-observation checks, restart-safe due state, concurrent-worker admission, revocation and on-open offline parity; API790–792, WEB790, OFFLINE790–791 and reducer cases                         |
| ECB-FX-001                | Implemented                                               | Fixed ECB daily USD/EUR and INR/EUR, exact labelled cross-rate, immutable rolling windows/review/history/local parity; API810–822, WEB810–814, OFFLINE810–811 and16 units                                          |
| EVENT-LINEAGE-001         | Implemented                                               | Atomic reviewed merge/split with exact immutable inputs/outputs, named approval and public/local relationships; API830–835, WEB830–831, OFFLINE830–831 and nine units                                              |
| EVENT-EXTRACTION-001      | Implemented                                               | Exact retained-source candidates, optional excerpt selection, atomic standard draft/decision, retry/expiry guards; API850–862, WEB850–855, OFFLINE850–851 and11 units                                              |
| IDENTITY-ADJUDICATION-001 | Implemented                                               | Separate independently reviewed editorial candidate choice, unchanged provider truth and explicit event/offline binding; API870–875, WEB870–873, OFFLINE870–871 and four units                                     |

DEV009's stated contribution/horizon/risk-feasibility acceptance now has an explicit downside-capacity policy; subjective suitability and forecasts are not claimed. DEV008/SRC013 still need exact named broker export formats; official help proves export paths, not complete schemas/cost rules. DEV016's approved causal and investment-impact mappings remain distinct from source-bound reading. DEV021 now has local diagnostics and acceptance plans; deployment-wide measurement/retention/alerts and executed restore/security/performance evidence remain open. Root TODO and roadmap-gaps remain authoritative; no broad parent is completed by a document alone.

## User-run gates and acceptance

The16 children in this batch are integrated as authored implementations. Broader Partial/Planned parents remain open where their exact acceptance is still missing. If the configured databases are stopped, run `pnpm db:up` first. No new dependency is required by this batch. Migrations037–048 are registered in order; none were applied during authoring. Build the changed API and apply the newly registered additive migrations with the existing migration-owner configuration; preserve the existing databases and all historical migrations. Start/restart through the existing pnpm dev workflow and use its printed web/API URLs (last user targets5175/4103; current ports may differ). No default private configuration or named-mode activation is performed by this change.

```bash
pnpm build
pnpm db:migrate
pnpm dev
```

In a separate terminal, the user-owned SDLC gates formatting/checks before committing and then runs the focused cases:

```bash
E2E_BROWSER=chrome pnpm sdlc "Complete remaining roadmap workflows" -- --grep '@(GOAL-FEASIBILITY-001|MAPPED-IMPORT-001|EVIDENCE-LAYERS-001|QUALITY-OVERVIEW-001|NAMED-OPERATORS-001|MATERIAL-ALERTS-001|ECB-RATES-001|EVENT-REVIEW-001|BROKER-DIALECTS-001|EIA-BENCHMARKS-001|MATERIAL-AUTO-001|CONSENT-LIFECYCLE-001|ECB-FX-001|EVENT-LINEAGE-001|EVENT-EXTRACTION-001|IDENTITY-ADJUDICATION-001)|E2E-API-(121|150|330)|E2E-WEB-050'
```

The command stages all nonignored working changes, including retained REGRESSION-011 corrections. Review scope first. It never pushes. A failed E2E stage retains the already-gated commit. Do not interpret an old pass or committed child as verification of current changes.

For device-only parity, rebuild the packaged web assets, then select the same feature tags with the existing manual offline tool:

```bash
pnpm android:web
E2E_BROWSER=chrome pnpm android:test --grep '@(GOAL-FEASIBILITY-001|MAPPED-IMPORT-001|EVIDENCE-LAYERS-001|QUALITY-OVERVIEW-001|MATERIAL-ALERTS-001|ECB-RATES-001|EVENT-REVIEW-001|BROKER-DIALECTS-001|EIA-BENCHMARKS-001|MATERIAL-AUTO-001|CONSENT-LIFECYCLE-001|ECB-FX-001|EVENT-LINEAGE-001|EVENT-EXTRACTION-001|IDENTITY-ADJUDICATION-001)|E2E-OFFLINE-360'
```

Rebuild/reinstall the APK separately to test changes on the physical phone; installing over the existing app preserves its data. The existing APK has not silently updated. Leave test UI watch mode off. Share artifacts/e2e/latest.md with the first failed assertion, project, run ID and targets; omit private exports/keys. Each feature handoff has exact case and UI acceptance details. Earlier regression cases can be selected separately using the REGRESSION-011 handoff rather than rerunning the entire baseline suite.
