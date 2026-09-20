# BUG-fa7ca01669601ada

- Status: Open
- Case/project: E2E-WEB-2315 / desktop
- Stories: SLICE-001
- First seen: 2026-09-20T18:07:15.205Z
- Evidence: artifacts/sdlc/1789928359149-84609/12-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toHaveValue(expected) failed

    Locator:  locator('.journey').getByLabel('Exercise input condition', { exact: true })
    Expected: "stale"
    Received: "baseline"
    Timeout:  10000ms

    Call log:
      - Expect "toHaveValue" with timeout 10000ms
      - waiting for locator('.journey').getByLabel('Exercise input condition', { exact: true })
        14 × locator resolved to <select id="journey-review-scenario">…</select>
           - unexpected value "baseline"


      276 |     // Tab alone dismisses that popup and restores the controlled value.
      277 |     await page.keyboard.press('Enter');
    > 278 |     await expect(scenario).toHaveValue('stale');
          |                            ^
      279 |     await page.keyboard.press('Tab');
      280 |     await activate(
      281 |       journey.getByRole('button', { name: 'Create review', exact: true }),
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/journey-keyboard.spec.ts:278:28
