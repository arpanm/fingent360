# IMPACT-TRACE-001 handoff

Status: authored end-to-end reviewed-context child; validation pending. Broader causal impact parents remain partial (see product spec completion boundary).

Files: packages/contracts/src/impact-trace.ts; apps/api/src/impact-trace.ts; apps/web/src/ImpactTrace.tsx, impact-trace.css, offline/impact-trace.ts; infra/migrations/051_impact_trace.sql; tests/e2e/helpers/impact-trace.ts; cases/api/impact-trace.spec.ts, browser/impact-trace.spec.ts, offline/impact-trace.spec.ts; docs/product/impact-trace.md.

Shared integration: export impact-trace.js contracts; register ImpactTraceController (STORE/EVENT_STORE injected), migration051; route ImpactTrace at #impact-traces and AccountGate return destination; register handleImpactTraces; privacy schema default {traces:[]} using ImpactTraceReceiptSchema array, API exportImpactTraces, offline exportLocalImpactTraces and localImpactTraces account-deletion key. Equity dependency: equityCompanyForTrace(c,isin) exported from equity-coverage.ts and EquityCompanySchema/equityObservationKey contracts. Caller locks related equity editions before admission; absent company is explicit null, other failures propagate. Existing source publication/event/security/lineage prerequisites must remain registered.

Detailed Codex continuation: preserve exact reviewed source/identity and equity bindings, original holding quantity/cost, owned goal and no-growth comparator; never invent elasticities/expected prices. Implement any richer causal edges as separately reviewed versioned policies with contrary evidence and golden scenarios. Save final analytical outputs and re-admit dependencies before use. Retain historical receipt and private export/deletion/zero-network behavior. Do not infer broad parent completion or test success from authored code.

No new dependencies. Required services for user validation: PostgreSQL/MongoDB and repository web/API via pnpm db:up then pnpm db:migrate and pnpm dev (user execution only). Browser route: printed web URL/#impact-traces. Apply current migrations in order, including049 and051. Test prerequisite fixture sandbox also needs migration051 in its manifest (parent owns shared fixture registration).

Smallest user validation command:

```bash
E2E_BROWSER=chrome pnpm sdlc "Add reviewed evidence impact traces" -- --grep '@IMPACT-TRACE-001'
```

Cases API960–961, WEB960 desktop/mobile, OFFLINE960–961. Expected five authored case definitions across API/browser/offline projects pass; browser runs both applicable viewports. API saves actual source-bound records; no guessed or live market values in fixtures. Watch/eye toggles off.

Not run: formatting, lint, typecheck, tests, services, provider ingestion, migration, build/APK, pnpm sdlc or commit. Local HEAD at author handoff: efd28d3 (Add scoped failure repair). Parent should report the preserved pre-existing working-tree batch; no push. For failures supply saved run artifact path, selected case/project, error and screenshot/trace if generated; never paste keys or private holdings.
