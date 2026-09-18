# Portfolio trace acceptance failure — 18 September 2026

## Evidence and cause

Inspected saved run `artifacts/sdlc/1789751750850-92480`; no tests were executed during this investigation.

- `06-pnpm-e2e_run.log`: all 20 selected connected cases passed.
- `08-pnpm-android_test.log`: OFFLINE-1331 passed; OFFLINE-960, OFFLINE-961 and OFFLINE-1700 failed schema validation: “Event, source, identity and graph revisions do not reconcile.”
- Shared fixture in tests/e2e/cases/offline/impact-trace.spec.ts marked an event published while its graph edges remained candidates. The production schema correctly rejected the inconsistent synthetic publication graph.
- Saved repair analyses `repair-1-result.md`, `repair-2-result.md` and `repair-3-result.md` identify the fixture mismatch. Repairs mark edges reviewed and require a nonempty reviewed graph. Exact retries in `10-pnpm-android_test.log`, `12-pnpm-android_test.log` and `14-pnpm-android_test.log` each passed. No production contract was weakened.
- Resolved bug records: [OFFLINE-960](../bugs/BUG-a57afe92fde1af5a.md), [OFFLINE-961](../bugs/BUG-e1e1572dd2e56130.md), [OFFLINE-1700](../bugs/BUG-a57cc14d2843d2c0.md).

The final story acceptance still failed: docs/validation/results.json retained all 24 case/project passes, but they spanned different source fingerprints. Connected cases and OFFLINE-1331 used `f53e9add1691…`, OFFLINE-960 used `3b60e5fdce4a…`, and the last two used `a8694374d296…`. The story validator requires current-revision passing evidence for every matrix entry and the check gate. Exact retries after source edits do not establish that complete current-revision matrix.

This is a workflow limitation, not evidence of a remaining application failure in these cases. Do not mark the story Done from mixed-revision results. Dependency-aware evidence invalidation remains unimplemented; the new full-inventory option does not weaken acceptance rules.

## What the bug system actually guarantees

The recorder saves case/project failures, bounded failure excerpts, evidence paths, status and passing-resolution records in docs/bugs and docs/validation. Repair agents receive scoped failure evidence and return cause/changes/gaps in separate repair-result files. A failure record alone is not an RCA. The bug tracker does not enforce structured cause analysis or automatically link those repair analyses; a correct investigation is not guaranteed merely because the agent ran. Do not describe every failure as automatically diagnosed.

## Manual validation

`SDLC_AUTO_REPAIR=0 pnpm sdlc "Audit all pending validation" --all` runs complete connected and freshly built offline inventories through the existing recorder without agent edits between tests. Normal format/check/gated commit still precedes testing. Fix any recorded failures before the next relevant run. This includes broader cases, not just pending labels, because labels alone do not define test dependencies. Only reviewed acceptance matrices can become fully accepted automatically; other tasks receive evidence without fabricated completion. Physical Android/device and external approval requirements remain separate.

The launcher change and its unit regression cases are authored, not executed. No new application behavior, DB migration or dependency was introduced.
