# BUG-44d7bbdff42ad3e4

- Status: Resolved
- Case/project: E2E-WEB-665 / mobile
- Stories: MATERIAL-ALERTS-001
- First seen: 2026-09-18T05:00:49.248Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    Test timeout of 30000ms exceeded.
    Error: expect(locator).toBeVisible() failed

    Locator: getByRole('heading', { name: 'Material changes', exact: true })
    Expected: visible
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByRole('heading', { name: 'Material changes', exact: true })


       at ../helpers/material-alert-fixture.ts:244

      242 |   await expect(
      243 |     page.getByRole('heading', { name: 'Material changes', exact: true }),
    > 244 |   ).toBeVisible();
          |     ^
      245 |   await expect(
      246 |     page.getByRole('button', { name: 'Edit material thresholds', exact: true }),
      247 |   ).toBeEnabled();
        at prepareMaterialBrowser (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/material-alert-fixture.ts:244:5)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/material-alerts.spec.ts:390:3
