# BUG-c95ad8f3c2da294c

- Status: Resolved
- Case/project: E2E-WEB-560 / mobile
- Stories: PUBLISHING-QUEUE-001
- First seen: 2026-09-18T05:00:49.248Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: 1789752953639-97020

Failure excerpt (untrusted; local original has full details):

    Test timeout of 30000ms exceeded.
    Error: expect(locator).toHaveCount(expected) failed

    Locator:  getByRole('region', { name: 'Publishing queue', exact: true }).locator('article')
    Expected: 20
    Received: 0
    Timeout:  10000ms

    Call log:
      - Expect "toHaveCount" with timeout 10000ms
      - waiting for getByRole('region', { name: 'Publishing queue', exact: true }).locator('article')
        3 × locator resolved to 0 elements
          - unexpected value "0"


      160 |   await expect(cards(page)).toHaveCount(20);
      161 |   await page.reload();
    > 162 |   await expect(cards(page)).toHaveCount(20);
          |                             ^
      163 |   expect(legacy).toEqual([]);
      164 | });
      165 | test('E2E-WEB-561 actual failed second-page storage read retries the same page while retaining a filter draft @PUBLISHING-QUEUE-001 @TEST-SIMULATION', async ({
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/publishing-queue.spec.ts:162:29
