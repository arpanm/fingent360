# BUG-91e5a916b3d30aac

- Status: Resolved
- Case/project: E2E-WEB-1020 / mobile
- Stories: EVENT-SCENARIOS-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789852776002-50046

Failure excerpt (untrusted; local original has full details):

    TimeoutError: locator.selectOption: Timeout 10000ms exceeded.
    Call log:
      - waiting for getByRole('region', { name: 'Event scenario preparation', exact: true }).getByLabel('Reviewed source event', { exact: true })


      36 |   await panel
      37 |     .getByLabel('Reviewed source event', { exact: true })
    > 38 |     .selectOption(event.id);
         |      ^
      39 |   await panel
      40 |     .getByLabel('Scenario family', { exact: true })
      41 |     .selectOption('regulatory');
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/browser/event-scenarios.spec.ts:38:6
