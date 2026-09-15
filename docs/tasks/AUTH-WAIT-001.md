# AUTH-WAIT-001 — Recheck authorization after storage waits

- **Status:** Completed (recorded scope)
- **Implemented / recorded:** - AUTH-WAIT-001 (DEV-017/007): Implemented and integration verified. Requests admitted before waiting for account/report row locks can otherwise proceed after recovery revokes their session. Detailed Codex prompt: specify revocation/admission ordering, then recheck require(cookie) immediately after existing account locks in holdings preview/confirm, goal create/update/delete, allocation current/save and report request/delete before private reads/replay/writes. Report cancel/retry must acquir
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **AUTH-WAIT-001 (DEV-017/007): Implemented and integration verified.** Requests admitted before waiting for account/report row locks can otherwise proceed after recovery revokes their session. Detailed Codex prompt: specify revocation/admission ordering, then recheck require(cookie) immediately after existing account locks in holdings preview/confirm, goal create/update/delete, allocation current/save and report request/delete before private reads/replay/writes. Report cancel/retry must acquire account lock, recheck, then lock job; preserve canonical account→report lock order and session-independent workers. Keep positive workflows, ownership, idempotent receipts, exact values and all retention/XLSX/new research behavior unchanged. Add real isolated API cases using owned-schema blockers and observed pg_blocking_pids: queue actual recovery/reset ahead of old-cookie operations, release in controlled order, expect401 and unchanged private revisions/previews/job/tombstone/budget data. Include replay paths and actual cancel/retry wait variant; always release/drain owned resources. Add browser regression if needed to prove revoked-session UI clears private state and can sign in again, without fabricated successful API responses. Reserve API300–309 and WEB300–309. Existing table/session model is reused; no migration/provider work. On-device mode has serialized local state rather than PostgreSQL row locks, so document why this server race does not apply and retain existing local auth coverage. Agent authors isolated spec/code/tests/handoff only; parent updates shared trackers and gates/commits after prerequisite integrations. No permission/guard weakening, no user-data reset and no push.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on AUTH-WAIT-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.
