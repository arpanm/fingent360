# BROKER-DIALECTS-001 handoff

Authored directly in main over `b5cfcd0c096b034aee1aa70f8360d082bb0d2e2b`. The supplemental-cost child is implemented across contracts/parser, existing API and device preview/confirmation, UI, provenance/history/export and authored cases. User-run validation remains pending. No named broker adapter was proved by the public format research; the concrete remaining layout and cost gates for all five platforms are in [the specification](../product/broker-dialects.md). This child extends the frozen MAPPED-IMPORT-001 cost-column workflow without changing its parser version.

No tests, discovery, formatting, checks, builds, installation, service/DB actions, provider ingestion or commit were run. The permitted research used public primary web sources and browser-visible official examples; no private statements, broker sign-in or outbound report/email request. Research tabs were closed. Existing uncommitted REGRESSION-011, mapped-import, goal/evidence/quality/operator/material-alert/ECB/event and concurrent parent work is preserved. Root owns shared trackers and eventual integration/commit; all authored files remain uncommitted awaiting user-run gates.

## Exact manifest

Changed shared feature files (preserve the existing mapped-import additions):

1. `packages/contracts/src/holdings.ts` — strict supplemented input, row-bound attestation and discriminated receipt metadata, additive preview version.
2. `packages/contracts/src/mapped-holdings.ts` — unchanged legacy cost-column path plus exact supplemental parsing, row binding, consolidation, totals and encoded-size parity.
3. `apps/api/src/holdings.ts` — dispatch supplemented input through the existing owned preview; unchanged locks/expiry/confirmation/history.
4. `apps/web/src/offline/finance.ts` — identical parser in the existing serialized device workflow.
5. `apps/web/src/Holdings.tsx` — supplemental provenance in preview, saved record and history.
6. `apps/web/src/MappedCsvImport.tsx` — existing form's explicit cost-source choice, per-row amounts, records basis and attestation; invalidate/reset/cancel/retry behavior.
7. `apps/web/src/BrokerImportGuide.tsx` — actual primary download paths and cost caveats; named format status stays explicit.
8. `apps/web/src/mapped-import.css` — responsive supplemental rows and native radio sizing.

New files:

9. `apps/web/src/SupplementalCostReceipt.tsx` — reusable dated-revision cost-origin disclosure and per-source-row receipts.
10. `packages/contracts/test/supplemental-holdings.test.mjs` — seven contract cases.
11. `tests/e2e/fixtures/supplemental-holdings.ts` — synthetic user-defined file/amounts, not broker-layout evidence.
12. `tests/e2e/helpers/supplemental-holdings.ts` — normal keyboard/pointer preparation and preview; reuses owned account setup.
13. `tests/e2e/cases/api/supplemental-holdings.spec.ts` — API720–722.
14. `tests/e2e/cases/browser/supplemental-holdings.spec.ts` — WEB720–725.
15. `tests/e2e/cases/offline/supplemental-holdings.spec.ts` — OFFLINE720–722.
16. `docs/product/broker-dialects.md` — evidence, policy, acceptance and remaining broker-format gates.
17. `docs/development/broker-dialects-handoff.md` — this handoff.

No dependencies, migrations, controller registrations or new privacy tables are needed. The prior mapped-holdings index export already exposes the parser/type; holdings schemas are already exported. JSON preview/revision records retain strict supplemental origin/basis/attestation and per-source-row identifier, quantity and integer-paise cost. Raw files, headers, filenames, displayed averages, valuations and other ignored fields are discarded. Privacy JSON preserves the receipts; Download saved CSV remains the existing normalized holdings-only format. Account deletion reuses existing cascades and local deletion. No recommendation, valuation or financial inference is introduced.

## Authored acceptance

There are **12 E2E definitions**: three API, six browser and three offline. Selecting both browser projects gives **15 connected executions** (3 API + 12 desktop/mobile) and three device executions. Seven unit cases are authored. All three E2E files disable trace, video and automatic screenshots. WEB720 has a deliberate controlled synthetic screenshot at each project's normal viewport; visual/mobile/physical acceptance remains separate from authoring and API correctness.

