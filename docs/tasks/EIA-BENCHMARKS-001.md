# EIA-BENCHMARKS-001 — documented free oil benchmark onboarding

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented World Bank monthly Brent/WTI; user validation pending. Parent: SRC009/DEV010 retains FX, EOD and causal-policy scope. Research the official EIA spot-price series, API schema, series-specific attribution/rights and limits before selecting a minimal Brent/WTI scope. EIA's general reuse policy permits its government information with attribution but excludes protected third-party material; do not infer blanket permission from API availability. If supported by primary evidence, implement a fixed bounded provider with private optional API-key configuration, exact USD-per-barrel values, explicit observation/retrieval/revision dates, null/gap/negative-value handling, retained evidence and reconciliation, immutable storage and independent operator review, public benchmark history/evidence/navigation and dated offline parity. No FX conversion, inferred Indian landed costs, forecasts, trades or fabricated live seed. Missing private configuration must produce a useful operator state without leaking key-bearing URLs or echoed credentials. Author contracts, representative labelled fixtures, API/browser/offline cases and full docs. Reserve migration042 and API/WEB/OFFLINE740–759 only after source selection is confirmed. Documentation lookup is read-only; provider ingestion, gates, tests, migrations/services and commits remain user-run.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### EIA-BENCHMARKS-001 — documented free oil benchmark onboarding

- **Implementation: Implemented World Bank monthly Brent/WTI; user validation pending. Parent: SRC009/DEV010 retains FX, EOD and causal-policy scope.** Research the official EIA spot-price series, API schema, series-specific attribution/rights and limits before selecting a minimal Brent/WTI scope. EIA's general reuse policy permits its government information with attribution but excludes protected third-party material; do not infer blanket permission from API availability. If supported by primary evidence, implement a fixed bounded provider with private optional API-key configuration, exact USD-per-barrel values, explicit observation/retrieval/revision dates, null/gap/negative-value handling, retained evidence and reconciliation, immutable storage and independent operator review, public benchmark history/evidence/navigation and dated offline parity. No FX conversion, inferred Indian landed costs, forecasts, trades or fabricated live seed. Missing private configuration must produce a useful operator state without leaking key-bearing URLs or echoed credentials. Author contracts, representative labelled fixtures, API/browser/offline cases and full docs. Reserve migration042 and API/WEB/OFFLINE740–759 only after source selection is confirmed. Documentation lookup is read-only; provider ingestion, gates, tests, migrations/services and commits remain user-run.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on EIA-BENCHMARKS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Validation only
- **User input needed now:** No for the independent next step.
- **Decision:** No new feature input needed. Implementation is already recorded; do not put this in the implementation queue solely because tests are unrun. Match saved failures to this task before authoring a repair.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** User-owned SDLC/test evidence is needed for verification. The report observed during triage is incomplete; no new full run is requested.
- **Next action:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789752953639-97020.
<!-- sdlc-validation:end -->

## Saved full-inventory repair — 2026-09-19

The saved full run1789752953639-97020 includes failed cases tagged to this task. Confirmed causes, scoped authored repairs and remaining verification are recorded in [the full-audit RCA](../development/full-audit-2026-09-19.md). User runs `SDLC_AUTO_REPAIR=0 pnpm sdlc "Repair full audit failures" --story SDLC-REPAIR-016`. No new passing evidence or automatic bug resolution is claimed; this bounded repair does not remove broader source/device/functional requirements recorded above.
