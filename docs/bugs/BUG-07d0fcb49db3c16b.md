# BUG-07d0fcb49db3c16b

- Status: Resolved
- Case/project: E2E-WEB-120 / desktop
- Stories: UX-002D
- First seen: 2026-09-18T05:00:49.248Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: 1789752953639-97020

Failure excerpt (untrusted; local original has full details):

    Test timeout of 60000ms exceeded.
    Error: expect(locator).toBeVisible() failed

    Locator: getByRole('link', { name: 'Sign in or create an account', exact: true })
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByRole('link', { name: 'Sign in or create an account', exact: true })


      15 |       exact: true,
      16 |     }),
    > 17 |   ).toBeVisible();
         |     ^
      18 |   const feed = FeedSchema.parse(
      19 |     await (await page.request.get('/api/v1/discovery/feed')).json(),
      20 |   );
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/library.spec.ts:17:5
