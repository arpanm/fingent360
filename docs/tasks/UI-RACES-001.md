# UI-RACES-001 — Reliable feedback settings and financial-form input

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Complete. Feedback delivery controls mount only after persisted settings load; storage-open failure shows explicit Retry without a false empty history or default settings. Goal and holding step focus runs synchronously before interaction, removing animation callbacks that could steal input. WEB194 explicitly awaits ready settings. Validation, consent, financial precision, quotas, contracts and existing database records remain intact.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### UI-RACES-001 — Reliable feedback settings and financial-form input

- **Request / evidence:** Fix WEB194 and WEB060 failures in user run `2026-09-13T17-05-17-513Z-13848` (started17:05:18.311Z,139 completed,136passed/twofailed/one intentional outage skip; web5175/API4103). Feedback saved enabled instead of the requested paused state; goal input `12` appeared in the monthly contribution (`1000.0112`) while horizon remained120. These invalidate the earlier passing-run assumption for those timing paths.
- **Implementation:** Complete. Feedback delivery controls mount only after persisted settings load; storage-open failure shows explicit Retry without a false empty history or default settings. Goal and holding step focus runs synchronously before interaction, removing animation callbacks that could steal input. WEB194 explicitly awaits ready settings. Validation, consent, financial precision, quotas, contracts and existing database records remain intact.
- **Layers / acceptance:** Correct web/shared Android UI initialization and keyboard focus; retain existing API/contracts, databases and ownership because no schema/data change is needed. Deterministic delayed-load/focus regressions must reproduce the pre-fix failures, then both existing reported cases and desktop/mobile variants must pass. Persist only confirmed edits; retain offline behavior. Refresh tests/catalogue/coverage, README/status and APK if shared application code changes.
- **Codex prompt:** Read AGENTS, the exact saved run and failure snapshots, Goals.tsx step focus, FeedbackPage settings initialization and the two E2E cases. Identify why pause becomes enabled and horizon digits reach the amount field; reproduce through bounded controlled timing in tests using real local persistence/API where applicable. Fix application lifecycle ordering and test readiness, preserve strict decimal validation, consent, server quotas, existing accounts and migrations. Run the ongoing authorized focused test-and-fix workflow and final format/check gates, record exact evidence, rebuild shared Android delivery, then make a scoped local commit without push. Never claim an earlier run verifies the corrected timing path.
- **Verification:** Controlled pre-fix runs reproduced the defects: WEB067 `2026-09-13T17-12-59-569Z-14642`, WEB196 `2026-09-13T17-14-06-415Z-14740`, WEB095 `2026-09-13T17-15-56-628Z-14825`. After correction, run `2026-09-13T17-17-23-232Z-14992` passed **30/30** desktop/mobile executions with zero skips: WEB060,062–067,090,092–095,194,196–197. Real owned financial records and server feedback receipts were checked; delayed frames/database notifications and one storage failure are labelled simulations. Packaged offline run `1789319973827-a0096fe2-64b9-454c-86ce-ba2e03d8166a` passed **16/16**. Format/check passed, including **85 unit tests**. Code4 APK built and signature/package verified; exact hash and hardware limitations are in [status](../development/status.md). Existing working tree was clean at commit60dee3d before this correction. Final documentation is included in the pre-commit gates.
- **Manual next actions:** Reload the current web URL. In `E2E_BROWSER=chrome pnpm e2e:ui`, select WEB060/194 and @UI-RACES-001 in desktop/mobile, click Run with watch off; expect all pass. Existing web/API/PostgreSQL/MongoDB are required; no new dependency/migration/setup command is needed. Install the rebuilt code4 APK over code3 using the same key, preserving storage; verify paused feedback settings and goal/holding input in airplane mode. Send `artifacts/e2e/latest.md` if a case fails. Local commit follows successful format/check; never push.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on UI-RACES-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789836492361-20464.
<!-- sdlc-validation:end -->
