# BUG-94be0ccd8c260d23

- Status: Resolved
- Case/project: E2E-API-359 / api
- Stories: WORKER-HEALTH-001
- First seen: 2026-09-16T22:26:46.819Z
- Evidence: artifacts/sdlc/1789752953639-97020/06-pnpm-e2e_run.log
- Resolution run: 1789837762812-24470

Failure excerpt (untrusted; local original has full details):

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: "preparation"
    Received: "storage"

      557 |     expect(await worker.run('work')).toBe(true);
      558 |     const failed = (await workerOverview(request)).workers[0]!;
    > 559 |     expect(failed.failureCategory).toBe('preparation');
          |                                    ^
      560 |     expect(failed.lastSuccessAt).toBeNull();
      561 |     await pool.query(
      562 |       'UPDATE record_report_jobs SET snapshot=$2,next_attempt_at=clock_timestamp() WHERE id=$1',
        at /Users/arpanmacmini/code/fingent360/tests/e2e/cases/api/worker-health.spec.ts:559:36
