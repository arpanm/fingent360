# BUG-b7910a3bf3f43b4b

- Status: Resolved
- Case/project: E2E-OFFLINE-611 / offline
- Stories: MAPPED-IMPORT-001
- First seen: 2026-09-18T19:39:46.662Z
- Evidence: artifacts/sdlc/1789752953639-97020/08-pnpm-android_test.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toBeVisible() failed

    Locator: getByRole('link', { name: 'Zerodha official export help (opens a new tab)', exact: true })
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByRole('link', { name: 'Zerodha official export help (opens a new tab)', exact: true })


      76 |       exact: true,
      77 |     }),
    > 78 |   ).toBeVisible();
         |     ^
      79 |   const region = await prepareMapping(page);
      80 |   await region
      81 |     .getByLabel('Declared source row count', { exact: true })
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/offline/mapped-import.spec.ts:78:5
