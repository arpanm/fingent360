# BUG-5b20659e0bb7e8bb

- Status: Resolved
- Case/project: E2E-WEB-725 / mobile
- Stories: BROKER-DIALECTS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toBeVisible() failed

    Locator: getByText(/Automatic broker formats are not enabled/)
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByText(/Automatic broker formats are not enabled/)


      307 |   await expect(
      308 |     page.getByText(/Automatic broker formats are not enabled/),
    > 309 |   ).toBeVisible();
          |     ^
      310 |   await expect(
      311 |     page.getByRole('link', {
      312 |       name: 'Groww official export help (opens a new tab)',
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/supplemental-holdings.spec.ts:309:5
