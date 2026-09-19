# BUG-1b3cc598cfdf6360

- Status: Resolved
- Case/project: E2E-API-1573 / api
- Stories: SRC-017
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789837762812-24470/06-pnpm-e2e_run.log
- Resolution run: 1789848189876-42077

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
