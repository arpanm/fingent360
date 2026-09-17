# BUG-fb908950c6bbfe2b

- Status: Open
- Case/project: E2E-WEB-1260 / desktop
- Stories: EVENT-SCENARIOS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.selectOption: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('region', { name: 'Event scenario preparation', exact: true }).getByLabel('Reviewed source event', { exact: true })


      29 |   await region
      30 |     .getByLabel('Reviewed source event', { exact: true })
    > 31 |     .selectOption(event.id);
         |      ^
      32 |   await region
      33 |     .getByRole('button', { name: 'Extract FOMC lower bound', exact: true })
      34 |     .click();
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/fed-policy-scenario.spec.ts:31:6
    Test timeout of 30000ms exceeded.
