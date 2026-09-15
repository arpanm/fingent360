# EVENT-SCENARIOS-001 handoff

Authored seven strict family workflows, exact delta/outcome model, source-bound retained receipt, immutable version/review ledger, independent named review, public list/detail/history, Operations family forms, offline source re-admission, tests and specification. Broader DEV-020 real provider/causal packs remain partial; see docs/product/event-scenarios.md.

Integration: export event-scenarios.js contracts; EventScenariosController and OpsEventScenariosController plus eventScenarioProvider (STORE/EVENT_STORE/OPERATOR_STORE); migration053_event_scenarios.sql and test-sandbox/runtime grants. Public EventScenarios({route}) at #event-scenarios[/id], preserving optional eventId query. Operations EventScenarioOperations({request}) receives parent request typeof json for actual401 invalidation; section button label Event scenarios. Offline handleEventScenarios; bundle.eventScenarios from GET /api/v1/event-scenarios/snapshot. No account-private bucket or privacy export field required. Snapshot cap1000 items/4MiB, explicit failure when exceeded.

Detailed continuation prompt: bind every observed/reference token, unit, period, seasonal basis and publication vintage to actual retained reviewed evidence; distinguish prior change, a specific earlier published expectation, and hypothetical reference. Never infer consensus or convert descriptive numeric direction into an investment action. New provider formats require actual representative fixtures, source permissions and independent admission. Preserve immutable versions/reviews and current event/identity/lineage checks on public/offline reads. Do not treat synthetic goldens as verified provider acceptance. No deterministic execution as author.

User prerequisites: PostgreSQL/MongoDB plus API/web; apply current migrations including053 via pnpm db:migrate, then pnpm dev. Open printed web URL/#ops → Event scenarios and #event-scenarios. No new dependencies.

```bash
E2E_BROWSER=chrome pnpm sdlc "Add source-bound event scenarios" -- --grep '@EVENT-SCENARIOS-001'
```

Cases API1020–1021, WEB1020 desktop/mobile, OFFLINE1020–1022. Expected actual fixture preparation/review/publication/withdrawal safety, exact seven-family arithmetic and source tokens, no invented consensus, zero-network offline reads. Watch/eye off. Report selected failed case/project, saved run/artifact path and exact error without credentials/private data.

No format/lint/typecheck/build/tests/provider capture/service/migration/APK/sdlc/commit executed. Read-only primary BLS/Fed research recorded in spec; not production ingestion. Last inspected HEAD efd28d3. Shared uncommitted changes preserved; gated local commit remains user-owned, never push.
