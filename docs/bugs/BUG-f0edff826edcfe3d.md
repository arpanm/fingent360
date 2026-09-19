# BUG-f0edff826edcfe3d

- Status: Resolved
- Case/project: E2E-WEB-1673 / desktop
- Stories: EVENT-SCENARIOS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  getByRole('region', { name: 'CPI expectation operations' }).locator('article')
    Expected: 25
    Received: 0
    Timeout:  10000ms

    Call log:
      - Expect "toHaveCount" with timeout 10000ms
      - waiting for getByRole('region', { name: 'CPI expectation operations' }).locator('article')
        14 × locator resolved to 0 elements
           - unexpected value "0"


      20 |         name: `${label} expectation operations`,
      21 |       });
    > 22 |       await expect(region.locator('article')).toHaveCount(25);
         |                                               ^
      23 |       for (const count of [50, 75, 100, 101]) {
      24 |         await region
      25 |           .getByRole('button', { name: 'Load older expectations' })
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/expectation-pagination.spec.ts:22:47
