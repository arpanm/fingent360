# BUG-04b25bdb4cac92c1

- Status: Resolved
- Case/project: E2E-WEB-1922 / desktop
- Stories: SRC-017
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789848189876-42077

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.click: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: 'Sovereign bonds', exact: true })


       at ../helpers/source-ops-browser.ts:23

      21 |   await page.goto('/#today');
      22 |   await page.goto('/#ops');
    > 23 |   await page.getByRole('button', { name: tab, exact: true }).click();
         |                                                              ^
      24 | }
      25 |
        at sourceOpsBrowser (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/source-ops-browser.ts:23:62)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/sovereign-bond.spec.ts:144:3
