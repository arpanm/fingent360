# RECOVERY-001 — Recover account access

- **Status:** Completed (recorded scope)
- **Implemented / recorded:** - RECOVERY-001 (DEV-007/017): Implemented and verified for the bounded scope. Let a user explicitly create a strong recovery code while authenticated, retain it privately, and reset a forgotten password using that code without email/provider dependencies. Prompt: specify one-time display, hashing, rotation/consumption, password confirmation, session revocation, generic failure and abuse bounds; add strict contracts and migration018, secure API and account/privacy UI, accessible mobile recove
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **RECOVERY-001 (DEV-007/017):** Implemented and verified for the bounded scope. Let a user explicitly create a strong recovery code while authenticated, retain it privately, and reset a forgotten password using that code without email/provider dependencies. Prompt: specify one-time display, hashing, rotation/consumption, password confirmation, session revocation, generic failure and abuse bounds; add strict contracts and migration018, secure API and account/privacy UI, accessible mobile recovery flow, local-device equivalent with preserved data, and API/browser/offline tests for reuse/rotation, ownership, failed attempts, reload and export exclusion. Never expose password/recovery hashes or claim email/verified identity. A blocked IP/device budget must short-circuit before allocating more per-user counters; saturate counters and cover cardinality after limit. Mask displayed recovery codes in feedback screenshots and verify actual captured pixels without uploading the code. Root integrates shared export/router registration. Reserved API/WEB210–219, OFFLINE250–259.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on RECOVERY-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789709592634-72179.
<!-- sdlc-validation:end -->
