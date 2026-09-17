# BUG-c9ec533b14d9b6f8

- Status: Open
- Case/project: E2E-WEB-224 / desktop
- Stories: REPORTS-002
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    Test timeout of 30000ms exceeded.
    Error: Isolated feedback API shutdown timed out; inspect its annotated owned schema.

       at ../helpers/feedback-fixture.ts:164

      162 |               child.kill('SIGKILL');
      163 |               reject(
    > 164 |                 Error(
          |                 ^
      165 |                   'Isolated feedback API shutdown timed out; inspect its annotated owned schema.',
      166 |                 ),
      167 |               );
        at Timeout.<anonymous> (/Users/arpanmacmini/code/fingent360/tests/e2e/helpers/feedback-fixture.ts:164:17)
    Error: locator.click: Test timeout of 30000ms exceeded.
    Call log:
      - waiting for getByRole('button', { name: 'Open report', exact: true })


      73 |   await page
      74 |     .getByRole('button', { name: 'Open report', exact: true })
    > 75 |     .click({ timeout: 15000 });
         |      ^
      76 |   await page.evaluate(() => {
      77 |     const original = window.fetch.bind(window);
      78 |     const state = window as unknown as {
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/report-deletion.spec.ts:75:6
    Test timeout of 30000ms exceeded.
