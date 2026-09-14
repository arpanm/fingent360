# MAPPED-IMPORT-001 handoff

Authored in main over `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`. No test, check, format, build, install, migration, service action, provider ingestion or commit was executed. Public official documentation research used web search and the browser skill; only public help/example pages were opened, and the created research tabs were closed. No private broker session or export was used. All working changes remain uncommitted for the user's gates; pre-existing REGRESSION-011 and concurrent goal/evidence/quality/operator changes were preserved. Root owns shared trackers and the eventual scoped commit.

## Exact owned manifest

1. `packages/contracts/src/holdings.ts` — strict mapped request and additive retained provenance metadata.
2. `packages/contracts/src/mapped-holdings.ts` — bounded CSV grammar and exact selected-unit/consolidation/source-total reconciliation.
3. `packages/contracts/src/index.ts` — mapped-holdings export only; preserve concurrent exports.
4. `packages/contracts/test/mapped-holdings.test.mjs` — five synthetic contract goldens and rejection groups.
5. `apps/api/src/holdings.ts` — mapped parsing in existing owned preview workflow.
6. `apps/web/src/offline/finance.ts` — same mapped parser in existing local preview workflow.
7. `apps/web/src/Holdings.tsx` — mapping mode, prior draft restore, explicit metadata discard, private late-response guard and guide registration.
8. `apps/web/src/MappedCsvImport.tsx` — choose/read/map/reconcile/correct/cancel UI and file-read generation fencing.
9. `apps/web/src/BrokerImportGuide.tsx` — researched five-platform manifest, primary links and specific unsupported-format explanation.
10. `apps/web/src/mapped-import.css` — responsive mapping fields/help links and touch targets.
11. `tests/e2e/fixtures/mapped-holdings.ts` — explicitly synthetic user-defined quoted/duplicate CSV, not a broker export.
12. `tests/e2e/helpers/mapped-import.ts` — actual account setup and keyboard mapping workflow; no import-time effects.
13. `tests/e2e/cases/api/mapped-import.spec.ts` — API610–613.
14. `tests/e2e/cases/browser/mapped-import.spec.ts` — WEB610–615.
15. `tests/e2e/cases/offline/mapped-import.spec.ts` — OFFLINE610–611.
16. `docs/product/mapped-import.md` — full layer specification and cited platform evidence/remaining gates.
17. `docs/development/mapped-import-handoff.md` — this handoff.

No dependencies or migrations added. Existing JSON previews, immutable holding revisions, privacy export and deletion carry the additive metadata. No raw files, original column names, ignored fields or filename persist. API ownership, Origin validation, account locks/post-wait admission, captured-baseline reconciliation, expiry, mandatory removal consent and idempotent confirmation are reused. Strict parser limits are 50,000 characters, 32 columns, 200 source rows, 1,000 characters per cell and 80 per header; browser upload also caps bytes at 50 KB. Explicit costs are integer INR paise or at most two-decimal INR rupees; quantities use existing six-decimal precision. No rounding or average-price reconstruction occurs. Mapping errors reveal row numbers only. Local mode uses the same parser and existing serialized storage.

## Authored acceptance and manual verification

There are **12 E2E definitions**: four API, six browser (each selected desktop/mobile project runs them), two offline; plus five contract unit definitions. Trace/video/automatic screenshots are disabled for private journeys. WEB610 deliberately writes only a synthetic review image. API cases and connected browser account calls use the existing actual isolated application/schema fixture; they do not mutate the ordinary app's financial data.

| Cases          | Expected behavior                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API610         | Real preview/save/same-preview replay; foreign preview denial; exact retained mapping metadata; export excludes raw/header/ignored values; account deletion.                         |
| API611         | Bad units/counts/totals/duplicate policies/columns/extra fields fail with saved history/previews unchanged.                                                                          |
| API612         | Real authentication, Origin and version enforcement with valid preview positive control.                                                                                             |
| API613         | Missing removal consent rejected; intervening real revision makes old preview stale; fresh mapped preview plus explicit removal saves revision 3 without changing earlier revisions. |
| WEB610         | Keyboard start/prepare/confirm, duplicate correction, exact normalized result, responsive review image, saved history/reload.                                                        |
| WEB611–612     | Incorrect total preserves saved data; cancel restores prior draft; explicit normalized edit discards metadata; actual logout/next-read401 clears private inputs.                     |
| WEB613         | Delay actual selected-file bytes, cancel during reading, release and drain; old read cannot restore abandoned mapping or alter saved holdings.                                       |
| WEB614         | Labeled synthetic503 only, followed by actual isolated API preview/save; reconciled draft survives and retry works.                                                                  |
| WEB615         | Keyboard disclosure of five researched platforms, official links and honest unsupported named-format status; no horizontal page overflow.                                            |
| OFFLINE610–611 | Real local save/reload/export/delete, count correction/cancel, bundled broker help, zero API requests.                                                                               |

User-only next actions, from repository root (watch/eye mode off):

```bash
pnpm format
pnpm check
pnpm build
# If existing databases/application are not already running:
pnpm db:up
pnpm dev
# Separate terminal; select the same tag in pnpm e2e:ui if preferred:
pnpm e2e:run --project=api --grep @MAPPED-IMPORT-001
pnpm e2e:run --project=desktop --project=mobile --grep @MAPPED-IMPORT-001
pnpm android:web
pnpm android:test --grep @MAPPED-IMPORT-001
```

No install is required if the existing locked dependencies/browser are ready. Existing PostgreSQL/MongoDB, migrated schema and compiled API are required for connected isolated fixtures; offline uses the rebuilt static device bundle without an API. The configured app URL is printed by `pnpm dev`; open its `#holdings` route (current root targets during authoring were web `http://127.0.0.1:5175`, API `http://127.0.0.1:4103`, but the printed/current `.env` selection is authoritative). `pnpm e2e:ui` prints its own dashboard URL, usually port 9323 or a free alternative. Review synthetic desktop/mobile images and perform keyboard/touch reading separately; neither authoring nor DOM overflow checks establish visual acceptance.

If any check fails, report command, run ID/date, project/case ID and first safe assertion from `artifacts/e2e/latest.md`, plus exact isolated-schema annotation for fixture setup/cleanup failures. Do not attach real statements, cookies or credentials. A scoped commit is permitted only after the user-run format/check gates pass; no commit is claimed here.

## Specific limitation and follow-on

MAPPED-IMPORT-001 is authored end to end. DEV-008/SRC-013's five named automatic broker adapters remain partial: researched official pages establish export capabilities or general statement concepts, but not complete parser-ready schemas with acquisition-cost reconciliation. The product guide and spec name each exact missing element. An authorized redacted representative export or complete primary format specification resolves the evidence prerequisite; synthetic amounts can then populate format-faithful goldens. No speculative broker preset, API-to-file format substitution or inferred average-price cost has been added. The existing standard XLSX parser remains unchanged; mapping accepts CSV only. User-run engineering and visual verification are still pending and separate from those external evidence prerequisites.

Root integration also bounds canonical UTF-8 JSON to100,000 bytes for both cost-column and supplemental inputs, preventing a character-count-valid mapped request from exceeding connected transport limits while succeeding locally. An additional Unicode ignored-column contract case is authored; no checks were run.

Existing API611 and OFFLINE611 also exercise an over100,000-byte mapped request (below the connected102,400-byte body cap), rejection and unchanged saved records.
