# IDENTITY-001 — Resolve security identities

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - IDENTITY-001 (SRC-001; DEV-003/005/015/016): Implemented; five actual public ISINs matched and persisted with evidence. Offline/regression verification passed. OpenFIGI official terms/FAQ permit free identifier metadata reuse and an actual unauthenticated INR/India-equity mapping returned a Reliance identity on 2026-09-13. Deliver a bounded operator-entered public-ISIN mapping pipeline, immutable MongoDB raw evidence and PostgreSQL canonical revisions, public searchable identity directory/
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **IDENTITY-001 (SRC-001; DEV-003/005/015/016):** Implemented; five actual public ISINs matched and persisted with evidence. Offline/regression verification passed. OpenFIGI official terms/FAQ permit free identifier metadata reuse and an actual unauthenticated INR/India-equity mapping returned a Reliance identity on 2026-09-13. Deliver a bounded operator-entered public-ISIN mapping pipeline, immutable MongoDB raw evidence and PostgreSQL canonical revisions, public searchable identity directory/detail/history, explicit unresolved/ambiguous/failure states, and dated offline snapshot parity. No prices, action adjustment, verified ownership or exchange-listing assertion. Never send private account holdings automatically. Migration020; API/WEB230–239 and OFFLINE270–279. Prompt: use a fixed official endpoint, strict schemas, conservative request limits, recorded source/rights/version/retrieval/hash, duplicate-safe unchanged observations and durable bounded refresh status; authenticate operations and keep investor controls separate. Validate real provider → evidence → directory → holding-context navigation, replay/no-match/failure/isolation cases, mobile/keyboard flow and offline source dates. Root documentation/trackers/gates/local commit follow each slice; EOD/actions remain precisely gated by source terms.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on IDENTITY-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

## Current acceptance review — 20 September 2026

Reviewed scope: Bounded operator-entered public-ISIN OpenFIGI mapping, immutable retained provider evidence and canonical revisions, duplicate-safe refresh and durable failures, public searchable directory/detail/history/evidence and keyboard navigation, dated offline parity. No verified ownership, price, exchange-listing or complete security-master claim. Wider parents, actual source permissions, operational provider activation and native release certification remain separate; gaps listed in externalGates prevent automatic Done.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: outage-final-1789852687840.
<!-- sdlc-validation:end -->
