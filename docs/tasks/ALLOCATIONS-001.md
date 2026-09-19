# ALLOCATIONS-001 — Allocate holdings to goals

- **Status:** Completed (recorded scope)
- **Implemented / recorded:** - ALLOCATIONS-001 (DEV-009/016/019): Implemented and verified for the bounded scope. Connect real saved goals to exact quantities of owned holdings. Specify quantity units and cost attribution first; persist immutable allocation revisions, prevent cross-account and double allocation, reject stale inputs, and make removed/reduced holdings visibly require review. Deliver guided choose → review → save → edit/history, no-growth contribution context without treating cost as market value; shared o
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **ALLOCATIONS-001 (DEV-009/016/019):** Implemented and verified for the bounded scope. Connect real saved goals to exact quantities of owned holdings. Specify quantity units and cost attribution first; persist immutable allocation revisions, prevent cross-account and double allocation, reject stale inputs, and make removed/reduced holdings visibly require review. Deliver guided choose → review → save → edit/history, no-growth contribution context without treating cost as market value; shared offline behavior, export/deletion and meaningful API/browser/offline cases. Dependencies: existing accounts/goals/holdings; no live prices needed. Prompt: read current contracts and lifecycle, add allocation contracts and migration017, reuse exact arithmetic, coordinate holding/goal mutations with allocation checks, implement responsive accessible UI and local transport parity, test concurrent oversubscription, stale revisions, removal, reload/history, privacy and recovery. Document all layer acceptance and limits. Reserved API/WEB200–209, OFFLINE240–249.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ALLOCATIONS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

<!-- sdlc-validation:start -->

## Automated validation

Selected cases passed — acceptance matrix needed. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789752953639-97020.
<!-- sdlc-validation:end -->
