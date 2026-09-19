# REPORTS-002 — Private report lifecycle

- **Status:** Completed (recorded scope)
- **Implemented / recorded:** - REPORTS-002 (DEV-011/017/021): Implemented and verified for the bounded scope. Users can delete an individual issued/failed/cancelled report, reclaim the100-report capacity, and see a clear confirmation/result. Dependencies: REPORTS-001/PRIVACY-001. Prompt: specify retained metadata and deletion semantics before code; add strict delete/capacity contracts and migration021 with metadata-only owned tombstones. Under consistent account/request/job locks, verify expected version/ownership, reco
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **REPORTS-002 (DEV-011/017/021): Implemented and verified for the bounded scope.** Users can delete an individual issued/failed/cancelled report, reclaim the100-report capacity, and see a clear confirmation/result. Dependencies: REPORTS-001/PRIVACY-001. Prompt: specify retained metadata and deletion semantics before code; add strict delete/capacity contracts and migration021 with metadata-only owned tombstones. Under consistent account/request/job locks, verify expected version/ownership, record deletion and physically remove private snapshot/job/issued content. Duplicate delete succeeds for the owner; original request-ID replay cannot recreate deleted content; a late worker cannot resurrect it. Queued/running work must be cancelled first. Prevent new-request abuse without blocking privacy deletion. Implement accessible mobile/keyboard delete confirmation/cancel/success, updated capacity and authoritative list refresh that cannot restore stale deleted cards; equivalent local persistence/replay behavior, export/account-deletion integration and precise limits for already-downloaded copies. Test real stored bytes removal, stale/foreign access, race/replay/late worker, capacity recovery, reload, offline zero-network and history/privacy. Reuse existing runner. IDs API224–226, WEB223–225, OFFLINE263–264; overlapping slow reads must not starve useful results. Root docs/status/gated commit follow; no automatic expiration or user-data deletion merely by deployment.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REPORTS-002 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

<!-- sdlc-validation:start -->

## Automated validation

Selected cases passed — acceptance matrix needed. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789752953639-97020.
<!-- sdlc-validation:end -->
