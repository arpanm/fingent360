# BUG-3bbaf88a773e61fe

- Status: Resolved
- Case/project: E2E-API-1604 / api
- Stories: DEV-029
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 201
    Received: 503

      387 |         })
      388 |       ).status(),
    > 389 |     ).toBe(201);
          |       ^
      390 |   expect(
      391 |     (
      392 |       await request.post('/api/v1/account/whatsapp/deliveries', {
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/whatsapp-channel.spec.ts:389:7
