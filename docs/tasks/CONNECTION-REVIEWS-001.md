# CONNECTION-REVIEWS-001 — Review evidence connections

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - CONNECTION-REVIEWS-001 (DEV-010/012/016/017): Implemented and verified;54/54 connected,7/7 offline regressions,110unit gates. A durable private review inbox helps users revisit their own research connections when a source edition or owned financial record changes. Detailed Codex prompt: specify explicit Check for updates → consistent current evaluation → coalesced saved review notices → open original connection/source context → acknowledge, with acknowledgement separate from reaffirmation.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **CONNECTION-REVIEWS-001 (DEV-010/012/016/017): Implemented and verified;54/54 connected,7/7 offline regressions,110unit gates.** A durable private review inbox helps users revisit their own research connections when a source edition or owned financial record changes. Detailed Codex prompt: specify explicit Check for updates → consistent current evaluation → coalesced saved review notices → open original connection/source context → acknowledge, with acknowledgement separate from reaffirmation. Reuse actual owned connection receipts and existing permitted publications; no inferred financial impact, prices, recommendations, email/push, timer or provider query. Add strict runtime contracts and additive migration027 for owned bounded notices/evaluation receipts with explicit checked-at/bundle dates, deterministic state fingerprints, idempotency and account cascade. Serialize account/source evaluation locks, recheck wall-clock authentication after waits, retain immutable original connection receipts and never copy withdrawn source text. Repeated same-state checks do not duplicate notices or undo acknowledgement; a materially changed current state may reopen one coalesced connection notice. Removed connections resolve their active notice without resurrecting it. Concurrent checks/acknowledgement, source withdrawal, changed/deleted goals/holdings, stale expected versions and foreign ownership need concrete conflict/replay behavior and no mutation of financial records. Build responsive Review inbox under My money/More/connections with checked-at context, loading/empty/up-to-date/error/retry, status filters/counts, open receipt, keyboard/Back/focus and explicit acknowledge feedback; an acknowledged notice is not a claim that the connection is current or reaffirmed. Current-source links require authoritative current availability. Implement equivalent serialized on-device storage using dated real bundle without any API traffic, export/account deletion and reload persistence; no automatic cloud synchronization. Tests must exercise actual isolated API/database and browser workflows with copied permitted source evidence, explicit synthetic edition/fault changes, exact unchanged finances, coalescing/ack/reopen/removal/replay/privacy and offline zero-network. Reserve API310–319, WEB310–319, OFFLINE340–349. Author writes spec/code/tests/handoff in isolated worktree reading frozen evidence-links dependency only; parent integrates prerequisites and shared trackers, runs gates and commits this child separately. No tests/services/builds/migrations/provider calls or commits by agent; no push.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on CONNECTION-REVIEWS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Current acceptance review — 20 September 2026

Reviewed scope: Manual review checks against owned research connections, durable dated coalesced notices, acknowledgement, reopen and resolution, receipt and current-context distinction, navigation and recovery, concurrent, replay, capacity and session controls, export, deletion and serialized offline parity. Live source activation and physical-device release certification remain separate. Broader parent coverage is not completed.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789923079896-69469.
<!-- sdlc-validation:end -->
