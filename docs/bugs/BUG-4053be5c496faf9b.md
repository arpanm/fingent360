# BUG-4053be5c496faf9b

- Status: Resolved
- Case/project: E2E-WEB-640 / desktop
- Stories: NAMED-OPERATORS-001, DEV-017
- First seen: 2026-09-19T19:49:13.237Z
- Evidence: artifacts/sdlc/1789846773980-36608/06-pnpm-e2e_run.log
- Resolution run: 1789847379056-38783

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      34 |       () => document.documentElement.scrollWidth <= window.innerWidth,
      35 |     ),
    > 36 |   ).toBe(true);
         |     ^
      37 |   const bounds = await region.boundingBox();
      38 |   expect(bounds).not.toBeNull();
      39 |   expect(bounds!.x).toBeGreaterThanOrEqual(0);
        at captureReviewedLayout (/Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/named-operators.spec.ts:36:5)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/named-operators.spec.ts:219:3