| IDs        | Actual intended assertions                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API720     | Owned actual preview/save and foreign denial; exact immutable supplemental receipts; old confirmation replay after a later real revision; privacy excludes source text/averages; account deletion.     |
| API721     | Missing/false attestation, wrong provenance/row binding, extra fields, mismatched totals/counts, duplicate policy and cost precision fail; saved history and retained previews remain byte-equivalent. |
| API722     | Real authentication/Origin, actual intervening revision, stale preview rejection, current preview plus explicit removal consent.                                                                       |
| WEB720     | Keyboard mode/prepare/confirm, required attestation, normal mobile disclosure click, exact supplied row receipt, responsive synthetic image, saved reload/history provenance.                          |
| WEB721     | Changed total invalidates attestation and preview; mismatch recovery; unit change clears amounts; cancel restores prior draft.                                                                         |
| WEB722     | Only a labeled 503 is simulated; real retry/save succeeds with the attested draft retained. Explicit normalized edit removes supplemental provenance from the next standard preview.                   |
| WEB723     | Actual concurrent API replacement causes conflict; refresh preserves supplemental draft and fresh review binds current revision.                                                                       |
| WEB724     | Actual logout followed by preview401 removes costs, draft and attestation.                                                                                                                             |
| WEB725     | Static bundled help exposes actual Groww/Upstox primary paths and ICICI closing-price caveat; no fabricated named-format support.                                                                      |
| OFFLINE720 | Real device UI save/reload/per-row export/delete and sign-in barrier, zero outgoing API requests.                                                                                                      |
| OFFLINE721 | Actual local row-binding rejection leaves retained records unchanged; confirmed replay returns its historical receipt after a later replacement; persisted latest records survive reload.              |
| OFFLINE722 | Real empty supplemental replacement retains rows until explicit removal acknowledgement; durable empty receipt and bundled research help, zero API requests.                                           |

The existing API610–613/WEB610–615/OFFLINE610–611 and seven new units together retain cost-column compatibility, malformed CSV/file-read cancellation and existing ownership/expiry behavior. New units exercise exact precision, two-column and zero-row sources, complete binding, attestation/provenance, bogus or missing costs, metadata masquerading, old-version compatibility and encoded-size limits. No case fetches a broker/provider, mutates ordinary account data, or adds discovery side effects. Connected cases use the existing actual per-test application/schema fixture. Browser setup uses routed `page.evaluate(fetch)`; device cases wait for On-device mode after reload before direct calls.

## Manual next actions

User-only commands from repository root; watch mode stays off:

```bash
pnpm format
pnpm check
pnpm build
# Only if the existing database/application services are not running:
pnpm db:up
pnpm dev
# Separate terminal:
pnpm e2e:run --project=api --grep '@BROKER-DIALECTS-001|@MAPPED-IMPORT-001'
pnpm e2e:run --project=desktop --project=mobile --grep '@BROKER-DIALECTS-001|@MAPPED-IMPORT-001'
pnpm android:web
pnpm android:test --grep '@BROKER-DIALECTS-001|@MAPPED-IMPORT-001'
```

No dependency install or new migration is required for this child. Connected tests require the repository's existing migrated PostgreSQL/MongoDB and compiled actual API fixture; the device bundle must be rebuilt and uses local handlers without an API. The application URL printed by `pnpm dev` is authoritative; current root targets during authoring were `http://127.0.0.1:5175/#holdings` and API `http://127.0.0.1:4103`. In My holdings choose Map CSV columns → Supply exact costs from my records. Prepare all rows, basis, reconciled total and attestation; then separately consent, review replacement and confirm. Expect saved/history costs to remain labeled user-attested. `pnpm e2e:ui` can select these same IDs/tags and prints its dashboard URL, usually port 9323 or a free alternative.

Inspect the synthetic review image and perform keyboard/phone/touch/Back acceptance separately. For failures report the command, run ID/date, project/case ID, first safe assertion and `artifacts/e2e/latest.md` path; include the isolated-schema annotation for fixture failures. Do not attach actual broker files, passwords, cookies or private acquisition records. No verification or new local commit is claimed. A scoped commit awaits successful user-run format/check gates.
