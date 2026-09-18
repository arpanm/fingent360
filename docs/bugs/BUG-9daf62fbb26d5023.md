# BUG-9daf62fbb26d5023

- Status: Open
- Case/project: E2E-WEB-1850 / desktop
- Stories: EVENT-SCENARIOS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.click: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('region', { name: 'CPI expectation operations' }).getByRole('button', { name: 'Cleveland monthly archive', exact: true })


      52 |     await ops
      53 |       .getByRole('button', { name: 'Cleveland monthly archive', exact: true })
    > 54 |       .click();
         |        ^
      55 |     await ops.getByLabel('Historical CPI target month').fill('2025-01');
      56 |     await ops.getByLabel('Historical model vintage day').fill('2025-02-11');
      57 |     await ops.getByLabel('Original CPI HTML or JSON file').setInputFiles({
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/cpi-history.spec.ts:54:8
