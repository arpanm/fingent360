# ASSIST-001 — Configurable AI and query-based form suggestions

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - ASSIST-001 (UX-002E): Implemented; live provider validation pending configured provider/model acceptance. This restores the existing case/documentation ID in TODO, not a new feature. Request: configurable OpenAI, Gemini and Anthropic assistance, with query/history-based suggestions without credentials, no operator keys in investor forms. Scope/evidence: apps/api/src/assistance.ts, apps/web/src/SmartHelp.tsx, docs/development/assistance.md and existing ASSIST-001 cases. Detailed Codex promp
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** No new code decision. Use existing provider/offline choices; collect actual validation and activation evidence.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **ASSIST-001 (UX-002E): Implemented; live provider validation pending configured provider/model acceptance.** This restores the existing case/documentation ID in TODO, not a new feature. Request: configurable OpenAI, Gemini and Anthropic assistance, with query/history-based suggestions without credentials, no operator keys in investor forms. Scope/evidence: apps/api/src/assistance.ts, apps/web/src/SmartHelp.tsx, docs/development/assistance.md and existing ASSIST-001 cases. Detailed Codex prompt: maintain strict grounded suggestion responses, explicit Apply/Dismiss, original input/context provenance, late-response protection, owned-data boundaries and deterministic fallback with truthful provider metadata. Never manufacture financial facts or silently change a form. Update existing API/browser cases and all task/documentation status when provider behavior changes; execution remains user-run. Missing credentials do not mean query suggestions are unimplemented.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on ASSIST-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Validation + activation
- **User input needed now:** No for the independent next step.
- **Decision:** Do not reimplement authored functionality or assume keys are absent. Existing provider choice is settled; actual configuration and device/live acceptance must be evidenced.
- **Recorded answer / authority:** User requested configurable OpenAI/Gemini/Anthropic and query fallback, with offline Android testing before later server/CDN deployment.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** Only ask for the exact missing environment/account or device observation after the task’s documented validation identifies it. Never request secrets in chat.
- **Next action:** No new code decision. Use existing provider/offline choices; collect actual validation and activation evidence.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789569622822-36573.
<!-- sdlc-validation:end -->
