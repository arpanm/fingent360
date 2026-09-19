# BUG-60f35eca18ea84d2

- Status: Resolved
- Case/project: E2E-WEB-225 / mobile
- Stories: REPORTS-002
- First seen: 2026-09-18T05:00:49.248Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    Test timeout of 30000ms exceeded.
    Error: expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 2
    Received:    1

    Call Log:
    - Timeout 10000ms exceeded while waiting on the predicate

      216 |       )
      217 |       .toBe('succeeded');
    > 218 |     await expect
          |     ^
      219 |       .poll(() =>
      220 |         page.evaluate(
      221 |           () =>
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/report-deletion.spec.ts:218:5
