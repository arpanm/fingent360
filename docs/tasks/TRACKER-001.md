# TRACKER-001 — Readable task index and honest delivery status

- **Status:** Completed implementation; validation pending
- **Implemented / recorded:** Moved task details into separate files and created a concise task index plus current delivery summary.
- **Pending:** Manual review of status accuracy and user-run documentation gates remain pending.
- **Next action / inputs:** Await completed saved-run evidence; agent fixes specific failures without rerunning the suite.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### Request and acceptance

User requests separate files for every past, active and planned task; TODO contains only titles, links, status and clear blockers/next actions. Preserve history, prompts and evidence. Update both files after every implementation. Documentation-only change: no API, UI, database migration or executable test is needed. Manual acceptance: every former task has a linked file; prompts are absent from the root index; current nine workstreams distinguish authored functionality, missing functionality and unverified activation. No deterministic validation or commit is authorized by this documentation request.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on TRACKER-001 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.

## Migration outcome

Root TODO reduced from 1,827 to 182 lines; 178 stable task records include embedded child briefs and planned source tasks. Original content is preserved unchanged in the archive; local links in the migrated files were inspected and resolve. Updated AGENTS and SDLC maintenance instructions require task-detail plus index updates. Current observed code HEAD is 09b3b1e; this documentation change awaits user-run gates and commit. No application code, dependencies or migrations changed.

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
