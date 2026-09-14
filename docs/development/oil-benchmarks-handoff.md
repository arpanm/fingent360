# EIA-BENCHMARKS-001 handoff

Authored in main over `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`; frozen for parent integration. Selected source: **World Bank monthly Brent/WTI**, with affirmative dataset-specific CC BY4 evidence. EIA's Refinitiv-derived daily history is not enabled. [Specification and primary-source evidence](../product/eia-benchmarks.md).

No format/check/test/build/install/migration/service action, provider ingestion or commit was run. The expressly authorised exception was read-only source-format research: one public first-party workbook was downloaded to ignored `artifacts/source-research/eia-benchmarks/` and inspected with existing ZIP/XML libraries. No app parser was executed against it, no numerical rows were copied into goldens and no product database or bundle received its data. This is format evidence, not provider acceptance or a test pass.

## Exact manifest

1. `packages/contracts/src/oil-benchmarks.ts` — strict fixed-source, exact lexical/display-decimal reconciliation, month/edition/head/review/public/history/retained contracts.
2. `packages/contracts/src/oil-benchmark-parser.ts` — bounded ZIP/CRC/fixed allocation, inert metadata and source-bound selected XLSX cells.
3. `packages/contracts/src/index.ts` — two oil exports only.
4. `packages/contracts/test/fixtures/oil-benchmarks.json` — clearly synthetic numerical rows with documented-layout provenance.
5. `packages/contracts/test/oil-benchmarks.test.mjs` — six parser/contract units.
6. `infra/migrations/042_oil_benchmarks.sql` — canonical exact records, immutable editions/observations/review receipts, completed capture protection and mutable head.
7. `apps/api/src/oil-benchmark-provider.ts` — fixed first-party URL, no credentials/redirects, bounded binary capture and contextual receipt hash.
8. `apps/api/src/oil-benchmarks.ts` — real Mongo/PostgreSQL capture, quarantine, reconciliation, replay, publication/withdrawal and final admission.
9. `apps/api/src/app.ts` — two controller and one provider registrations only.
10. `apps/api/test/oil-benchmark-provider.test.mjs` — two synthetic transport units with no live network.
11. `apps/web/src/OilBenchmarks.tsx` — public current/month/history/evidence/Back, latest-year selector, compact two-benchmark tables, lexical-evidence disclosure and attribution.
12. `apps/web/src/OilBenchmarkOperations.tsx` — draft capture, independent proposal/bootstrap review, confirm/cancel/retry, durable historical reviews and protected original receipt/Close/401 fencing.
13. `apps/web/src/oil-benchmarks.css` — responsive numerical/read/review styling.
14. `apps/web/src/App.tsx` — More entry, keyed route and nested title.
15. `apps/web/src/Macro.tsx` — oil context link only.
16. `apps/web/src/Operations.tsx` — oil section and guarded request/proposal integration only.
17. `apps/web/src/RetentionOperations.tsx` — one oil paragraph in the existing offline Operations explanation.
18. `apps/web/src/offline/oil-benchmarks.ts` — actual local public handler and publication admission.
19. `apps/web/src/offline/types.ts` — three optional oil bundle fields only.
20. `apps/web/src/offline/index.ts` — handler registration only.
21. `scripts/oil-benchmark-snapshot.mjs` — consistent public/admitted snapshot collector, no import-time work.
22. `scripts/offline-snapshot.mjs` — collector import/call only.
23. `tests/unit/oil-benchmark-snapshot.test.mjs` — three admission/withdrawal/race units.
24. `tests/e2e/helpers/oil-benchmarks.ts` — owned fixture routing/SQL/Mongo validation, lazy synthetic XLSX assembly and actual store methods.
25. `tests/e2e/cases/api/oil-benchmarks.spec.ts` — API740–751.
26. `tests/e2e/cases/browser/oil-benchmarks.spec.ts` — WEB740–744.
27. `tests/e2e/cases/offline/oil-benchmarks.spec.ts` — OFFLINE740–741.
28. `docs/product/eia-benchmarks.md` — specification, source choice, rights and precision evidence.
29. `docs/development/oil-benchmarks-handoff.md` — this handoff.

