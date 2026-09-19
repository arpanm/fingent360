# EVAL-LINEAGE-001 — Retained source, LLM call/output, final-view and feedback evaluation lineage

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** Source captures, model requests/raw outputs, composed-view records, feedback links and opt-in private history are authored.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

See [current delivery summary](current-delivery.md) for the batch-wide distinction between code, missing functionality and validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### EVAL-LINEAGE-001 — Retained source, LLM call/output, final-view and feedback evaluation lineage

- **Status:** Authored: actual public source/model/raw-output/composite-view/feedback lineage plus separately opted-in owner-only private request history, seven-day expiry/export/delete/offline consent. Verification not run; migration056 authored.
- **Scope:** Spec → shared web/app UI/UX → API/contracts → durable data/provenance → offline behavior → test cases → documentation. Record missing external access/format evidence explicitly; implement all independently possible layers.
- **Reusable prompt:** Deliver retained source, llm call/output, final-view and feedback evaluation lineage with real-source evidence, strict versioned data, complete navigation/recovery and authored API/browser/offline tests. Follow DELIVERY-TEAM-004 boundaries and provide precise integration notes.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on EVAL-LINEAGE-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Reviewed scope: Retained public source response/model transport/composed-view/feedback linkage and separately opted-in owner-only private request history, revoke and late-write erasure, local public context and offline consent. Stored view models are not rendered-pixel proof or automated evaluator scores. Wider parents, actual source permissions, operational provider activation and native release certification remain separate; gaps listed in externalGates prevent automatic Done.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

## Focused acceptance repair — 20 September 2026

API1120 confirms empty provider output discarded query fallback suggestions; assignment is now atomic. WEB1118 mobile confirms long raw-source hashes overflow the evaluation inspector; allow wrapping without truncating evidence. Existing encrypted lifecycle, raw export, ownership and layout assertions remain.

Evidence: connected run2026-09-19T19-40-29-161Z-37323 completed76 passes and10 failures. Repair authored; subsequent validation pending. User explicitly authorized agent execution for this closure pass. Reuse the existing specification and full acceptance matrix; no dependencies or migrations added.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: outage-final-1789852687840.
<!-- sdlc-validation:end -->
