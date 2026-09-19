import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test, expect } from '../../helpers/app-fixture';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { automaticPublicationConfig } from '../../helpers/research-auto-publication';
import type { FeedbackSandbox } from '../../helpers/feedback-fixture';

test.use({
  manualWorkers: true,
  trace: 'off',
  video: 'off',
  screenshot: 'off',
});
const sourceUrl = 'https://www.federalreserve.gov/feeds/press_all.xml';
const body =
  '<rss version="2.0"><channel><item><title>Synthetic durable worker acceptance</title><link>https://www.federalreserve.gov/newsevents/pressreleases/synthetic-durable-worker.htm</link><description>Synthetic transport fixture, not an actual market release or live provider request.</description><pubDate>Mon, 14 Sep 2026 00:00:00 GMT</pubDate></item></channel></rss>';

type ResearchWorker = {
  initialize(): Promise<void>;
  tick(): Promise<void>;
  onApplicationShutdown(): Promise<void>;
};

async function ownedWorkers(sandbox: FeedbackSandbox) {
  // Existing guards verify both the disposable PostgreSQL schema and loopback
  // Mongo database. No database/network work occurs at import or discovery.
  const pool = await connectionDatabase(sandbox);
  const { config, mongo } = await automaticPublicationConfig(sandbox);
  createRequire(new URL('../../../../apps/api/package.json', import.meta.url))(
    'reflect-metadata',
  );
  const { ResearchAutoStore } = await import(
    new URL('../../../../apps/api/dist/research-auto.js', import.meta.url).href
  );
  const { DiscoveryStore } = await import(
    new URL('../../../../apps/api/dist/discovery.js', import.meta.url).href
  );
  const stores: Array<{
    worker: ResearchWorker;
    discovery: { onApplicationShutdown(): Promise<void> };
  }> = [];
  const makeWorker = () => {
    const discovery = new DiscoveryStore(config);
    const worker: ResearchWorker = new ResearchAutoStore(
      config,
      discovery,
      true,
    );
    stores.push({ worker, discovery });
    return worker;
  };
  const worker = makeWorker();
  await worker.initialize();
  await pool.query(
    "UPDATE research_auto_schedules SET enabled=(source_id='fed'),interval_minutes=60,next_at=now()",
  );
  const snapshots = async () =>
    (
      await pool.query(
        'SELECT item_id,version,data FROM discovery_versions ORDER BY item_id,version',
      )
    ).rows;
  return {
    pool,
    mongo,
    worker,
    makeWorker,
    snapshots,
    close: async () => {
      await Promise.allSettled(
        stores.flatMap(({ worker, discovery }) => [
          worker.onApplicationShutdown(),
          discovery.onApplicationShutdown(),
        ]),
      );
      await Promise.allSettled([pool.end(), mongo.close()]);
    },
  };
}

function fixtureResponse(input: Parameters<typeof fetch>[0]) {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url !== sourceUrl)
    throw Error('Unexpected network request in isolated worker simulation.');
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/rss+xml' },
  });
}

test('E2E-API-1061 deployment advisory lock excludes concurrent actual research worker without corrupting active capture @RESEARCH-AUTO-002 @DEV-011 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const fixture = await ownedWorkers(feedbackSandbox),
    second = fixture.makeWorker();
  const originalFetch = globalThis.fetch;
  let release!: () => void;
  const heldResponse = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  globalThis.fetch = async (input) => {
    const response = fixtureResponse(input);
    calls++;
    await heldResponse;
    return response;
  };
  let first: Promise<{ ok: true } | { ok: false; error: unknown }> | undefined;
  try {
    first = fixture.worker.tick().then(
      () => ({ ok: true as const }),
      (error) => ({ ok: false as const, error }),
    );
    await expect.poll(() => calls, { timeout: 5000 }).toBe(1);
    const active = (
      await fixture.pool.query('SELECT id,status FROM research_auto_runs')
    ).rows;
    expect(active).toEqual([{ id: expect.any(String), status: 'running' }]);
    // The first worker is held inside the actual fixed-source fetch while the
    // second uses a separate pool/connection and the real database lock.
    await second.tick();
    expect(calls).toBe(1);
    expect(
      (await fixture.pool.query('SELECT id,status FROM research_auto_runs'))
        .rows,
    ).toEqual(active);
    expect(
      (await fixture.pool.query('SELECT id,status FROM discovery_runs')).rows,
    ).toEqual([{ id: expect.any(String), status: 'running' }]);
    release();
    const completed = await first;
    if (!completed.ok) throw completed.error;
    const runs = (
      await fixture.pool.query(
        'SELECT id,status,discovery_run_id FROM research_auto_runs',
      )
    ).rows;
    expect(runs).toEqual([
      {
        id: active[0]!.id,
        status: 'succeeded',
        discovery_run_id: expect.any(String),
      },
    ]);
    expect(await fixture.snapshots()).toHaveLength(1);
    expect(
      await fixture.mongo
        .db()
        .collection('discovery_raw')
        .countDocuments({ url: sourceUrl, body }),
    ).toBe(1);
    await second.tick();
    expect(calls).toBe(1);
    expect(
      (
        await fixture.pool.query(
          'SELECT count(*)::int AS n FROM research_auto_runs',
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    release();
    await first;
    globalThis.fetch = originalFetch;
    await fixture.close();
  }
});

test('E2E-API-1062 new actual worker recovers abandoned attempt and retries identical retained source without duplicate editions @RESEARCH-AUTO-002 @DEV-011 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const fixture = await ownedWorkers(feedbackSandbox),
    originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls++;
    return fixtureResponse(input);
  };
  try {
    await fixture.worker.tick();
    const retained = await fixture.snapshots();
    expect(retained).toHaveLength(1);
    const abandoned = randomUUID();
    // Owned persisted state models process loss after starting a due attempt;
    // the recovery itself is the unmodified worker's real tick path.
    await fixture.pool.query(
      "INSERT INTO research_auto_runs(id,source_id,started_at,status) VALUES($1,'fed',now()-interval '2 minutes','running')",
      [abandoned],
    );
    await fixture.pool.query(
      "UPDATE research_auto_schedules SET next_at=now()-interval '1 second',last_status='running',last_run_id=$1 WHERE source_id='fed'",
      [abandoned],
    );
    const restarted = fixture.makeWorker();
    await restarted.tick();
    const interrupted = (
      await fixture.pool.query(
        'SELECT status,message,finished_at FROM research_auto_runs WHERE id=$1',
        [abandoned],
      )
    ).rows[0];
    expect(interrupted.status).toBe('failed');
    expect(interrupted.message).toBe(
      'Interrupted attempt; content-addressed retry is safe.',
    );
    expect(interrupted.finished_at).not.toBeNull();
    expect(
      (
        await fixture.pool.query(
          "SELECT count(*)::int AS n FROM research_auto_runs WHERE status='succeeded'",
        )
      ).rows[0].n,
    ).toBe(2);
    expect(await fixture.snapshots()).toEqual(retained);
    expect(
      await fixture.mongo
        .db()
        .collection('discovery_raw')
        .countDocuments({ url: sourceUrl, body }),
    ).toBe(1);
    const schedule = (
      await fixture.pool.query(
        "SELECT last_status,last_run_id,next_at>now() AS deferred FROM research_auto_schedules WHERE source_id='fed'",
      )
    ).rows[0];
    expect(schedule).toMatchObject({
      last_status: 'succeeded',
      deferred: true,
    });
    expect(schedule.last_run_id).not.toBe(abandoned);
    await restarted.tick();
    expect(calls).toBe(2);
    expect(
      (
        await fixture.pool.query(
          'SELECT count(*)::int AS n FROM research_auto_runs',
        )
      ).rows[0].n,
    ).toBe(3);
  } finally {
    globalThis.fetch = originalFetch;
    await fixture.close();
  }
});

