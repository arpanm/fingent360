# BUG-760bdde790bbbc7e

- Status: Open
- Case/project: E2E-API-1620 / api
- Stories: EVENT-SCENARIOS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      56 |         })
      57 |       ).status(),
    > 58 |     ).toBe(200);
         |       ^
      59 |     const capture = await request.post('/api/v1/ops/gdp-expectations/import', {
      60 |       headers: retentionHeaders,
      61 |       data,
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/gdp-expectations.spec.ts:58:7
