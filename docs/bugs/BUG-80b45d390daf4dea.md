# BUG-80b45d390daf4dea

- Status: Resolved
- Case/project: E2E-WEB-1283 / desktop
- Stories: ACTION-CENTRE-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.selectOption: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('region', { name: 'Educational action centre', exact: true }).getByLabel('Saved holding', { exact: true })


      165 |   await panel
      166 |     .getByLabel('Saved holding', { exact: true })
    > 167 |     .selectOption('INE002A01018');
          |      ^
      168 |   await panel
      169 |     .getByLabel('Saved goal', { exact: true })
      170 |     .selectOption({ label: 'Synthetic research goal' });
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/action-plan.spec.ts:167:6
