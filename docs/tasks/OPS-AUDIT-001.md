# OPS-AUDIT-001 — Operations audit history

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - OPS-AUDIT-001 (DEV-015/017/021): Implemented and verified for the bounded scope;34 connected scenarios passing across corrections and selected offline passes. Detailed Codex prompt: inspect existing immutable operator_audit rows and request-stage insertion semantics; specify a protected bounded audit-history browser without representing requests as completed work. Add strict filter/cursor/result contracts, keyset pages with stable upper bound, fixed safe event projection and authenticated
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **OPS-AUDIT-001 (DEV-015/017/021): Implemented and verified for the bounded scope;34 connected scenarios passing across corrections and selected offline passes.** Detailed Codex prompt: inspect existing immutable operator_audit rows and request-stage insertion semantics; specify a protected bounded audit-history browser without representing requests as completed work. Add strict filter/cursor/result contracts, keyset pages with stable upper bound, fixed safe event projection and authenticated read API using existing storage, final wall-clock session checks after waits and no token/session hashes, credentials, raw URLs/query/body or private financial/feedback content. Never invent operator identity; omit correlation unless safely justified. UI under Operations: filters→results→more→reset/retry/Back, loading/empty/error/expired sign-in, keyboard/mobile and stale-response invalidation, accurate dates and clear links to existing module-specific completion receipts where known without hidden joins/copies. No mutation of audit history or new background work; existing database immutability remains. Local Operations gives connected-only/noAPI explanation. Author product spec, contracts/API/component, real isolated API480–499/browser WEB480–499/OFFLINE490–509 and focused pagination/safe-projection units as needed, including actual recorded operator actions, filters/pages, unchanged audit rows, invalid inputs, post-wait expiry, no secrets/private bodies and late response privacy clearing. Prefer no migration/dependency; reserve034 only with concrete justification. Parent integrates one child at a time, updates README/TODO/catalog/coverage/status, runs authorized gates and commits locally. Agent does not execute tests/builds/install/migrations/provider/services/commits; no push. Named roles, successful-action attribution and approval separation remain explicit broader work.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on OPS-AUDIT-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Current acceptance review — 20 September 2026

Reviewed scope: Protected read-only request-stage audit history, safe projection, exact pagination/filtering, expiry/revocation/recovery, immutable originals and connected-only local behavior. Request rows do not certify completed actions. This covers only the recorded child, not broader parents or source activation.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789928359149-84609.
<!-- sdlc-validation:end -->
