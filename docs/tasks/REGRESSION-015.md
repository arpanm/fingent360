# REGRESSION-015 — complete SDLC validation and repair

- **Status:** Completed (recorded scope)
- **Implemented / recorded:** Recorded format/check and 268 unit tests passed; 31 affected E2E cases passed after fixes (a9ca213, 5fc0907).
- **Pending:** Later feature edits need their own validation; this does not verify today’s working tree.
- **Next action / inputs:** No action for this historical repair; validate subsequent changes separately.
- **Verification:** The preserved evidence below applies only to its recorded scope/revision. This tracker migration did not run validation.

## Implementation handoff rule

After each change, update the summary above and the matching [TODO row](../../TODO.md). Keep prompts, detailed scope, remaining work, verification evidence and handoff commands in this file. Follow [task maintenance](README.md); a parent stays partial while a child requirement is missing.

## Preserved specification, prompts and history

The entries below are migrated records, not new execution instructions or current test-pass claims. The current summary above takes precedence where older statuses differ.

### REGRESSION-015 — complete SDLC validation and repair

- **Status:** Implemented and validated within recorded scope. Full766-case run:739 passed,26 failed,1 intentional manual-outage skip. After fixes, all31 affected API/desktop/mobile cases passed in2.3minutes; format/check and268 unit tests passed. Fix commits a9ca213 and5fc0907. User subsequently restored the manual execution boundary; no ongoing execution authorization. No push.
- **Scope / acceptance:** Fix reported web typing and any subsequent check/test failures without weakening contracts or tests. Run format/check, gated local commit and full E2E; record actual results and remaining limitations.
- **Reusable Codex prompt:** Read the supplied September14 web typecheck log and latest E2E artifacts; repair underlying typing/workflow defects, add relevant regression coverage, run the authorized SDLC, update README and trackers with actual evidence, and retain all unrelated pending changes.

## Reusable task prompt

Read AGENTS.md, the task-maintenance guide and this task’s current summary. Work only on REGRESSION-015 unless the user expands the scope. Treat the preserved specification/history as context; current user instructions take precedence. Implement the listed remaining acceptance end to end, or reconcile recorded completion evidence if no implementation remains. Keep tests, documentation and the root index consistent. Record exact remaining work and who needs to act. Do not execute deterministic validation or commit without the user-authorized gates.
