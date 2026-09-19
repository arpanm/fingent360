# BUG-7f3d3aba3ffa16ae

- Status: Resolved
- Case/project: E2E-API-1521 / api
- Stories: DEV-006
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789711405725-75316/09-pnpm-e2e_run.log
- Resolution run: 1789848189876-42077

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 201
    Received: 403

      184 |         })
      185 |       ).status(),
    > 186 |     ).toBe(201);
          |       ^
      187 |     const pending = IntelligenceBriefPublicSchema.parse(
      188 |       await (await request.get('/api/v1/intelligence-briefs/' + f.id)).json(),
      189 |     );
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/intelligence-brief.spec.ts:186:7
