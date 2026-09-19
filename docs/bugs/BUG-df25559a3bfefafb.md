# BUG-df25559a3bfefafb

- Status: Resolved
- Case/project: E2E-WEB-1595 / desktop
- Stories: SRC-006, UX-002G
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 400

       at ../helpers/classification-crosswalk.ts:23

      21 |       })
      22 |     ).status(),
    > 23 |   ).toBe(200);
         |     ^
      24 |   const credentials = {
      25 |     username: 'crosswalk_' + randomUUID().slice(0, 8),
      26 |     password: [REDACTED],
        at crosswalkFixture (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/classification-crosswalk.ts:23:5)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/reviewed-source-forms.spec.ts:129:19
