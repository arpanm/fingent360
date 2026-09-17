# BUG-60fd7eb3b2dc231e

- Status: Open
- Case/project: E2E-WEB-1331 / desktop
- Stories: IMPACT-TRACE-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789569622822-36573/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.selectOption: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('region', { name: 'Historical sensitivity diagnostics', exact: true }).getByLabel('Calibration holding', { exact: true })


      19 |   await panel
      20 |     .getByLabel('Calibration holding', { exact: true })
    > 21 |     .selectOption('INE002A01018');
         |      ^
      22 |   await panel
      23 |     .getByLabel('Save this private source-bound diagnostic receipt.', {
      24 |       exact: true,
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/impact-calibration.spec.ts:21:6
