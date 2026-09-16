# SDLC-REPAIR-007 — Markdown table formatting

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** - Implementation: Replaced inconsistently padded tables with equivalent labelled lists and removed a surplus blank line in the flagged documents; retained commands and requirements.
- **Pending:** User: run the task’s documented validation; implementation is not a test pass.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### SDLC-REPAIR-007 — Markdown table formatting

- **Context/scope:** Supplied `pnpm check` stopped at Prettier warnings for README.md and docs/development/sdlc.md before later gates. Repair Markdown layout only, with this tracking entry and manual acceptance documentation; preserve unrelated changes and completed commits.
- **Implementation:** Replaced inconsistently padded tables with equivalent labelled lists and removed a surplus blank line in the flagged documents; retained commands and requirements.
- **Verification:** Pending parent/user retry; no formatting, checks, tests, services or commits executed. No suite report inspected.
- **Dependencies/layers:** Existing pinned Prettier, no dependency changes. Documentation and manual regression acceptance apply; product specification, UI/UX, API/contracts, runtime workflow, database, provenance, automation and executable E2E changes are not applicable to Markdown whitespace.
- **Acceptance:** SDLC-REPAIR-007-A checks all three edited Markdown files with Prettier and expects no warnings; SDLC-REPAIR-007-B reviews former table contents and command examples for preservation. See docs/development/sdlc.md for the exact command and failure evidence. Parent retries `pnpm check`; later gates remain unverified.
- **Reusable prompt:** Repair only the supplied README/SDLC Markdown formatting failure through manual layout edits, using equivalent labelled lists for inconsistently padded tables and removing surplus blank lines. Preserve content, examples, validation rules, unrelated changes and commits. Update TODO/README/SDLC manual regression scenarios. Author and inspect only; do not run formatting, checks, tests, SDLC, services, commits, delegation or follow-ups.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on SDLC-REPAIR-007 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

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
