# SDLC-REPAIR-005 — SDLC script formatting

- **Status:** Partial
- **Implemented / recorded:** The recorded repair attempt did not change the scripts.
- **Pending:** Formatting repair stopped when the source changed during the attempt.
- **Next action / inputs:** Agent: inspect current formatting/error evidence; the old concurrent-edit incident needs no product decision.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-REPAIR-005 — SDLC script formatting

- **Context/scope:** Supplied `pnpm check` failure stops at Prettier warnings for `scripts/sdlc-impact.mjs` and `scripts/sdlc.mjs`. Manually correct layout only; preserve pending launcher work and completed commits.
- **Implementation/verification:** Blocked by concurrent source edits; no script repair applied. The inventory guard in `scripts/sdlc-impact.mjs` changed between inspection and patching, causing the patch to reject. Stabilize writers before a new scoped repair. Parent/user validation remains pending; no deterministic commands or commits executed.
- **Dependencies/layers:** Existing pinned Prettier; no dependency change. Runtime workflow, selection, API/contracts, UI/UX, database, provenance and automation behavior remain unchanged. Application E2E and new fixtures are not applicable to whitespace alone; existing launcher unit assertions remain intact.
- **Regression acceptance (SDLC-REPAIR-005-A/B):** A: `pnpm exec prettier --check scripts/sdlc-impact.mjs scripts/sdlc.mjs` exits 0 without warnings. B: review this repair's changes for layout-only edits and unchanged validation/selection expressions. Parent retries `pnpm check`; subsequent stages are unverified. No services or UI URL needed. Report exact command, exit code and flagged-file diagnostics on failure.
- **Reusable prompt:** Repair only the supplied two-script Prettier failure through manual layout edits under the existing configuration. Preserve all behavior, assertions, unrelated edits and commits. Update TODO, README and SDLC documentation with manual regression scenarios. Do not run formatting, checks, tests, SDLC, services, commits or delegates.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-REPAIR-005 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Input and pickup decision — 2026-09-15

- **Readiness:** Agent-ready
- **User input needed now:** No for the independent next step.
- **Decision:** The earlier source-edit collision was an operational incident, not a missing user answer. Confirm current source state and saved logs before changing anything; do not presume a stale failure remains.
- **Recorded answer / authority:** Existing user instruction: agent owns research/implementation decisions within scope; user owns deterministic validation.
- **Question status:** None now. Do not ask for a repeat of existing answers.
- **Later input trigger:** If a concrete private input or external authorization becomes necessary, record the exact evidence and question before asking.
- **Next action:** Agent: inspect current formatting/error evidence; the old concurrent-edit incident needs no product decision.
- **Research/evidence:** See [dated source checks and existing answers](input-research-2026-09-15.md). Source-specific permissions, complete parser layouts and legal classification are not claimed resolved by triage.
- **Completion boundary:** This updates readiness only, not test passes, live activation or full feature completion. On later pickup, refresh saved evidence and update this record plus the TODO row.
