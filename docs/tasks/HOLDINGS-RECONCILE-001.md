# HOLDINGS-RECONCILE-001 — Reconcile imported holdings

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - HOLDINGS-RECONCILE-001 (DEV-008/SRC-013): Implemented and verified for the bounded scope;31connected and14offline passes. Show exactly what a holdings replacement will change before confirmation. Detailed Codex prompt: read current manual/CSV/XLSX preview/confirm/idempotency/version rules, exact decimal contracts, allocations/research connections, privacy and actual offline storage. Specify baseline → proposed rows → added/removed/changed/unchanged quantities and acquisition costs → explic
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **HOLDINGS-RECONCILE-001 (DEV-008/SRC-013): Implemented and verified for the bounded scope;31connected and14offline passes.** Show exactly what a holdings replacement will change before confirmation. Detailed Codex prompt: read current manual/CSV/XLSX preview/confirm/idempotency/version rules, exact decimal contracts, allocations/research connections, privacy and actual offline storage. Specify baseline → proposed rows → added/removed/changed/unchanged quantities and acquisition costs → explicit removal acknowledgement → confirm/replay/conflict. Capture the actual owned baseline edition in a durable preview, calculate signed differences with exact integer/scaled arithmetic and disclose missing values/currencies; recorded cost is not market value or performance. Review changes and aggregate declared reconciliation alongside existing parser provenance, never silently net unlike instruments or currencies. Reuse existing preview JSONB when sound, otherwise additive migration031; never change an applied migration. Confirm must bind the exact reviewed baseline and proposed rows, reject intervening holdings changes without mutation, preserve original successful request replay, and explicitly recover stale/expired/unreadable previews. Explain existing allocation/connection review consequences using real dependencies without silently modifying them. Cover manual entry/CSV/XLSX, initial holdings, complete removal and retained rows, empty/error/retry/Back/draft/removal consent, keyboard/mobile and exact saved receipt. Mirror actual serialized device storage/export/deletion, no API in device mode and no raw private workbook retention. Cases use actual isolated DB/API and owned browser/offline workflows, labelled synthetic holdings/locks/faults, strict foreign/Origin/session-expiry/post-wait rules, concurrent preview/confirm/replay and unchanged unrelated finances. Reserve API400–419, WEB400–419, OFFLINE410–429 plus meaningful unit arithmetic cases. Author spec/code/tests/handoff in assigned worktree only; parent registers shared trackers, integrates, runs authorized gates/migrations/tests and commits separately. No agent execution/install/provider calls/services/commits; no push. Arbitrary broker formats, prices and investment advice remain outside this child.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on HOLDINGS-RECONCILE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Reviewed completion definition — 2026-09-19

Exact baseline-to-proposed holdings reconciliation, additions/removals/cost deltas, explicit removal acknowledgement, stale/expired preview recovery, immutable successful replay, dependency disclosure and shared offline export/deletion. Broker-specific parsing and market valuations remain separate.

The reviewed case/project requirements and conditional completion metadata are now in `docs/tasks/acceptance.json`. [Layer review, coverage and manual commands](../development/main-module-closure-2026-09-19.md). This is not a test pass: generated validation blocks and bug states are preserved. No runtime/API/database rewrite is justified for an already implemented workflow solely because its acceptance mapping was missing. The new portfolio guided offline UI case closes a coverage gap; existing connected/private/offline cases are reused.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789923079896-69469.
<!-- sdlc-validation:end -->
