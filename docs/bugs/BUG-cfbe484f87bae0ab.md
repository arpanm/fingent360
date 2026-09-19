# BUG-cfbe484f87bae0ab

- Status: Resolved
- Case/project: E2E-API-1605 / api
- Stories: DEV-029
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    Error: Timeout 10000ms exceeded while waiting on the predicate

      442 |     pending = request.get('/api/v1/account/whatsapp');
      443 |     void pending.catch(() => {});
    > 444 |     await expect
          |     ^
      445 |       .poll(async () =>
      446 |         Number(
      447 |           (
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/whatsapp-channel.spec.ts:444:5
