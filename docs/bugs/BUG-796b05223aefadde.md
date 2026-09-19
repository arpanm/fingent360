# BUG-796b05223aefadde

- Status: Resolved
- Case/project: E2E-WEB-1550 / desktop
- Stories: RESEARCH-AUTO-002
- First seen: 2026-09-18T05:00:49.248Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    Fixture "feedbackSandbox" timeout of 60000ms exceeded during setup.

       at ../helpers/feedback-fixture.ts:17

      15 |   namedCredentials?: { username: string; password: [REDACTED]};
      16 | }
    > 17 | export const test = base.extend<{
         |                          ^
      18 |   feedbackSandbox: FeedbackSandbox;
      19 |   manualWorkers: boolean;
      20 |   leastPrivilege: boolean;
        at /Users/arpanmacmini/code/fingent360/tests/e2e/helpers/feedback-fixture.ts:17:26
    Error: Feedback fixture startup timed out. Check local database availability and pnpm build.

       at ../helpers/feedback-fixture.ts:114

      112 |               () =>
      113 |                 reject(
    > 114 |                   Error(
          |                   ^
      115 |                     'Feedback fixture startup timed out. Check local database availability and pnpm build.',
      116 |                   ),
      117 |                 ),
        at Timeout.<anonymous> (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/feedback-fixture.ts:114:19)
