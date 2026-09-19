# BUG-3b6ad6cb4c817b1b

- Status: Resolved
- Case/project: E2E-WEB-615 / desktop
- Stories: MAPPED-IMPORT-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789848189876-42077

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toBeVisible() failed

    Locator: getByText(/Automatic broker formats are not enabled/)
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByText(/Automatic broker formats are not enabled/)


      212 |   await expect(
      213 |     page.getByText(/Automatic broker formats are not enabled/),
    > 214 |   ).toBeVisible();
          |     ^
      215 |   for (const name of [
      216 |     'Zerodha',
      217 |     'Groww',
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/mapped-import.spec.ts:214:5