test('E2E-API-1063 source failure persists fifteen-minute retry across worker recreation and recovers only when due without replacing evidence @RESEARCH-AUTO-002 @DEV-011 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  test.setTimeout(60000);
  const fixture = await ownedWorkers(feedbackSandbox),
    originalFetch = globalThis.fetch;
  let calls = 0,
    failTransport = false;
  globalThis.fetch = async (input) => {
    const successful = fixtureResponse(input);
    calls++;
    return failTransport
      ? new Response('Synthetic upstream unavailable', { status: 503 })
      : successful;
  };
  try {
    await fixture.worker.tick();
    const retained = await fixture.snapshots();
    expect(retained).toHaveLength(1);
    await fixture.pool.query(
      "UPDATE research_auto_schedules SET next_at=now()-interval '1 second' WHERE source_id='fed'",
    );
    const before = (
      await fixture.pool.query('SELECT clock_timestamp()::text AS at')
    ).rows[0].at;
    failTransport = true;
    await expect(fixture.worker.tick()).rejects.toThrow(
      'Source refresh failed.',
    );
    const after = (
      await fixture.pool.query('SELECT clock_timestamp()::text AS at')
    ).rows[0].at;
    const schedule = (
      await fixture.pool.query(
        "SELECT last_status,last_run_id,next_at,message,next_at >= $1::timestamptz+interval '15 minutes' AND next_at <= $2::timestamptz+interval '15 minutes' AS exact_retry FROM research_auto_schedules WHERE source_id='fed'",
        [before, after],
      )
    ).rows[0];
    expect(schedule).toMatchObject({
      last_status: 'failed',
      exact_retry: true,
      message:
        'Fetch failed; retry in 15 minutes. Existing published editions retained.',
    });
    const failed = (
      await fixture.pool.query(
        'SELECT status,finished_at FROM research_auto_runs WHERE id=$1',
        [schedule.last_run_id],
      )
    ).rows[0];
    expect(failed.status).toBe('failed');
    expect(failed.finished_at).not.toBeNull();
    expect(await fixture.snapshots()).toEqual(retained);
    const restarted = fixture.makeWorker();
    await restarted.tick();
    expect(calls).toBe(2);
    expect(
      (
        await fixture.pool.query(
          "SELECT next_at FROM research_auto_schedules WHERE source_id='fed'",
        )
      ).rows[0].next_at,
    ).toEqual(schedule.next_at);
    expect(
      (
        await fixture.pool.query(
          'SELECT count(*)::int AS n FROM research_auto_runs',
        )
      ).rows[0].n,
    ).toBe(2);
    // Advance only the owned due timestamp; no wall-clock wait or global clock
    // override and no live request is needed to exercise the eventual retry.
    await fixture.pool.query(
      "UPDATE research_auto_schedules SET next_at=now()-interval '1 second' WHERE source_id='fed'",
    );
    failTransport = false;
    await restarted.tick();
    expect(calls).toBe(3);
    expect(
      (
        await fixture.pool.query(
          "SELECT last_status,next_at>now() AS deferred FROM research_auto_schedules WHERE source_id='fed'",
        )
      ).rows[0],
    ).toEqual({ last_status: 'succeeded', deferred: true });
    expect(
      (
        await fixture.pool.query(
          'SELECT count(*)::int AS n FROM research_auto_runs',
        )
      ).rows[0].n,
    ).toBe(3);
    expect(await fixture.snapshots()).toEqual(retained);
    expect(
      await fixture.mongo
        .db()
        .collection('discovery_raw')
        .countDocuments({ url: sourceUrl, body }),
    ).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
    await fixture.close();
  }
});
