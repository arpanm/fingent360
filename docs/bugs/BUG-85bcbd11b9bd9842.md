# BUG-85bcbd11b9bd9842

- Status: Open
- Case/project: E2E-API-1900 / api
- Stories: DEV-022
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      45 |       '108002',
      46 |     );
    > 47 |     expect((await request.get(base + '/evidence')).status()).toBe(200);
         |                                                              ^
      48 |     expect(
      49 |       (
      50 |         await f.reviewer.post('/api/v1/ops/funds/review', {
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/fund-mergers.spec.ts:47:62
