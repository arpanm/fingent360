# BUG-da81df2e5f1a0d93

- Status: Resolved
- Case/project: E2E-OFFLINE-722 / offline
- Stories: BROKER-DIALECTS-001
- First seen: 2026-09-18T19:39:46.662Z
- Evidence: artifacts/sdlc/1789752953639-97020/08-pnpm-android_test.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toBeVisible() failed

    Locator: getByText(/ICICI Direct says off-market Portfolio entries can use transfer-day closing prices/)
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByText(/ICICI Direct says off-market Portfolio entries can use transfer-day closing prices/)


      231 |       /ICICI Direct says off-market Portfolio entries can use transfer-day closing prices/,
      232 |     ),
    > 233 |   ).toBeVisible();
          |     ^
      234 |   await expect(
      235 |     page.getByText(/Automatic broker formats are not enabled/),
      236 |   ).toBeVisible();
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/offline/supplemental-holdings.spec.ts:233:5
