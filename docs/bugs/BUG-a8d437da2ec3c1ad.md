# BUG-a8d437da2ec3c1ad

- Status: Open
- Case/project: E2E-API-1600 / api
- Stories: DEV-029
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 201
    Received: 503

      52 |         })
      53 |       ).status(),
    > 54 |     ).toBe(201);
         |       ^
      55 |   const view = await (await request.get('/api/v1/account/whatsapp')).json();
      56 |   expect(view.jobs).toHaveLength(1);
      57 |   expect(view.jobs[0].status).toBe('queued');
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/whatsapp-channel.spec.ts:54:7
