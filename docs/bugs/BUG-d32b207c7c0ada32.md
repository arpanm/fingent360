# BUG-d32b207c7c0ada32

- Status: Resolved
- Case/project: E2E-WEB-1522 / mobile
- Stories: DEV-006
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789848189876-42077

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
        at oilEducationFixture (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/oil-education.ts:33:20)
        at intelligenceBriefFixture (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/intelligence-brief.ts:25:15)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/intelligence-brief-operations.spec.ts:10:19
