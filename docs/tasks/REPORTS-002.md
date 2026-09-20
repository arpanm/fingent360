# REPORTS-002 — Private report lifecycle

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - REPORTS-002 (DEV-011/017/021): Implemented and verified for the bounded scope. Users can delete an individual issued/failed/cancelled report, reclaim the100-report capacity, and see a clear confirmation/result. Dependencies: REPORTS-001/PRIVACY-001. Prompt: specify retained metadata and deletion semantics before code; add strict delete/capacity contracts and migration021 with metadata-only owned tombstones. Under consistent account/request/job locks, verify expected version/ownership, reco
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **REPORTS-002 (DEV-011/017/021): Implemented and verified for the bounded scope.** Users can delete an individual issued/failed/cancelled report, reclaim the100-report capacity, and see a clear confirmation/result. Dependencies: REPORTS-001/PRIVACY-001. Prompt: specify retained metadata and deletion semantics before code; add strict delete/capacity contracts and migration021 with metadata-only owned tombstones. Under consistent account/request/job locks, verify expected version/ownership, record deletion and physically remove private snapshot/job/issued content. Duplicate delete succeeds for the owner; original request-ID replay cannot recreate deleted content; a late worker cannot resurrect it. Queued/running work must be cancelled first. Prevent new-request abuse without blocking privacy deletion. Implement accessible mobile/keyboard delete confirmation/cancel/success, updated capacity and authoritative list refresh that cannot restore stale deleted cards; equivalent local persistence/replay behavior, export/account-deletion integration and precise limits for already-downloaded copies. Test real stored bytes removal, stale/foreign access, race/replay/late worker, capacity recovery, reload, offline zero-network and history/privacy. Reuse existing runner. IDs API224–226, WEB223–225, OFFLINE263–264; overlapping slow reads must not starve useful results. Root docs/status/gated commit follow; no automatic expiration or user-data deletion merely by deployment.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REPORTS-002 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Current acceptance review — 20 September 2026

Reviewed scope: Explicit individual report deletion, metadata-only tombstones, stored-byte removal, capacity reclamation, cancellation prerequisite, replay and late-worker resurrection prevention, authorization after waits, confirmation and recovery, authoritative refresh and equivalent durable offline behavior. Live source activation and physical-device release certification remain separate. Broader parent coverage is not completed.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789928359149-84609.
<!-- sdlc-validation:end -->
