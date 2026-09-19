# BUG-a7da4eb6097aaf05

- Status: Resolved
- Case/project: E2E-API-1520 / api
- Stories: DEV-006
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 201
    Received: 403

       at ../helpers/oil-education.ts:179

      177 |         })
      178 |       ).status(),
    > 179 |     ).toBe(201);
          |       ^
      180 |     const event = EventPublicSchema.parse(
      181 |         await (await request.get('/api/v1/events/' + id)).json(),
      182 |       ),
        at oilEducationFixture (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/oil-education.ts:179:7)
        at intelligenceBriefFixture (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/intelligence-brief.ts:25:15)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/intelligence-brief.spec.ts:17:13
