# Source-bound research governance

Authored 2026-09-15 for DEV-015; validation pending. This completes the missing causal/policy Operations workflow and connects optional policy releases to educational comparisons. It does not complete quantified portfolio-impact research or authorize regulated advice.

## Workflow and acceptance

1. A named preparer opens **More → Operations → Research policies and causal review**, chooses an actually published reviewed event, selects its retained citations, and enters an explicit review-by date and rationale.
2. A qualitative draft must choose sector/company links already present in that event, state uncertainty and horizon, and keep quantified impact null. A policy draft instead supplies four explicit editorial limits: concentration, turnover, cooldown and downside stress. No statutory values are inferred.
3. Saving appends an immutable revision. Simulating stores exact-version checks: retained mappings and code boundary invariants. These checks do not prove economic causality or optimal policy. Existing ActionCentre financial scenarios remain independently necessary.
4. A different named publisher reviews the sources and simulation and releases or withdraws the revision. Author self-approval and shared-key approval fail. Request identifiers support idempotent retries; stale revisions and mismatched simulation receipts fail.
5. ActionCentre offers currently admitted educational policies. Selecting one applies the stricter concentration/turnover caps and cooldown/stress minima, preserving both original user inputs and the exact release snapshot in the immutable comparison receipt. Withdrawing, expiring or changing source evidence blocks new bindings and marks existing receipts for review.
6. Android uses the same web screens. Downloaded policy snapshots support local comparisons only when their event snapshots still match. Device mode cannot perform Operations writes, and explains that a later server withdrawal cannot be known offline. Rebuild/sync the APK to include changed bundled code and data.

The queue paginates 50 drafts, immutable history exposes the latest 100 revisions/reviews, and reader policy choices are bounded to 100 released educational policies. Loading, no-draft, failure/retry, saved, simulation, independent-review and withdrawn states are explicit. Inspect-event navigation returns to existing source evidence. Policy release makes its rationale/evidence public; operator hashes remain server-only.

## Storage and API

Migration `064_research_governance.sql` adds heads, immutable versions, immutable simulation receipts and immutable independent reviews. Foreign keys, per-request/per-draft locks and final authorization checks preserve revision integrity. Existing PostgreSQL/Mongo source retention is reused; governance does not fetch new provider data or invent numerical sensitivities.

Protected `/api/v1/ops/research-governance` supports queue reads; `/:id` PUT appends drafts; `/:id/simulations` POST stores invariant receipts; `/:id/reviews` POST releases/withdraws; `/:id/history` GET returns immutable history. Public `/api/v1/research-governance/snapshot` returns source-admitted policy and causal-context editions without operator identities. Released company-specific contexts can be bound to impact traces; their immutable directional interpretation never creates a quantified sensitivity. Existing account ActionCentre routes persist exact optional bindings and reconstructed outcomes. Source change and release admission happen inside the account transaction.

## User-run validation

No dependencies changed. Do not run migration or checks through an agent. User actions:

```bash
pnpm db:up
pnpm db:migrate
pnpm dev
# Separate terminal, after implementation is ready:
pnpm sdlc "Complete source-bound research governance" --checks-only
pnpm e2e:run --grep @DEV-015
```

Use the dev URL printed by the launcher (`/#ops`, `/#action-centre`); operations release needs two different named identities. Cases: API1290 independent review/replay/real account policy binding/withdrawal; API1291 actual mapping rejection and revision conflict; WEB1290 persisted source navigation/simulation/release/history/withdrawal in desktop/mobile projects; OFFLINE1290 disconnected Operations rejection without network writes. API/browser data are explicitly synthetic interpretations of retained fixture evidence.

Also manually review keyboard focus, small-screen forms, source/back navigation and the rebuilt APK with downloaded policies. Provide run ID/date, selected projects/IDs and failing case error/context if validation fails. Format/check/commit/E2E/build/migration/service execution were not performed by the author; the user-invoked SDLC command owns the conditional commit. No push.
