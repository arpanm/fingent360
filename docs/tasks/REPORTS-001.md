# REPORTS-001 — Saved research reports

- **Status:** Completed (recorded scope)
- **Implemented / recorded:** - REPORTS-001 (DEV-011/016/021): Implemented and verified for the bounded scope. Request and reopen an immutable record review of actual owned goals/holdings, with provenance and missing-market-data boundaries. Prompt: specify report inputs/output and deterministic no-growth policy; implement migration019 with PostgreSQL jobs, leases, bounded retries, idempotency, cancellation and immutable issued snapshots; real account-scoped status/history/download API, mobile/keyboard UI and retry/recove
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **REPORTS-001 (DEV-011/016/021):** Implemented and verified for the bounded scope. Request and reopen an immutable record review of actual owned goals/holdings, with provenance and missing-market-data boundaries. Prompt: specify report inputs/output and deterministic no-growth policy; implement migration019 with PostgreSQL jobs, leases, bounded retries, idempotency, cancellation and immutable issued snapshots; real account-scoped status/history/download API, mobile/keyboard UI and retry/recovery, offline local equivalent that resumes on next open, export/deletion integration, and meaningful API/browser/offline tests including worker crash/expired lease, duplicate request, ownership and unchanged issued output after edits. No trades, fabricated prices, scheduled external delivery or investment recommendation. Reserved API/WEB220–229, OFFLINE260–269.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REPORTS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789569622822-36573.
<!-- sdlc-validation:end -->