Three coordinated oil hunks authored by the named-operator owner are also required: `packages/contracts/src/named-operators.ts`, `apps/api/src/publication-proposals.ts`, `apps/web/src/ProposalInspection.tsx`. They add strict `oil-benchmarks` proposals for target `world-bank-oil-benchmarks`, source-head/unused-request admission, actual current numerical inspection and atomic independent approval. The constructor injection is satisfied by the API registration above. Parent separately registered migration042 exactly once in `apps/api/src/migrate.ts`. Preserve other feature changes in all shared files; do not replace whole shared files from older copies.

## Source and numerical decisions

The official distribution page links the monthly workbook and its dataset terms; catalogue0038238 labels the dataset Public/CC BY4. Workbook sensitivity/print labels say Official Use Only, but no series-specific licence exclusion was found. This discrepancy is documented, not interpreted as a new prohibition or ignored. Known suppliers are attributed; no logo, source narrative or endorsement is copied into public data.

The authorised research receipt records URL, UTC retrieval, SHA256 and586735bytes. Inspected structure: Monthly Prices C/E headers identify Brent/WTI, row6 USD/barrel, A7 onward `YYYYMmm`, A4 reported update date;806 visible rows,800 monthly observations including pre2000 history, no hidden selected columns, only r/s/t selected-cell attributes. The source has inert workbook-local Power Query connection metadata, drawing/print/custom-XML parts and ZIP compression-option flags6. None is executed. It has no formulas or external-link parts. The parser validates saved-cell identity, visibility and relationships while bounding ignored inert parts.

Both selected series use display format0.0; stored OOXML text includes binary tails. BigInt decimal arithmetic rounds half away from zero to one decimal. Original lexical text remains in each selected observation's evidence. Null stays null, negative values stay valid, and missing months fail a complete grid. Canonical hashes compare displayed values; a harmless lexical-only change creates a capture receipt/check time while preserving the original accepted edition/evidence.

Bounds: fixed documented XLSX URL;3MB compressed,12MB individual entry,24MB total expanded,100 ZIP entries;600,000 XML delimiters/32 nesting levels;4-second directory and parse deadlines;2 fixed series,2000-01 onward,1200months/2400observations;10-second HTTP capture;60-second new capture pacing;50-item edition/review pages, latest50 capture receipts, max500 offline admitted editions. No new dependency: existing fflate and fast-xml-parser are reused. No provider key is required or added.

The reported month, workbook update date, retrieval timestamp, retrieval edition and operator publication time remain distinct. Original precise publication/known-at time is unknown; no historical as-of vintage is claimed. The UI shows latest reviewed monthly data without daily freshness promises or carry-forward through a missing value. Oil/FX conversion, India landed cost, forecasts, causal/company/holding/goal impact and recommendations are outside this child.

## Authored acceptance

**19 E2E definitions:**12API,5browser (each applicable desktop/mobile project),2offline. **11 units:**6parser/contracts,2transport,3snapshot. `@EIA-BENCHMARKS-001` selects the feature. Synthetic data/fault cases also carry `@TEST-SIMULATION`; API750 also covers `@NAMED-OPERATORS-001`. Automatic private screenshots/video/traces are off; WEB740 deliberately writes only a synthetic public screenshot.

