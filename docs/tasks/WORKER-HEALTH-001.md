# WORKER-HEALTH-001 — Background worker health

- **Status:** Done (recorded scope)
- **Implemented / recorded:** - WORKER-HEALTH-001 (DEV-015/021): Implemented and selected verification passed; physical/production acceptance remains separate. Make existing report/reminder worker health and explicit pause/resume visible in Operations. Detailed Codex prompt: inspect the existing leased report worker and in-app reminder worker, then specify aggregate heartbeat/last-success/bounded safe failure classification, queue age/due/expired-lease counts, stale versus unavailable, and control semantics. Add strict c
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

Status reconciliation (2026-09-16): Done refers to the previously recorded bounded delivery, not fresh validation of the current working tree. No new implementation or test pass is claimed.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **WORKER-HEALTH-001 (DEV-015/021): Implemented and selected verification passed; physical/production acceptance remains separate.** Make existing report/reminder worker health and explicit pause/resume visible in Operations. Detailed Codex prompt: inspect the existing leased report worker and in-app reminder worker, then specify aggregate heartbeat/last-success/bounded safe failure classification, queue age/due/expired-lease counts, stale versus unavailable, and control semantics. Add strict contracts and additive migration030 for minimal bounded worker state, immutable control audit/idempotency and expected versions. Authenticate operators after waits; prevent new claims after a committed pause across multiple worker processes, while explicitly documenting allowed completion of already claimed work. Resume/restart must preserve job/reminder uniqueness, leases and original outcomes; no arbitrary retries, private report snapshots/reminder titles, raw exception strings, provider fetches or financial mutations. Build Operations → Worker health → current summary/details → review pause/resume → receipt/history, including initial-load failures, Retry, historical versus current context, conflicting operators, session401, keyboard/Back/mobile. Offline explains connected operator requirement and performs no API requests. Author actual isolated worker/database/API and desktop/mobile cases for failed reads, expired leases, pauses/races/restart/recovery, redacted counts, authorization and audit retention; no synthetic successful responses. Reserve API350–369, WEB350–369, OFFLINE380–389. Do not expand into general monitoring infrastructure. Parent serially integrates shared worker/app registrations and trackers, runs gates/tests and makes the scoped local commit; agents do not execute services, tests, gates, migrations or provider calls.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on WORKER-HEALTH-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789709592634-72179.
<!-- sdlc-validation:end -->
