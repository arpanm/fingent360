# BUG-73eba4fc7574f9ef

- Status: Open
- Case/project: E2E-API-1602 / api
- Stories: DEV-029, PRIVACY-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 201
    Received: 503

      195 |       })
      196 |     ).status(),
    > 197 |   ).toBe(201);
          |     ^
      198 |   const exported = await request.get('/api/v1/account/privacy/export');
      199 |   expect(exported.status()).toBe(200);
      200 |   const data = await exported.json();
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/whatsapp-channel.spec.ts:197:5
