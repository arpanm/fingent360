# EVENT-EXTRACTION-001 — source-bound event drafting

- **Status:** Implementation complete; validation pending
- **Implemented / recorded:** - Implementation: Implemented; user validation pending. Parents: DEV015/020; reuses admitted discovery sources, event drafts and existing OpenAI/Gemini/Anthropic configuration. Complete the extraction-to-review gap from actual retained published source editions. Operator explicitly selects one source/version and requests a bounded candidate. Keyless mode supplies exact source-bound title/excerpt fields as a clearly labelled starting draft, without inferring actors, sectors, instruments, dates or causal effects. Configured AI may select/order only complete exact source excerpts under strict schema; metadata is human-authored; source claims and unknown dates cannot be invented. Treat source/model text as data; no tools, arbitrary links or private account context. Bind captured source hash/version, method/provider/model and request identity to immutable candidate/attempt receipts, retain safe outcomes and precise failure/retry state, never raw keys or arbitrary provider output. Revalidate source/identity/session after waits and before saving the candidate or creating a normal event draft. Human edits/review remain required; candidate creation never publishes. Support inspect/edit-to-event/decline, immutable exact replay and separate current source state, named prepare permissions, loading/empty/error/401/stale/mobile/keyboard UI, and offline explanation of connected-only preparation while published results use existing event snapshots. Author migration047 if needed, API/WEB/OFFLINE850–869, synthetic-labelled real-storage plus bounded transport cases, docs and trackers. Never run providers/gates/commit; preserve causal-policy and identity-adjudication gaps.
- **Pending:** Resolve outstanding bugs and complete the current acceptance matrix; see generated validation below.
- **Next action / inputs:** User runs the story acceptance command after resolving recorded bugs.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### EVENT-EXTRACTION-001 — source-bound event drafting

- **Implementation: Implemented; user validation pending. Parents: DEV015/020; reuses admitted discovery sources, event drafts and existing OpenAI/Gemini/Anthropic configuration.** Complete the extraction-to-review gap from actual retained published source editions. Operator explicitly selects one source/version and requests a bounded candidate. Keyless mode supplies exact source-bound title/excerpt fields as a clearly labelled starting draft, without inferring actors, sectors, instruments, dates or causal effects. Configured AI may select/order only complete exact source excerpts under strict schema; metadata is human-authored; source claims and unknown dates cannot be invented. Treat source/model text as data; no tools, arbitrary links or private account context. Bind captured source hash/version, method/provider/model and request identity to immutable candidate/attempt receipts, retain safe outcomes and precise failure/retry state, never raw keys or arbitrary provider output. Revalidate source/identity/session after waits and before saving the candidate or creating a normal event draft. Human edits/review remain required; candidate creation never publishes. Support inspect/edit-to-event/decline, immutable exact replay and separate current source state, named prepare permissions, loading/empty/error/401/stale/mobile/keyboard UI, and offline explanation of connected-only preparation while published results use existing event snapshots. Author migration047 if needed, API/WEB/OFFLINE850–869, synthetic-labelled real-storage plus bounded transport cases, docs and trackers. Never run providers/gates/commit; preserve causal-policy and identity-adjudication gaps.
- **Reusable Codex prompt:** Read AGENTS, README, this task and docs/product/event-extraction.md. Design strict source selection/excerpt entitlement before code. Reuse existing private provider adapters without adding keys to the browser or a second fake provider abstraction. Implement operator request→retained candidate→explicit normal draft→independent existing publication, all exact bindings/replay/withdrawal/expiry and guided UI states. No invented source facts or direct model-to-publication path. Write meaningful tests and handoff, no deterministic execution.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on EVENT-EXTRACTION-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Validation only
- **User input needed now:** No for the independent next step.
- **Decision:** No new feature input needed. Implementation is already recorded; do not put this in the implementation queue solely because tests are unrun. Match saved failures to this task before authoring a repair.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** User-owned SDLC/test evidence is needed for verification. The report observed during triage is incomplete; no new full run is requested.
- **Next action:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.

## Current acceptance review — 20 September 2026

Reviewed scope: Source-bound template or configured exact-excerpt selection, immutable attempt/candidate receipts, explicit human metadata and normal draft creation, independent named publication, replay/conflict/quota/concurrency/storage/source/session races, truthful provider fallback, keyboard/source-preview/recovery workflow and connected-only offline preparation with published-event access. No causal policy, automatic entity identification or model-to-publication path. Wider parents, actual source permissions, operational provider activation and native release certification remain separate; gaps listed in externalGates prevent automatic Done.

The required API, browser-project and offline case IDs are now explicit in [acceptance.json](acceptance.json). Only actual current receipts plus successful normal gates can close this scope. Existing API/contracts/database/source workflows are reused; a matrix correction itself adds no migration or source permission. Physical-device and deployment claims require their separate evidence. The user authorized this validation/repair run; older manual-only handoff wording is historical for this run.

No additional input is needed for this bounded automated scope. Run the complete required matrix and review attached keyboard/narrow-layout artifacts where applicable before claiming accepted delivery.

<!-- sdlc-validation:start -->

## Automated validation

Stale — rerun required. [Evidence](../validation/README.md); [bugs](../bugs/README.md). Latest reconciliation: 1789923079896-69469.
<!-- sdlc-validation:end -->
