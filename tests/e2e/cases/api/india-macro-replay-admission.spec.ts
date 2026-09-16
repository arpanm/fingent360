import {
  test,
  expect,
  indiaActors,
  indiaGdpInput,
  retentionHeaders,
} from '../../helpers/india-gdp';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
test.use({ namedOperators: true, manualWorkers: true });
test('E2E-API-1811 original capture replay rechecks named session after actual storage wait @SRC-007 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  const blocker = await connectionDatabase(feedbackSandbox),
    observer = await connectionDatabase(feedbackSandbox),
    data = indiaGdpInput();
  let pending: ReturnType<typeof request.post> | undefined;
  try {
    expect(
      (
        await request.post('/api/v1/ops/india-macro/gdp', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(201);
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query(
      'LOCK TABLE india_macro_editions IN ACCESS EXCLUSIVE MODE',
    );
    pending = request.post('/api/v1/ops/india-macro/gdp', {
      headers: retentionHeaders,
      data,
    });
    void pending.catch(() => {});
    await expect
      .poll(
        async () => {
          await observer.query('SELECT pg_stat_clear_snapshot()');
          return Number(
            (
              await observer.query(
                "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid))",
                [pid],
              )
            ).rows[0].n,
          );
        },
        { timeout: 2500 },
      )
      .toBeGreaterThan(0);
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('COMMIT');
    expect((await pending).status()).toBe(401);
    expect(
      Number(
        (
          await observer.query(
            'SELECT count(*)::int AS n FROM india_macro_editions WHERE id=$1',
            [data.requestId],
          )
        ).rows[0].n,
      ),
    ).toBe(1);
  } finally {
    await blocker.query('ROLLBACK');
    if (pending)
      await pending.then((response) => response.body()).catch(() => {});
    await blocker.end();
    await observer.end();
    await reviewer.dispose();
  }
});
