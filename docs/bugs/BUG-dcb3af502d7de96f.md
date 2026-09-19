# BUG-dcb3af502d7de96f

- Status: Resolved
- Case/project: E2E-API-1850 / api
- Stories: EVENT-SCENARIOS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 201
    Received: 400

      31 |         data,
      32 |       });
    > 33 |       expect(saved.status()).toBe(201);
         |                              ^
      34 |       expect(
      35 |         (
      36 |           await reviewer.post('/api/v1/ops/cpi-expectations/review', {
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/cpi-history.spec.ts:33:30
