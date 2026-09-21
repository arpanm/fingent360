# BUG-fb4ca6ebaf321422

- Status: Resolved
- Case/project: E2E-WEB-010 / desktop
- Stories: SLICE-001
- First seen: 2026-09-18T05:00:49.248Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: 1789929280500-88238

Failure excerpt (untrusted; local original has full details):

    Test timeout of 30000ms exceeded.
    TimeoutError: locator.click: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('link', { name: 'Explore the mechanism' })
        - locator resolved to <a href="#event">Explore the mechanism →</a>
      - attempting click action
        - waiting for element to be visible, enabled and stable


       5 |   }) => {
       6 |     await page.goto('/#brief');
    >  7 |     await page.getByRole('link', { name: 'Explore the mechanism' }).click();
         |                                                                     ^
       8 |     await page.getByRole('link', { name: 'Alpha Air', exact: true }).click();
       9 |     await expect(
      10 |       page.getByRole('heading', { name: 'Alpha Air', exact: true }),
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/journey.spec.ts:7:69
    Test timeout of 30000ms exceeded.
