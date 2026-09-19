# BUG-1b5b0e18dc09a3ac

- Status: Resolved
- Case/project: E2E-WEB-330 / desktop
- Stories: REPORT-SCHEDULES-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    Error: Isolated feedback API shutdown timed out; inspect its annotated owned schema.

       at ../helpers/feedback-fixture.ts:164

      162 |               child.kill('SIGKILL');
      163 |               reject(
    > 164 |                 Error(
          |                 ^
      165 |                   'Isolated feedback API shutdown timed out; inspect its annotated owned schema.',
      166 |                 ),
      167 |               );
        at Timeout.<anonymous> (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/feedback-fixture.ts:164:17)
    Test timeout of 30000ms exceeded.
