# BUG-df39f8ff03485a3a

- Status: Resolved
- Case/project: E2E-API-1601 / api
- Stories: DEV-029
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789846773980-36608

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 201
    Received: 503

      100 |       })
      101 |     ).status(),
    > 102 |   ).toBe(201);
          |     ^
      103 |   const pool = await connectionDatabase(feedbackSandbox);
      104 |   try {
      105 |     await pool.query(
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/whatsapp-channel.spec.ts:102:5
