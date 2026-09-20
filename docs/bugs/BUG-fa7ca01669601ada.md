# BUG-fa7ca01669601ada

- Status: Open
- Case/project: E2E-WEB-2315 / desktop
- Stories: SLICE-001
- First seen: 2026-09-20T18:07:15.205Z
- Evidence: artifacts/sdlc/1789927529684-81206/12-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toHaveAttribute(expected) failed

    Locator: locator('.journey').getByLabel('CSV content', { exact: true })
    Expected: "journey-import-csv-content"
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
      - Expect "toHaveAttribute" with timeout 10000ms
      - waiting for locator('.journey').getByLabel('CSV content', { exact: true })


      114 |     ).toBeVisible();
      115 |     const csvContent = journey.getByLabel('CSV content', { exact: true });
    > 116 |     await expect(csvContent).toHaveAttribute(
          |                              ^
      117 |       'id',
      118 |       'journey-import-csv-content',
      119 |     );
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/journey-keyboard.spec.ts:116:30
