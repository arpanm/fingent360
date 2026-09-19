# BUG-4aec0f5744cedda1

- Status: Open
- Case/project: E2E-WEB-1672 / mobile
- Stories: EVENT-SCENARIOS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: Unresolved

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.fill: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('region', { name: 'CPI expectation operations' }).getByLabel('Original CPI report URL')


      77 |       name: 'CPI expectation operations',
      78 |     });
    > 79 |     await region.getByLabel('Original CPI report URL').fill(data.url);
         |                                                        ^
      80 |     await region.getByLabel('Original CPI HTML or JSON file').setInputFiles({
      81 |       name: 'synthetic-spf.html',
      82 |       mimeType: 'text/html',
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/cpi-expectations.spec.ts:79:56
