# MEDIA-001 — Reviewed visual explainers

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - MEDIA-001 (UX-002F): Implemented reviewed SVG/caption/WebM workflow; live provider and physical playback acceptance pending. This restores the existing implementation/case ID in TODO. Request: engaging images/short videos for source-backed reading with three-provider configuration and no-key fallback. Evidence: apps/api/src/media.ts, apps/web/src/MediaSummary.tsx, migrations013–014, docs/development/media.md and API160/WEB160. Detailed Codex prompt: preserve original edition/source attribu
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** No new code decision. Use existing provider/offline choices; collect actual validation and activation evidence.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Embedded task brief

- **MEDIA-001 (UX-002F): Implemented reviewed SVG/caption/WebM workflow; live provider and physical playback acceptance pending.** This restores the existing implementation/case ID in TODO. Request: engaging images/short videos for source-backed reading with three-provider configuration and no-key fallback. Evidence: apps/api/src/media.ts, apps/web/src/MediaSummary.tsx, migrations013–014, docs/development/media.md and API160/WEB160. Detailed Codex prompt: preserve original edition/source attribution, idempotent once-per-edition prepare, strict complete-block caption selection, review before publication, withdrawal/mismatch denial, accessible playback/transcript/download and honest unsupported/fallback states. Update actual API/browser cases and docs; do not describe caption clips as cinematic generated footage or declare live provider validation from templates. Cinematic generation/adaptive curriculum are outside the accepted implemented child and remain explicit broader scope, not hidden work.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on MEDIA-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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

Reviewed scope: Reviewed source-version SVG illustration, complete-block caption selection/template fallback, idempotent preparation, publication and withdrawal, manual caption controls/transcript and real WebM caption-clip download or honest unsupported state. Cinematic generated video and adaptive curriculum excluded. Wider parents, actual source permissions, operational provider activation and native release certification remain separate; gaps listed in externalGates prevent automatic Done.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

Remaining gates:

- Save documented configured-provider metadata/fallback acceptance and physical playback/narrow-transcript visual review. API160/WEB160 cover connected preparation/review/withdrawal and browser decode, not live-provider or physical-device acceptance.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789847379056-38783.
<!-- sdlc-validation:end -->
