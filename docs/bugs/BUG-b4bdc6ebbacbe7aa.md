# BUG-b4bdc6ebbacbe7aa

- Status: Resolved
- Case/project: E2E-API-1974 / api
- Stories: SRC-017
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789752953639-97020

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 201
    Received: 403

       at ../helpers/research-governance.ts:166

      164 |         })
      165 |       ).status(),
    > 166 |     ).toBe(201);
          |       ^
      167 |     const admittedEvent = EventPublicSchema.parse(
      168 |       await (await request.get('/api/v1/events/' + eventId)).json(),
      169 |     );
        at governanceFixture (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/research-governance.ts:166:7)
        at publishedCcilZeroFixture (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/ccil-zero-curve.ts:51:16)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/ccil-zero-curve.spec.ts:173:15
