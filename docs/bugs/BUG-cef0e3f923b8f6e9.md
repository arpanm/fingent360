# BUG-cef0e3f923b8f6e9

- Status: Open
- Case/project: E2E-WEB-1053 / mobile
- Stories: RESEARCH-AUTO-002
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Error: locator.selectOption: Error: strict mode violation: getByRole('region', { name: 'Release calendar', exact: true }).getByLabel('Calendar capture') resolved to 2 elements:
        1) <select>…</select> aka getByLabel('Policy calendar captureLatest')
        2) <select>…</select> aka getByLabel('Calendar captureLatest saved capture9/14/2026, 5:30:00 AM')

    Call log:
      - waiting for getByRole('region', { name: 'Release calendar', exact: true }).getByLabel('Calendar capture')


      20 |   await expect(region).toContainText('not original numerical data vintages');
      21 |   const picker = region.getByLabel('Calendar capture');
    > 22 |   await picker.selectOption({ index: 1 });
         |                ^
      23 |   await expect(region).toContainText('Source revision 2');
      24 |   await page.route(
      25 |     '**/api/v1/research-calendar*',
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/research-auto.spec.ts:22:16
    Test timeout of 30000ms exceeded.
