# DELIVERY-TEAM-004 — nine end-to-end workstreams

- **Status:** Partial
- **Implemented / recorded:** Nine workstreams have authored code and cases; two have their bounded implementation authored, seven retain functional gaps.
- **Pending:** The seven partial workstreams must be completed; no batch-wide validation or new APK is established.
- **Next action / inputs:** Developer: complete linked partial children; user-run gates remain separate.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

See [current delivery summary](current-delivery.md) for the batch-wide distinction between code, missing functionality and validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### DELIVERY-TEAM-004 — nine end-to-end workstreams

- **Status:** Authored batch integrated; broader requirements remain partial as listed below; verification not run. User requests nine agents, each covering spec, web/Android-shared UX, contracts/API, storage/migrations, real sources, test authoring and docs. Run in waves under the session concurrency limit. Additional thread creation was rejected after the first four workers; completed workers are reused for separately scoped workstreams. No tests, builds, migrations, ingestion jobs or commits are executed by agents.
- **Acceptance:** Each child delivers connected UI/loading/error/recovery paths, strict persisted contracts and replay/provenance, authored real-path E2E/fixtures and explicit source/format evidence. No invented live data, guessed broker formats or synthetic-only completion claims. Shared integration and root trackers owned by parent.
- **Reusable Codex prompt:** Implement the nine requested scopes below end to end in coordinated isolated file ownership. Research official source formats and rights using read-only web tools. Preserve existing flows and privacy, separate fact/scenario/inference, author golden cases, and supply focused manual validation commands. Do not execute deterministic work or claim unverified completion.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on DELIVERY-TEAM-004 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Follow child tasks
- **User input needed now:** No for the independent next step.
- **Decision:** This is a rollup. Advance the linked incomplete children rather than duplicating their code or requesting a parent-level approval.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** If a concrete private input or external authorization becomes necessary, record the exact evidence and question before asking.
- **Next action:** Developer: complete linked partial children; user-run gates remain separate.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.
