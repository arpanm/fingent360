# RECOVERY-001 — Recover account access

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - RECOVERY-001 (DEV-007/017): Implemented and verified for the bounded scope. Let a user explicitly create a strong recovery code while authenticated, retain it privately, and reset a forgotten password using that code without email/provider dependencies. Prompt: specify one-time display, hashing, rotation/consumption, password confirmation, session revocation, generic failure and abuse bounds; add strict contracts and migration018, secure API and account/privacy UI, accessible mobile recove
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **RECOVERY-001 (DEV-007/017):** Implemented and verified for the bounded scope. Let a user explicitly create a strong recovery code while authenticated, retain it privately, and reset a forgotten password using that code without email/provider dependencies. Prompt: specify one-time display, hashing, rotation/consumption, password confirmation, session revocation, generic failure and abuse bounds; add strict contracts and migration018, secure API and account/privacy UI, accessible mobile recovery flow, local-device equivalent with preserved data, and API/browser/offline tests for reuse/rotation, ownership, failed attempts, reload and export exclusion. Never expose password/recovery hashes or claim email/verified identity. A blocked IP/device budget must short-circuit before allocating more per-user counters; saturate counters and cover cardinality after limit. Mask displayed recovery codes in feedback screenshots and verify actual captured pixels without uploading the code. Root integrates shared export/router registration. Reserved API/WEB210–219, OFFLINE250–259.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on RECOVERY-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Current acceptance review — 20 September 2026

Reviewed scope: Explicit authenticated strong recovery-code creation and one-time display, rotation and single-use consumption, confirmed password reset, revoked sessions and serialized old-password login, preserved owned records, generic bounded failures and counter cardinality, export exclusion, keyboard and mobile recovery, durable on-device equivalence and masking in actual feedback captures. No email or verified-identity claim. Physical-device release certification and wider parent requirements remain separate.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789846773980-36608.
<!-- sdlc-validation:end -->
