# ROADMAP-COMPLETE-003 — close remaining implementation acceptance

- **Status:** Partial
- **Implemented / recorded:** - Implementation: In progress. Verification: not run. User requests completion of all Partial and Planned tasks end to end. Preserve prior uncommitted REGRESSION-011 corrections. Work in dependency order; never promote a parent merely because a child or document exists. Implemented children: goal feasibility, mapped CSV imports, source explanation layers, quality diagnostics, named operator review and material alerts. ECB-RATES-001 is also implemented for its selected numerical family. EVENT-REVIEW-001 and BROKER-DIALECTS-001 supplemental-cost reconciliation are implemented. World Bank monthly oil benchmarks and opt-in durable material checks are also implemented. CONSENT-LIFECYCLE-001 is also implemented for four explicit purposes. ECB-FX-001 is implemented. EVENT-LINEAGE-001 is implemented. IDENTITY-ADJUDICATION-001 is implemented. EVENT-EXTRACTION-001 is implemented. This batch is authored; broader remaining acceptance is listed in each Partial/Planned parent and docs/development/roadmap-gaps.md. Further first-party Zerodha/Groww inspection still did not establish a complete named export layout.
- **Pending:** Developer: finish the remaining acceptance criteria in this task.
- **Next action / inputs:** Complete the explicitly partial DEV/SRC children; do not rerun the full suite for roadmap closure.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### ROADMAP-COMPLETE-003 — close remaining implementation acceptance

- **Implementation: In progress. Verification: not run.** User requests completion of all Partial and Planned tasks end to end. Preserve prior uncommitted REGRESSION-011 corrections. Work in dependency order; never promote a parent merely because a child or document exists. Implemented children: goal feasibility, mapped CSV imports, source explanation layers, quality diagnostics, named operator review and material alerts. ECB-RATES-001 is also implemented for its selected numerical family. EVENT-REVIEW-001 and BROKER-DIALECTS-001 supplemental-cost reconciliation are implemented. World Bank monthly oil benchmarks and opt-in durable material checks are also implemented. CONSENT-LIFECYCLE-001 is also implemented for four explicit purposes. ECB-FX-001 is implemented. EVENT-LINEAGE-001 is implemented. IDENTITY-ADJUDICATION-001 is implemented. EVENT-EXTRACTION-001 is implemented. This batch is authored; broader remaining acceptance is listed in each Partial/Planned parent and docs/development/roadmap-gaps.md. Further first-party Zerodha/Groww inspection still did not establish a complete named export layout.
- **Codex prompt:** Inspect every remaining task against actual contracts, API, persistence, UI, offline workflows and cases. Implement real missing behavior with strict schemas, explicit review/retry/stale states, owned data and provenance. Reuse current source and security boundaries. Record provider entitlements/sample dependencies precisely; never invent private formats or source permission. Write meaningful API/browser/offline cases and specifications before claiming completion. Integrate each child and update parent gaps, README, coverage and handoffs. Keep implementation distinct from verification and physical-device acceptance. User owns installation, migrations, builds, format/check, tests and gated commits via pnpm sdlc; do not execute those or push.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ROADMAP-COMPLETE-003 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Follow child tasks
- **User input needed now:** No for the independent next step.
- **Decision:** This is a rollup. Advance the linked incomplete children rather than duplicating their code or requesting a parent-level approval.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** If a concrete private input or external authorization becomes necessary, record the exact evidence and question before asking.
- **Next action:** Developer: finish partial DEV/SRC tasks in dependency order; do not mark the parent complete early.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.
