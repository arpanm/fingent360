# DEV-PORTS-001 — Automatic local port selection and dependency propagation

- **Status:** Implemented; validation pending
- **Implemented / recorded:** - Implementation: Implemented; manual verification pending
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### DEV-PORTS-001 — Automatic local port selection and dependency propagation

- **Restart follow-up:** User reports EADDRINUSE on 4101 after node watch restarts. The old API dev command reloads the shared env file, allowing a legacy session to adopt another session's selected port. Implementation: API dev wrapper snapshots env before watch starts and preserves root-selected environment values across restarts. Prompt: isolate each API watch session from subsequent .env changes without changing production start or migrations; preserve free-port selection and dependent configuration, document legacy-watcher restart, and commit locally. Verification pending; no services or checks executed. Stop pre-fix dev watchers once, then manually verify two new sessions retain distinct ports after a source edit.

- **Lint follow-up:** User reports formatting passed but ESLint rejected two side-effect ternaries in local-ports.mjs. Replaced them with explicit if/else branches, preserving process signaling and exit handling. Reusable prompt: fix the two no-unused-expressions violations without changing launcher behavior or weakening lint rules; update documentation and commit locally. Verification remains pending; manually rerun pnpm format and pnpm check.

- **Implementation:** Implemented; manual verification pending
- **Request:** User wants occupied ports resolved automatically for services and dependents informed, instead of manually killing listeners.
- **Scope:** Root dev launcher selects free API/web ports; local Compose wrapper reuses owned running DB mappings or selects available bindings and updates database URLs. Persist selections in .env; Vite proxy/API Origin checks/migrations/smoke/test targets consume these settings. E2E UI/report choose available listener ports. Never terminate unrelated listeners. Existing app/test sessions retain their launch configuration; new sessions use the latest selection.
- **Codex prompt:** Implement reusable bounded loopback port selection, process-group cleanup of spawned processes, managed Compose mapping detection, selective env updates preserving secrets, and dynamic test/config consumers. Author meaningful port/env regression cases and manual end-to-end acceptance; do not execute services, tests, migrations or port probes as Codex. Preserve existing user edits. Update README/TODO and commit locally without hooks or push.
- **Manual acceptance:** With the existing app running, pnpm dev must start on free app ports and reuse existing DB containers; new E2E UI targets those ports. A second E2E UI uses a different UI port. Auth registration remains valid on shifted web ports. Occupied non-project DB ports must cause different local bindings with corresponding URI changes. No volumes deleted or unrelated listeners stopped.

- **Cases:** tests/unit/local-ports.test.mjs covers occupied-port selection without stopping listeners, distinct assignments, URI preservation and env updates. Existing API/browser account/foundation cases verify dependency propagation on the chosen ports. No tests/format/build/port probes/container actions executed by Codex.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on DEV-PORTS-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
