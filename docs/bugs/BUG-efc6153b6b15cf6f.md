# BUG-efc6153b6b15cf6f

- Status: Resolved
- Case/project: E2E-WEB-402 / desktop
- Stories: HOLDINGS-RECONCILE-001, PORTFOLIO-001
- First seen: 2026-09-19T16:48:09.225Z
- Evidence: artifacts/sdlc/1789836377279-19314/06-pnpm-e2e_run.log
- Resolution run: 1789837057413-22117

Failure excerpt (untrusted; local original has full details):

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5176/#overview
    Call log:
      - navigating to "http://127.0.0.1:5176/#overview", waiting until "load"


      193 |   page,
      194 | }) => {
    > 195 |   await page.goto('/#overview');
          |              ^
      196 |   expect(
      197 |     (
      198 |       await api(page, '/register', {
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/holdings-reconciliation.spec.ts:195:14
