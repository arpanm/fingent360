# BUG-edd3343e05c7ef1d

- Status: Open
- Case/project: E2E-WEB-1990 / desktop
- Stories: SRC-004
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.click: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: 'Enable equity-filing-watch', exact: true })


      57 |     await page
      58 |       .getByRole('button', { name: 'Enable equity-filing-watch', exact: true })
    > 59 |       .click();
         |        ^
      60 |     await expect(
      61 |       page.getByRole('button', {
      62 |         name: 'Pause equity-filing-watch',
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/filing-watch.spec.ts:59:8
    Test timeout of 30000ms exceeded.
