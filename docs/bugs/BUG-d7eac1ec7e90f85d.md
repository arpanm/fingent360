# BUG-d7eac1ec7e90f85d

- Status: Resolved
- Case/project: E2E-WEB-295 / desktop
- Stories: REPORTS-003
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789719717196-80383

Failure excerpt (untrusted; local original has full details):

    Test timeout of 30000ms exceeded.
    TimeoutError: locator.check: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('checkbox', { name: 'Include research connections in this report', exact: true })
        - locator resolved to <input type="checkbox"/>
      - attempting click action
        - waiting for element to be visible, enabled and stable


       at ../helpers/report-research-fixture.ts:158

      156 |       exact: true,
      157 |     })
    > 158 |     .check();
          |      ^
      159 |   await page
      160 |     .getByRole('region', { name: 'Research connection selection', exact: true })
      161 |     .getByRole('checkbox')
        at chooseResearchReport (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/report-research-fixture.ts:158:6)
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/report-research.spec.ts:281:3
    Test timeout of 30000ms exceeded.
