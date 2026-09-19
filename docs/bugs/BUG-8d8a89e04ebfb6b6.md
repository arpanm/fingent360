# BUG-8d8a89e04ebfb6b6

- Status: Open
- Case/project: E2E-WEB-121 / mobile
- Stories: UX-002D
- First seen: 2026-09-19T16:49:29.201Z
- Evidence: artifacts/sdlc/1789836492361-20464/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5176/#saved
    Call log:
      - navigating to "http://127.0.0.1:5176/#saved", waiting until "load"


      140 | }) => {
      141 |   test.setTimeout(60000);
    > 142 |   await page.goto('/#saved');
          |              ^
      143 |   expect(
      144 |     (
      145 |       await page.request.post('/api/v1/account/register', {
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/library.spec.ts:142:14
