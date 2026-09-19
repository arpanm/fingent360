# BUG-d3dfb1d37de74e03

- Status: Open
- Case/project: E2E-WEB-1831 / desktop
- Stories: UX-002G, SRC-009
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.selectOption: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('main', { name: 'Monthly commodities' }).getByLabel('Retained reviewed edition', { exact: true })


      128 |     await reader
      129 |       .getByLabel('Retained reviewed edition', { exact: true })
    > 130 |       .selectOption(ids[0]!);
          |        ^
      131 |     await expect(reader.getByRole('alert')).toBeFocused();
      132 |     await expect(page).toHaveURL(new RegExp('edition=' + ids[0]));
      133 |     await reader
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/source-history-navigation.spec.ts:130:8
    Test timeout of 30000ms exceeded.
