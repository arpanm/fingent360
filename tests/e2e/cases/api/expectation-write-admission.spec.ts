import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  spfInput,
} from '../../helpers/gdp-expectations';
import { cpiNowcastInput } from '../../helpers/cpi-expectations';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
test.use({ namedOperators: true });
for (const [id, domain, table, input] of [
  [1622, 'gdp', 'gdp_expectation_editions', spfInput],
  [1672, 'cpi', 'cpi_expectation_editions', cpiNowcastInput],
] as const) {
  test(`E2E-API-${id} ${domain} original insert rolls back after actual table wait expires named session @EVENT-SCENARIOS-001 @TEST-SIMULATION`, async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const reviewer = await indiaActors(request, playwright, feedbackSandbox),
      blocker = await connectionDatabase(feedbackSandbox),
      observer = await connectionDatabase(feedbackSandbox),
      data = input();
    let pending: ReturnType<typeof request.post> | undefined;
    try {
      await blocker.query('BEGIN');
      const pid = Number(
        (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
      );
      await blocker.query(`LOCK TABLE ${table} IN SHARE MODE`);
      pending = request.post(`/api/v1/ops/${domain}-expectations/import`, {
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
              `SELECT count(*)::int AS n FROM ${table} WHERE id=$1`,
              [data.requestId],
            )
          ).rows[0].n,
        ),
      ).toBe(0);
    } finally {
      await blocker.query('ROLLBACK');
      if (pending) await pending.then((r) => r.body()).catch(() => {});
      await blocker.end();
      await observer.end();
      await reviewer.dispose();
    }
  });
}
