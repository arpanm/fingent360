# ALLOCATIONS-001 — Allocate holdings to goals

- **Status:** Done (accepted scope)
- **Implemented / recorded:** - ALLOCATIONS-001 (DEV-009/016/019): Implemented and verified for the bounded scope. Connect real saved goals to exact quantities of owned holdings. Specify quantity units and cost attribution first; persist immutable allocation revisions, prevent cross-account and double allocation, reject stale inputs, and make removed/reduced holdings visibly require review. Deliver guided choose → review → save → edit/history, no-growth contribution context without treating cost as market value; shared o
- **Pending:** None for the reviewed acceptance scope; native release certification remains separate.
- **Next action / inputs:** No further action for this accepted scope.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **ALLOCATIONS-001 (DEV-009/016/019):** Implemented and verified for the bounded scope. Connect real saved goals to exact quantities of owned holdings. Specify quantity units and cost attribution first; persist immutable allocation revisions, prevent cross-account and double allocation, reject stale inputs, and make removed/reduced holdings visibly require review. Deliver guided choose → review → save → edit/history, no-growth contribution context without treating cost as market value; shared offline behavior, export/deletion and meaningful API/browser/offline cases. Dependencies: existing accounts/goals/holdings; no live prices needed. Prompt: read current contracts and lifecycle, add allocation contracts and migration017, reuse exact arithmetic, coordinate holding/goal mutations with allocation checks, implement responsive accessible UI and local transport parity, test concurrent oversubscription, stale revisions, removal, reload/history, privacy and recovery. Document all layer acceptance and limits. Reserved API/WEB200–209, OFFLINE240–249.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ALLOCATIONS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Current acceptance review — 20 September 2026

Reviewed scope: Exact owned holding quantities allocated to saved goals, immutable revisions and history, no oversubscription, stale-input and removed or reduced-record review, guided consent, edit and release, authorization after waits, export, deletion and durable offline parity. Acquisition cost is not market value. Live source activation and physical-device release certification remain separate. Broader parent coverage is not completed.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Passed — automated acceptance. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789848189876-42077.
<!-- sdlc-validation:end -->
