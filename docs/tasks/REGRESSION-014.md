# REGRESSION-014 — provider literal types and named cursor signing

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - Implementation: Corrections authored; user verification pending. User confirms formatting/lint/contracts typecheck passed; API typecheck reports widened provider URL literals and internal authorization Symbols passed to HMAC. Explicitly type the three captured provider records against their existing fixed-URL receipt shapes. Keep the internal capability unchanged: audit/publishing cursors use the existing bootstrap secret when available and an independent random server-only controller key in named mode. Never cast/stringify a Symbol into a signing secret. Named cursors reset after API restart; existing reset-page recovery applies. No new configuration, migration or dependency.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### REGRESSION-014 — provider literal types and named cursor signing

- **Implementation: Corrections authored; user verification pending.** User confirms formatting/lint/contracts typecheck passed; API typecheck reports widened provider URL literals and internal authorization Symbols passed to HMAC. Explicitly type the three captured provider records against their existing fixed-URL receipt shapes. Keep the internal capability unchanged: audit/publishing cursors use the existing bootstrap secret when available and an independent random server-only controller key in named mode. Never cast/stringify a Symbol into a signing secret. Named cursors reset after API restart; existing reset-page recovery applies. No new configuration, migration or dependency.
- **Reusable Codex prompt:** Inspect provider receipt construction and both cursor codecs. Preserve strict source URL/hash/transport bounds, constant-time signature comparison and final operator authorization. Author focused codec cases for bootstrap compatibility, named round-trip/tamper/restart isolation and rejection of signatures made from the public Symbol description. Update docs/trackers. Do not run formatter/check/build/test/provider/migrations or commit; user reruns the original pnpm sdlc command with its existing filters. No API/web pass is implied by prior gates.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REGRESSION-014 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
