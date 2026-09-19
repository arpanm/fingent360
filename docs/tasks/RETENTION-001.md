# RETENTION-001 — Delete expired private data

- **Status:** Done (accepted scope)
- **Implemented / recorded:** - RETENTION-001 (DEV-017/021): Implemented and integration verified for fixed existing-expiry cleanup. Operator previews and explicitly runs bounded cleanup using existing expiry rules; no timer or arbitrary new financial retention policy. Prompt: specify fixed allowed tables/predicates and exact server cutoff; add migration022 for durable count-only maintenance previews/results and strict contracts. Build authenticated Origin-protected Operations preview → explicit confirmation → bounded tr
- **Pending:** None for the reviewed acceptance scope; native release certification remains separate.
- **Next action / inputs:** No further action for this accepted scope.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **RETENTION-001 (DEV-017/021): Implemented and integration verified for fixed existing-expiry cleanup.** Operator previews and explicitly runs bounded cleanup using existing expiry rules; no timer or arbitrary new financial retention policy. Prompt: specify fixed allowed tables/predicates and exact server cutoff; add migration022 for durable count-only maintenance previews/results and strict contracts. Build authenticated Origin-protected Operations preview → explicit confirmation → bounded transactional cleanup → results/history with idempotent retry and concurrency safety. Eligible scope: already-expired/revoked account/operator sessions, expired login/recovery counters, expired feedback content/attachments using existing30-day policy while preserving deletion/idempotency tombstone metadata, old rate windows and expired unconfirmed holdings previews (retain confirmation receipts). Reuse current deadlines; never delete active financial histories, issued reports, source evidence, fresh sessions or current feedback. No usernames/tokens/addresses/body data in preview/audit. Show capped counts/more-available truthfully, failure/retry and keyboard/mobile states. Test real isolated expired/fresh rows, authorization/Origin, two operators/replay, crash/rollback and count audit; offline explains connected operator requirement and performs no API traffic. IDs API250–259, WEB250–259, OFFLINE280–289. Root never invokes cleanup on the user's application data as part of verification.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on RETENTION-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Saved full-inventory repair — 2026-09-19

The saved full run1789752953639-97020 includes failed cases tagged to this task. Confirmed causes, scoped authored repairs and remaining verification are recorded in [the full-audit RCA](../development/full-audit-2026-09-19.md). User runs `SDLC_AUTO_REPAIR=0 pnpm sdlc "Repair full audit failures" --story SDLC-REPAIR-016`. No new passing evidence or automatic bug resolution is claimed; this bounded repair does not remove broader source/device/functional requirements recorded above.

## Current acceptance review — 20 September 2026

Reviewed scope: Fixed existing-expiry cleanup only: explicit bounded preview/run, server cutoff, immutable count-only receipts/history, rollback/replay, current and issued-record preservation and connected-only device behavior. No automatic timer, arbitrary financial retention policy or production cleanup authorization. Completion applies only to this bounded child.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Passed — automated acceptance. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: final-scoped-1789857073654.
<!-- sdlc-validation:end -->