| Cases      | Required result                                                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API740     | Synthetic transport → actual Mongo original → real exact PostgreSQL records → review → public/evidence; original bytes operator-only.                                                                 |
| API741     | Complete invalid workbook produces durable parse failure/raw receipt; same request replays without fetching; cannot publish.                                                                          |
| API742     | Truncated accepted history fails, preserves prior publication and immutable observation/review triggers.                                                                                              |
| API743     | Equal displayed numbers with different source lexical text preserve edition/evidence, advance checked-at and replay without another provider action; new paced request409.                            |
| API744     | Publish1 → withdraw → publish2 keeps old history/evidence retired; old review replay remains historical; modified same-ID input409.                                                                   |
| API745     | Real anonymous/Origin denial and exact source-head wait → actual operator expiry →401/no numbers; fresh login succeeds.                                                                               |
| API746     | Two actual store instances serialize capture: second409 and zero second transport calls; admitted first completes.                                                                                    |
| API747     | Actual observation INSERT trigger rejection rolls back edition and values while retaining raw failed-storage evidence.                                                                                |
| API748     | Explicit synthetic51-edition population exercises50-item integer pagination, continuation, query rejection and unchanged counts.                                                                      |
| API749     | Actual final review INSERT wait then operator expiry rolls back head and receipt after401.                                                                                                            |
| API750     | Actual named-mode capture receipt/draft → proposal → distinct reviewer approval → public result; direct and same-author denial, atomic approval replay.                                               |
| API751     | Actual A capture after synthetic A/B baseline appends edition3/new retrieval receipt; original editions/publication remain unchanged until review.                                                    |
| WEB740     | Keyboard More → monthly cards → history → edition → latest/prior/all-year selection → lexical evidence → nested Back; negative/null/precision wording, mobile overflow and synthetic visual artifact. |
| WEB741     | Cancel draft; real committed review with lost reply → same-ID replay → failed authoritative refresh shows historical receipt and disables new mutation → Retry/reload/history recovery.               |
| WEB742–743 | Held actual private200 cannot reopen after Close or after real revoked session/next401; routes and active API requests drain.                                                                         |
| WEB744     | Initial503 retries into actual empty source, with no invented successful values.                                                                                                                      |
| OFFLINE740 | Actual packaged snapshot or honest unavailable state, evidence/Back when present, connected explanation, zero API requests.                                                                           |
| OFFLINE741 | Actual local handler excludes retained retired bytes, then all values after withdrawal; local personal state unchanged.                                                                               |

## User-only next actions

No dependency installation is required when the repository's locked dependencies and Playwright browsers are already available. PostgreSQL/MongoDB, compiled contracts/API and migration042 are required for connected isolated cases. The fixture owns its temporary schemas and Mongo database; no test cleanup targets main data. Watch/eye mode remains off.

The following commands are for the user, not the agent:

```bash
pnpm format
pnpm check
pnpm build
# Only if the existing services are stopped:
pnpm db:up
pnpm db:migrate
pnpm dev
# Separate terminal:
pnpm e2e:run --project=api --grep @EIA-BENCHMARKS-001
pnpm e2e:run --project=desktop --project=mobile --grep @EIA-BENCHMARKS-001
pnpm android:web
pnpm android:test --grep @EIA-BENCHMARKS-001
```

Alternatively the user can select the feature in `pnpm e2e:ui` or invoke the repository's `pnpm sdlc` workflow after reviewing all pending change scope; that command stages all nonignored changes and gates the commit. It does not start services or apply migrations.

Open the web URL printed by `pnpm dev` at `#oil-benchmarks` or `#ops` → Oil benchmarks. Last known root targets are web `http://127.0.0.1:5175` and API `http://127.0.0.1:4103`; launcher output is authoritative. The optional test UI prints its URL, usually9323 or a free alternative.

Actual provider acceptance is an explicit user action: connected Operations → **Capture fixed World Bank workbook** → inspect capture outcome, reported month/update date, selected lexical/display values and raw receipt → compare with the linked monthly distribution → publish the exact captured head (or propose and have a different named reviewer approve). Failure retains an inspectable safe outcome; do not label that a successful onboarding. The app parser has not yet been exercised against the authorised research copy or a live capture. The dated distribution URL needs review if the publisher moves it.

After real publication, the user may run `pnpm android:snapshot`, then `pnpm android:web` and the feature offline cases. The current checked-in bundle is unchanged and contains no new synthetic oil data. Inspect WEB740's desktop/mobile image and manually verify keyboard, touch, focus, overflow, original-source links and Back on the intended phone. DOM assertions are not device/visual acceptance.

Report failures with command, run timestamp/ID, project, stable case ID and first safe assertion from `artifacts/e2e/latest.md`; include the exact owned schema annotation for startup/cleanup errors. Do not share credentials, cookies, private financial data or full original workbook metadata unnecessarily. HEAD remains `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`. Existing root regressions/imports/goals/named/material/ECB/event/quality changes remain uncommitted and preserved; no child commit or verification pass is claimed. Commit only after the user's successful format/check gate.
