# BUG-145d34c32ac56dbd

- Status: Resolved
- Case/project: E2E-WEB-1320 / mobile
- Stories: SRC-007
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789848189876-42077

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toBeVisible() failed

    Locator: getByText(/matches-current-capture/)
    Expected: visible
    Error: strict mode violation: getByText(/matches-current-capture/) resolved to 2 elements:
        1) <p>…</p> aka getByText('-07-13T10:30:00.000Z: index 101.03 · matches-current-capture · original hash')
        2) <p>…</p> aka getByText('-07-13T10:30:00.000Z: index 100.93 · matches-current-capture · original hash')

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByText(/matches-current-capture/)


      40 |       .getByText('Release vintages for 2026-06', { exact: true })
      41 |       .click();
    > 42 |     await expect(page.getByText(/matches-current-capture/)).toBeVisible();
         |                                                             ^
      43 |     await page.getByLabel('Published by (UTC)').fill('2026-07-12T00:00');
      44 |     await page
      45 |       .getByRole('button', { name: 'Apply publication cutoff' })
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/india-macro.spec.ts:42:61
    Test timeout of 30000ms exceeded.
