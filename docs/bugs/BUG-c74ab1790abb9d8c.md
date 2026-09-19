# BUG-c74ab1790abb9d8c

- Status: Resolved
- Case/project: E2E-OFFLINE-810 / offline
- Stories: ECB-FX-001
- First seen: 2026-09-18T19:39:46.662Z
- Evidence: artifacts/sdlc/1789752953639-97020/08-pnpm-android_test.log
- Resolution run: 1789848189876-42077

Failure excerpt (untrusted; local original has full details):

    Error: expect(locator).toBeVisible() failed

    Locator: getByText('On-device mode', { exact: true })
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByText('On-device mode', { exact: true })


      26 |   });
      27 |   await page.goto('/#reference-fx');
    > 28 |   await expect(page.getByText('On-device mode', { exact: true })).toBeVisible();
         |                                                                   ^
      29 |   const current = EcbFxPublicSchema.parse(
      30 |     await page.evaluate(async () =>
      31 |       (await fetch('/api/v1/reference-fx')).json(),
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/offline/ecb-fx.spec.ts:28:67
