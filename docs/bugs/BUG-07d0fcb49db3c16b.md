# BUG-07d0fcb49db3c16b

- Status: Resolved
- Case/project: E2E-WEB-120 / desktop
- Stories: UX-002D
- First seen: 2026-09-18T05:00:49.248Z
- Evidence: artifacts/sdlc/1789836492361-20464/06-pnpm-e2e_run.log
- Resolution run: 1789837362616-23249

Failure excerpt (untrusted; local original has full details):

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5176/#saved
    Call log:
      - navigating to "http://127.0.0.1:5176/#saved", waiting until "load"


       9 | }) => {
      10 |   test.setTimeout(60000);
    > 11 |   await page.goto('/#saved');
         |              ^
      12 |   await expect(
      13 |     page.getByRole('link', {
      14 |       name: 'Sign in or create an account',
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/library.spec.ts:11:14
