# BUG-e9ced00e799624ec

- Status: Open
- Case/project: E2E-API-1783 / api
- Stories: SRC-003, IMPACT-TRACE-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 201
    Received: 400

       at ../helpers/equity-consolidation.ts:127

      125 |         })
      126 |       ).status(),
    > 127 |     ).toBe(201);
          |       ^
      128 |     expect(
      129 |       (
      130 |         await reviewer.post('/api/v1/ops/equities/review', {
        at consolidationActors (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/equity-consolidation.ts:127:7)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/equity-consolidation.spec.ts:224:24
