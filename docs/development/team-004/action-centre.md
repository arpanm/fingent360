# ACTION-CENTRE-001 handoff

Authored implementation: strict exact calculation/contracts; immutable private API/database receipts with reconstruction and privacy; responsive shared web/Android form and side-by-side comparison; installed offline parity; API/browser/offline test authoring and product spec. Parent DEV-019 remains partial for broader action catalogues/actual tax and trading-history engines; see docs/product/action-centre.md.

Integration exports action-centre.js from contracts; ActionCentreController in API (STORE/EVENT_STORE); migration052_action_centre.sql and isolated fixture migration/runtime grants; ActionCentre at #action-centre with navigation and AccountGate return destination; handleActionCentre offline; PrivacyExportSchema actionCentre:{assessments:ActionCentreReceiptSchema[]} default empty, API exportActionCentre, offline exportLocalActionCentre and localActionCentre deletion key. No new package dependencies.

Detailed continuation prompt: preserve exact units/price/paise arithmetic, immutable source/financial/policy snapshots and no-action comparator. New alternatives require an explicit versioned policy, actual owned inputs, liquidity/concentration/turnover/cost/tax/goal assumptions, guarded no-action baseline, reconstruction goldens and owned export/delete/offline parity. Never infer legal tax rates, actual liquidity, risk capacity, market valuation or completed trades. Re-admit exact source and owned versions at save. Do not execute deterministic gates as an author.

Smallest user-run validation (required services PostgreSQL/MongoDB, API/web; user applies migration049/051/052 via pnpm db:migrate and starts pnpm dev):

```bash
E2E_BROWSER=chrome pnpm sdlc "Add educational action comparisons" -- --grep '@ACTION-CENTRE-001'
```

Cases API990–991, WEB990 desktop/mobile, OFFLINE990–991. Expected exact numeric and safe constraint outcomes, unchanged financial records, real API save/reload/delete, isolated owner access and zero-network offline handling. UI printed web URL/#action-centre; watch/eye off. Report failed case/project, saved artifact/run path and exact error; exclude secrets/private financial data.

No install/format/lint/typecheck/build/test/migration/service/provider run, APK rebuild, pnpm sdlc or commit performed. HEAD at last read efd28d3; existing shared uncommitted work preserved. User sdlc owns validation and gated local commit; no push.
