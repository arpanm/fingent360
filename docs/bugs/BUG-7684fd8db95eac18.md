# BUG-7684fd8db95eac18

- Status: Resolved
- Case/project: E2E-WEB-160 / mobile
- Stories: UX-002
- First seen: 2026-09-18T05:00:49.248Z
- Evidence: artifacts/sdlc/1789669163056-59061/06-pnpm-e2e_run.log
- Resolution run: 1789752953639-97020

Failure excerpt (untrusted; local original has full details):

    Test timeout of 90000ms exceeded.
    Error: apiRequestContext.put: Target page, context or browser has been closed

      134 |     }
      135 |   } finally {
    > 136 |     await page.request.put(`/api/v1/ops/media/${item!.id}`, {
          |                        ^
      137 |       headers,
      138 |       data: { assetId: asset.id, publish: originallyPublic },
      139 |     });
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/media.spec.ts:136:24
