# BUG-c64fbbba325c228b

- Status: Open
- Case/project: E2E-WEB-090 / mobile
- Stories: PORTFOLIO-001
- First seen: 2026-09-19T16:48:09.225Z
- Evidence: artifacts/sdlc/1789836377279-19314/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5176/#account
    Call log:
      - navigating to "http://127.0.0.1:5176/#account", waiting until "load"


      10 |     Origin: process.env.E2E_WEB_URL || 'http://localhost:5173',
      11 |   };
    > 12 |   await page.goto('/#account');
         |              ^
      13 |   await page
      14 |     .getByRole('button', { name: 'Create a new account', exact: true })
      15 |     .click();
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/holdings.spec.ts:12:14
