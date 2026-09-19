# BUG-802fdd6adba2b2ff

- Status: Resolved
- Case/project: E2E-WEB-1591 / mobile
- Stories: SRC-010, UX-002G
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 400

       at ../helpers/india-macro.ts:67

      65 |       })
      66 |     ).status(),
    > 67 |   ).toBe(200);
         |     ^
      68 |   const credentials = {
      69 |     username: `india_${randomUUID().slice(0, 8)}`,
      70 |     password: [REDACTED],
        at indiaActors (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/india-macro.ts:67:5)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/source-operations-submissions.spec.ts:80:20
