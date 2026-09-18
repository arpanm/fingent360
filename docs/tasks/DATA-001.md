# DATA-001 — Real India macro ingestion, evidence and public screen

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Implemented
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### DATA-001 — Real India macro ingestion, evidence and public screen

- **Implementation:** Implemented
- **Verification:** Awaiting user execution. User reported manually committing/pushing prior work; no new case-specific pass evidence inferred.
- **Request:** Continue all backlog tasks as end-to-end features, not documents or mocked UI. This increment implements the real-data portion of DEV-003/004/005/006/015/016 and SRC-007 before further dependent financial features.
- **Scope:** World Bank India annual GDP growth and CPI inflation, official allowlisted server fetch, strict provider validation with original decimal lexemes, source rights/attribution, Mongo raw snapshots, PostgreSQL canonical revisions and sync records, operator-protected manual refresh, public values/history/source details, responsive UI and executable API/browser tests. No fabricated defaults if upstream or storage fails.
- **Acceptance:** User can refresh real provider data in UI, inspect years/units/source timestamps, reload persisted values, inspect revisions and source status; failed/invalid ingestion never replaces accepted data; repeated refresh deduplicates values; unauthorized refresh rejects; upstream error and stale-cache states are explicit.
- **Codex prompt:** Read AGENTS/README/TODO and implement DATA-001 contracts first through real adapter, additive migration, persistence, API, React screen and meaningful unit/API/browser cases. Preserve decimal tokens, nulls, revisions and raw-source hashes. Use a configured local operator key for writes; never expose credentials or permit arbitrary fetch URLs. No synthetic application data, automatic background refresh or automatic tests/migrations. Update all task/source progress honestly, commit locally with hooks disabled, never push. Continue dependent feature work without seeking routine reconfirmation; leave actual provider/production gates explicit.

- **Delivery:** packages/contracts/src/macro.ts; World Bank adapter, macro service/controller, additive 002 migration, Mongo source snapshots, Macro.tsx and local research-key setup tool. E2E-API-020/021 and E2E-WEB-020 plus parser precision/quarantine tests authored. See docs/development/real-data.md for manual setup and expected outcomes.
- **Scope remaining:** Other sources, real equity holdings, regulated advice and real user accounts are not delivered by this macro feature. No startup sync, automatic execution or push performed.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on DATA-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Blocked — workflow failure. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789669163056-59061.
<!-- sdlc-validation:end -->
