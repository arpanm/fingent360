# BUG-b8d4d5a01a3ed2a6

- Status: Resolved
- Case/project: E2E-WEB-2321 / mobile
- Stories: CCIL-LIQUIDITY-001, SRC-017, FUNDS-BONDS-001, DEV-022
- First seen: 2026-09-20T17:59:50.794Z
- Evidence: artifacts/sdlc/1789926953092-78982/06-pnpm-e2e_run.log
- Resolution run: 1789926953092-78982

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toBeVisible() failed

    Locator: getByRole('region', { name: 'Historical government-security liquidity', exact: true }).getByRole('alert')
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByRole('region', { name: 'Historical government-security liquidity', exact: true }).getByRole('alert')


      277 |       exact: true,
      278 |     });
    > 279 |     await expect(reader.getByRole('alert')).toBeVisible();
          |                                             ^
      280 |     await activateObservationControl(
      281 |       page,
      282 |       reader.getByRole('button', { name: 'Retry liquidity evidence' }),
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/ccil-liquidity.spec.ts:279:45
    Test timeout of 30000ms exceeded.
