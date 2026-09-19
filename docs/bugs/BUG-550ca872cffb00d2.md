# BUG-550ca872cffb00d2

- Status: Open
- Case/project: E2E-WEB-1080 / desktop
- Stories: FUNDS-BONDS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toBeVisible() failed

    Locator: getByText(/Portfolio look-through is not connected/)
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByText(/Portfolio look-through is not connected/)


      19 |   await expect(
      20 |     page.getByText(/Portfolio look-through is not connected/),
    > 21 |   ).toBeVisible();
         |     ^
      22 |   await page.getByText('Source and retrieval edition', { exact: true }).click();
      23 |   await expect(page.getByText(/Source row/)).toBeVisible();
      24 |   await page.keyboard.press('Escape');
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/funds-bonds.spec.ts:21:5
    Test timeout of 30000ms exceeded.
