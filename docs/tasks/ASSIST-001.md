# ASSIST-001 — Configurable AI and query-based form suggestions

- **Status:** Completed implementation; new validation and provider/device acceptance pending
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

## Current acceptance review — 20 September 2026

Reviewed scope: Configurable grounded OpenAI, Gemini and Anthropic assistance and truthful deterministic query fallback, explicit consent for optional owned-history context, original reference binding, credentials restricted to server configuration, explicit Apply or Dismiss, no silent saved-data changes and strict rejection of unsupported provider text. Full task retains configured live provider and documented offline acceptance requirements. Physical-device release certification and wider parent requirements remain separate.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

Remaining gates:

- Saved acceptance for configured provider/model choices is explicitly pending in ASSIST-001; fallback is not a live-provider pass.
- Confirm documented offline assistance/query acceptance; located existing ASSIST-001 cases cover connected API/browser and normal check-gate adapter fixtures, not a complete offline browser workflow.

## Focused acceptance repair — 20 September 2026

Empty provider suggestions previously replaced valid query defaults before rejection. Validate the provider result before assigning it; API1120 requires exact query fallback while preserving encrypted rejected output and final outcome. No database or contract change.

Evidence: connected run2026-09-19T19-40-29-161Z-37323 completed76 passes and10 failures. Repair authored; subsequent validation pending. User explicitly authorized agent execution for this closure pass. Reuse the existing specification and full acceptance matrix; no dependencies or migrations added.

## Remaining completion gates — 20 September 2026

The complete current automated matrix passed. The reviewed manifest retains these separate requirements; rerunning passing cases does not satisfy them:

- Saved acceptance for configured provider/model choices is explicitly pending in ASSIST-001; fallback is not a live-provider pass.
- Confirm documented offline assistance/query acceptance; located existing ASSIST-001 cases cover connected API/browser and normal check-gate adapter fixtures, not a complete offline browser workflow.

## Offline assistance completion specification — 20 September 2026

The shared web/app help must offer the same authored field explanations and editable
query-derived goal names without a server. Query help uses only downloaded content
and explicitly selected own-device history; it must never imply a cloud request or
silently edit a form. Add explicit empty and Dismiss states and keep Apply explicit.
Author offline browser acceptance for name application, history opt-in/withdrawal,
reload and zero API/provider network transport. Existing connected API/browser
coverage remains. Reuse current assistance contracts/storage; no migration or key
change. Configured live-model acceptance remains an independent requirement.

Implementation now shares authored field explanations and query-derived names
through `assistanceTemplates` in contracts, consumed by connected and offline help.
The shared UI identifies on-device matching correctly, clears old query results on
edit, offers Dismiss, and explains no matches. OFFLINE150 authors a real local
account/goal workflow with explicit Apply, history opt-in/withdrawal, reload and
no network requests; WEB/API150 remain companions. No data migration or provider
call is needed for this deterministic path. No validation was run for these edits.

Manual next action: `pnpm sdlc "Complete offline assistance" --story ASSIST-001`.
Use the runner's connected and offline projects; installed Android additionally
needs rebuilt assets/snapshot and reinstall. A passing query test does not validate
configured OpenAI/Gemini/Anthropic model calls or physical-device behavior.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789926953092-78982.
<!-- sdlc-validation:end -->
