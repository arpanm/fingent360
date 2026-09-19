# BUG-dad60b81d4566d3f

- Status: Resolved
- Case/project: E2E-WEB-2000 / mobile
- Stories: SRC-004
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789752953639-97020

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.click: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: 'Filing discovery', exact: true })


       at ../helpers/source-ops-browser.ts:23

      21 |   await page.goto('/#today');
      22 |   await page.goto('/#ops');
    > 23 |   await page.getByRole('button', { name: tab, exact: true }).click();
         |                                                              ^
      24 | }
      25 |
        at sourceOpsBrowser (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/source-ops-browser.ts:23:62)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/filing-discovery.spec.ts:18:5
