import { test, expect } from '../../helpers/app-fixture';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { operatorKey } from '../../helpers/operator';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
for (const [id, table, tab] of [
  [520, 'research_sources', 'Source registry'],
  [521, 'discovery_items', 'Publishing'],
] as const) {
  test(`E2E-WEB-${id} ${tab} denied after actual storage wait returns to sign-in @OPS-READ-ADMISSION-001 @TEST-SIMULATION`, async ({
    page,
    feedbackSandbox,
  }) => {
    const active = new Set<unknown>();
    page.on('request', (r) => active.add(r));
    page.on('requestfinished', (r) => active.delete(r));
    page.on('requestfailed', (r) => active.delete(r));
    await page.goto('/#ops');
    await page
      .getByLabel('Operator key', { exact: true })
      .fill(await operatorKey());
    await page
      .getByRole('button', { name: 'Sign in to operations', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Source registry', exact: true }),
    ).toBeVisible();
    await expect.poll(() => active.size).toBe(0);
    const blocker = await connectionDatabase(feedbackSandbox),
      observer = await connectionDatabase(feedbackSandbox);
    try {
      await blocker.query('BEGIN');
      const pid = Number(
        (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
      );
      await blocker.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
      if (tab === 'Publishing') await page.reload();
      else await page.getByRole('button', { name: tab, exact: true }).click();
      await expect
        .poll(
          async () => {
            await observer.query('SELECT pg_stat_clear_snapshot()');
            return Number(
              (
                await observer.query(
                  "SELECT count(*) AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid)) AND query LIKE $2",
                  [
                    pid,
                    table === 'discovery_items'
                      ? 'SELECT v.data,to_char(v.created_at%FROM discovery_items%LIMIT 21'
                      : 'SELECT r.* FROM research_sources s JOIN research_source_revisions r ON r.source_id=s.id AND r.revision=s.revision  ORDER BY r.recorded_at DESC,s.id',
                  ],
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
      await expect.poll(() => active.size).toBe(0);
      await expect(
        page.getByRole('button', {
          name: 'Sign in to operations',
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Source registry', exact: true }),
      ).toHaveCount(0);
      await page
        .getByLabel('Operator key', { exact: true })
        .fill(await operatorKey());
      await page
        .getByRole('button', { name: 'Sign in to operations', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Source registry', exact: true }),
      ).toBeVisible();
    } finally {
      try {
        await blocker.query('ROLLBACK');
        await expect.poll(() => active.size).toBe(0);
      } finally {
        await Promise.all([blocker.end(), observer.end()]);
      }
    }
  });
}
test('E2E-WEB-522 late successful registry read cannot restore signed-out Operations @OPS-READ-ADMISSION-001 @TEST-SIMULATION', async ({
  page,
  feedbackSandbox,
}) => {
  const ordinary = new Set<unknown>();
  page.on('request', (r) => ordinary.add(r));
  page.on('requestfinished', (r) => ordinary.delete(r));
  page.on('requestfailed', (r) => ordinary.delete(r));
  await page.goto('/#ops');
  await page
    .getByLabel('Operator key', { exact: true })
    .fill(await operatorKey());
  await page
    .getByRole('button', { name: 'Sign in to operations', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Source registry', exact: true }),
  ).toBeVisible();
  await expect.poll(() => ordinary.size).toBe(0);
  let release!: () => void,
    finish!: () => void,
    started = false,
    status = 0,
    active = 0;
  const gate = new Promise<void>((r) => (release = r)),
    drained = new Promise<void>((r) => (finish = r));
  await page.route('**/api/v1/ops/sources', async (route) => {
    started = true;
    active++;
    try {
      const response = await route.fetch({
        url: `${feedbackSandbox.apiOrigin}/api/v1/ops/sources`,
      });
      status = response.status();
      await gate;
      await route.fulfill({ response }).catch(() => {});
    } finally {
      active--;
      finish();
    }
  });
  try {
    await page
      .getByRole('button', { name: 'Source registry', exact: true })
      .click();
    await expect.poll(() => status).toBe(200);
    await page
      .getByRole('button', { name: 'Sign out of operations', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Sign in to operations', exact: true }),
    ).toBeVisible();
    release();
    await drained;
    await expect.poll(() => active + ordinary.size).toBe(0);
    await page.unroute('**/api/v1/ops/sources');
    await expect(
      page.getByRole('button', { name: 'Source registry', exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel('Operator key', { exact: true })
      .fill(await operatorKey());
    await page
      .getByRole('button', { name: 'Sign in to operations', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Source registry', exact: true }),
    ).toBeVisible();
  } finally {
    release();
    if (started) {
      await drained;
      await expect.poll(() => active + ordinary.size).toBe(0);
    }
    await page.unroute('**/api/v1/ops/sources');
  }
});
