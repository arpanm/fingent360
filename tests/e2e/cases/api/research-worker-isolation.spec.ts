import {
  test,
  expect,
  indiaActors,
  retentionHeaders,
  filingRss,
  discoveryRights,
  runFilingTick,
} from '../../helpers/filing-discovery';
import { withFilingWorker, tickFilingWorker } from '../../helpers/filing-watch';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  FILING_DISCOVERY_URL,
  FilingDiscoveryInboxSchema,
} from '../../../../packages/contracts/src/index';

test.use({ namedOperators: true, manualWorkers: true });

for (const exhausted of [false, true]) {
  test(`${exhausted ? 'E2E-API-2062 held research worker lock exhausts only the bounded contention retry' : 'E2E-API-2060 held research worker lock skips without writes then released lock admits one acquisition'} @RESEARCH-WORKER-ISOLATION-001 @SRC-004 @TEST-SIMULATION`, async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    const reviewer = await indiaActors(request, playwright, feedbackSandbox);
    const holder = await connectionDatabase(feedbackSandbox);
    let locked = false;
    let skipped = 0;
    let fetches = 0;
    try {
      expect(
        (
          await request.post('/api/v1/ops/filing-discovery/gate', {
            headers: retentionHeaders,
            data: { enabled: true, rightsEvidence: discoveryRights },
          })
        ).status(),
      ).toBe(201);
      expect(
        (
          await request.put('/api/v1/ops/research-auto', {
            headers: retentionHeaders,
            data: {
              sourceId: 'equity-filing-discovery',
              enabled: true,
              intervalMinutes: 1440,
            },
          })
        ).status(),
      ).toBe(200);
      // Separate real connection, same database-wide key as the actual worker.
      // Bound acquisition; never wait indefinitely for another local worker.
      await holder.query("SET lock_timeout = '5s'");
      await holder.query('SELECT pg_advisory_lock(360954)');
      locked = true;
      const execution = runFilingTick(
        feedbackSandbox,
        { [FILING_DISCOVERY_URL]: filingRss() },
        async () => {
          fetches++;
        },
        'equity-filing-discovery',
        async () => {
          skipped++;
          expect(fetches).toBe(0);
          expect(
            (
              await holder.query(
                'SELECT count(*)::int AS n FROM research_auto_runs',
              )
            ).rows[0].n,
          ).toBe(0);
          expect(
            (
              await holder.query(
                'SELECT count(*)::int AS n FROM filing_discovery_captures',
              )
            ).rows[0].n,
          ).toBe(0);
          if (!exhausted && locked) {
            expect(
              (
                await holder.query(
                  'SELECT pg_advisory_unlock(360954) AS released',
                )
              ).rows[0].released,
            ).toBe(true);
            locked = false;
          }
        },
      );
      if (exhausted) {
        await expect(execution).rejects.toThrow(
          'remained lock-busy for five seconds',
        );
        expect(fetches).toBe(0);
        expect(
          (
            await holder.query(
              'SELECT count(*)::int AS n FROM research_auto_runs',
            )
          ).rows[0].n,
        ).toBe(0);
      } else {
        expect(await execution).toBe(1);
        expect(fetches).toBe(1);
        expect(
          (await holder.query('SELECT status FROM research_auto_runs')).rows,
        ).toEqual([{ status: 'succeeded' }]);
        const inbox = FilingDiscoveryInboxSchema.parse(
          await (await request.get('/api/v1/ops/filing-discovery')).json(),
        );
        expect(inbox.captures).toHaveLength(1);
        expect(inbox.captures[0]?.itemCount).toBe(2);
      }
      expect(skipped).toBeGreaterThan(0);
    } finally {
      if (locked) await holder.query('SELECT pg_advisory_unlock(360954)');
      await holder.end();
      await reviewer.dispose();
    }
  });
}

test('E2E-API-2061 disabled and no-due research workers report distinct outcomes without acquisition @RESEARCH-WORKER-ISOLATION-001 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  await withFilingWorker(feedbackSandbox, async (worker, pool) => {
    await worker.initialize();
    await pool.query('UPDATE research_auto_schedules SET enabled=false');
    expect(await tickFilingWorker(worker)).toBe('not-due');
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM research_auto_runs'))
        .rows[0].n,
    ).toBe(0);
  });
  await withFilingWorker(
    feedbackSandbox,
    async (worker, pool) => {
      expect(await worker.tick()).toBe('disabled');
      expect(
        (await pool.query('SELECT count(*)::int AS n FROM research_auto_runs'))
          .rows[0].n,
      ).toBe(0);
    },
    false,
  );
  // The higher-level fixture must not reinterpret a non-due outcome as success.
  await expect(
    runFilingTick(feedbackSandbox, {}, undefined, 'equity-filing-discovery'),
  ).rejects.toThrow('did not run: not-due');
});

test('E2E-API-2063 acquisition and PostgreSQL capture failures reject once without scheduler retry @RESEARCH-WORKER-ISOLATION-001 @SRC-004 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  const pool = await connectionDatabase(feedbackSandbox);
  let triggerCreated = false;
  try {
    expect(
      (
        await request.post('/api/v1/ops/filing-discovery/gate', {
          headers: retentionHeaders,
          data: { enabled: true, rightsEvidence: discoveryRights },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put('/api/v1/ops/research-auto', {
          headers: retentionHeaders,
          data: {
            sourceId: 'equity-filing-discovery',
            enabled: true,
            intervalMinutes: 1440,
          },
        })
      ).status(),
    ).toBe(200);
    let fetches = 0;
    await expect(
      runFilingTick(
        feedbackSandbox,
        {
          [FILING_DISCOVERY_URL]: new Error('TEST-SIMULATION unavailable RSS'),
        },
        async () => {
          fetches++;
        },
        'equity-filing-discovery',
      ),
    ).rejects.toThrow('Official RSS transport unavailable');
    expect(fetches).toBe(1);
    expect(
      (await pool.query('SELECT status FROM research_auto_runs')).rows,
    ).toEqual([{ status: 'failed' }]);
    // Actual database failure in this owned schema only; no service outage,
    // role changes, shared table mutation or mocked successful persistence.
    await pool.query(
      "CREATE FUNCTION reject_test_filing_capture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST-SIMULATION capture storage unavailable'; END $$",
    );
    await pool.query(
      'CREATE TRIGGER reject_test_filing_capture BEFORE INSERT ON filing_discovery_captures FOR EACH ROW EXECUTE FUNCTION reject_test_filing_capture()',
    );
    triggerCreated = true;
    fetches = 0;
    await expect(
      runFilingTick(
        feedbackSandbox,
        {
          [FILING_DISCOVERY_URL]: filingRss(),
        },
        async () => {
          fetches++;
        },
        'equity-filing-discovery',
      ),
    ).rejects.toThrow('TEST-SIMULATION capture storage unavailable');
    expect(fetches).toBe(1);
    expect(
      (await pool.query('SELECT status FROM research_auto_runs')).rows,
    ).toEqual([{ status: 'failed' }, { status: 'failed' }]);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM filing_discovery_captures',
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await pool.query(
          "SELECT last_status FROM research_auto_schedules WHERE source_id='equity-filing-discovery'",
        )
      ).rows[0].last_status,
    ).toBe('failed');
  } finally {
    if (triggerCreated)
      await pool.query(
        'DROP TRIGGER reject_test_filing_capture ON filing_discovery_captures',
      );
    await pool.query('DROP FUNCTION IF EXISTS reject_test_filing_capture()');
    await pool.end();
    await reviewer.dispose();
  }
});
