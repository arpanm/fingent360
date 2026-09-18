# RETENTION-001 — Delete expired private data

- **Status:** Completed (recorded scope)
- **Implemented / recorded:** - RETENTION-001 (DEV-017/021): Implemented and integration verified for fixed existing-expiry cleanup. Operator previews and explicitly runs bounded cleanup using existing expiry rules; no timer or arbitrary new financial retention policy. Prompt: specify fixed allowed tables/predicates and exact server cutoff; add migration022 for durable count-only maintenance previews/results and strict contracts. Build authenticated Origin-protected Operations preview → explicit confirmation → bounded tr
- **Pending:** No new action for the recorded scope; later changes need new validation.
- **Next action / inputs:** No new action for the recorded scope; later changes need new validation.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **RETENTION-001 (DEV-017/021): Implemented and integration verified for fixed existing-expiry cleanup.** Operator previews and explicitly runs bounded cleanup using existing expiry rules; no timer or arbitrary new financial retention policy. Prompt: specify fixed allowed tables/predicates and exact server cutoff; add migration022 for durable count-only maintenance previews/results and strict contracts. Build authenticated Origin-protected Operations preview → explicit confirmation → bounded transactional cleanup → results/history with idempotent retry and concurrency safety. Eligible scope: already-expired/revoked account/operator sessions, expired login/recovery counters, expired feedback content/attachments using existing30-day policy while preserving deletion/idempotency tombstone metadata, old rate windows and expired unconfirmed holdings previews (retain confirmation receipts). Reuse current deadlines; never delete active financial histories, issued reports, source evidence, fresh sessions or current feedback. No usernames/tokens/addresses/body data in preview/audit. Show capped counts/more-available truthfully, failure/retry and keyboard/mobile states. Test real isolated expired/fresh rows, authorization/Origin, two operators/replay, crash/rollback and count audit; offline explains connected operator requirement and performs no API traffic. IDs API250–259, WEB250–259, OFFLINE280–289. Root never invokes cleanup on the user's application data as part of verification.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on RETENTION-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

<!-- sdlc-validation:start -->

## Automated validation

Failed — unresolved bug. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789669163056-59061.
<!-- sdlc-validation:end -->
