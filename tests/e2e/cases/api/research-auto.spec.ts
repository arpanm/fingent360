import { test, expect } from '../../helpers/feedback-fixture';
import { operatorKey } from '../../helpers/operator';
import {
  connectionHeaders,
  connectionDatabase,
} from '../../helpers/research-connection-fixture';
import {
  seedResearchCalendar,
  syntheticCalendar,
} from '../../helpers/research-auto';
import {
  ReleaseCalendarSchema,
  ResearchAutoStatusSchema,
  parseBeaCalendar,
} from '../../../../packages/contracts/src/research-auto';
test('E2E-API-1050 schedules require operator and retain durable pause @RESEARCH-AUTO-002', async ({
  request,
}) => {
  expect((await request.get('/api/v1/ops/research-auto')).status()).toBe(401);
  expect(
    (
      await request.post('/api/v1/ops/session', {
        headers: connectionHeaders,
        data: { key: await operatorKey() },
      })
    ).status(),
  ).toBe(200);
  const state = ResearchAutoStatusSchema.parse(
    await (await request.get('/api/v1/ops/research-auto')).json(),
  );
  expect(state.schedules.length).toBeGreaterThan(0);
  const source = state.schedules[0]!;
  expect(
    (
      await request.put('/api/v1/ops/research-auto', {
        headers: connectionHeaders,
        data: {
          sourceId: source.sourceId,
          enabled: false,
          intervalMinutes: 60,
        },
      })
    ).status(),
  ).toBe(200);
  const again = ResearchAutoStatusSchema.parse(
    await (await request.get('/api/v1/ops/research-auto')).json(),
  );
  expect(
    again.schedules.find((s) => s.sourceId === source.sourceId)?.enabled,
  ).toBe(false);
  expect(
    (
      await request.put('/api/v1/ops/research-auto', {
        headers: connectionHeaders,
        data: {
          sourceId: 'https://untrusted.example',
          enabled: true,
          intervalMinutes: 1,
        },
      })
    ).status(),
  ).toBe(400);
});
test('E2E-API-1051 retained calendar editions replay original schedule with explicit capture basis @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const hash = await seedResearchCalendar(feedbackSandbox);
  const result = ReleaseCalendarSchema.parse(
    await (
      await request.get('/api/v1/research-calendar?edition=' + hash)
    ).json(),
  );
  expect(result.basis).toBe('retained-calendar-capture');
  expect(result.events[0]?.sequence).toBe(2);
  expect(result.events[0]?.scheduledAt).toBe('2027-01-05T13:30:00.000Z');
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    await expect(
      pool.query('DELETE FROM research_calendar_editions WHERE hash=$1', [
        hash,
      ]),
    ).rejects.toThrow();
  } finally {
    await pool.end();
  }
  expect(
    (await request.get('/api/v1/research-calendar?edition=bad')).status(),
  ).toBe(400);
});
test('E2E-API-1052 calendar rejects ambiguous timestamps duplicate IDs and malformed captures @RESEARCH-AUTO-002 @TEST-SIMULATION', () => {
  expect(() =>
    parseBeaCalendar(
      syntheticCalendar.replace('20270105T133000Z', '20270105T133000'),
    ),
  ).toThrow();
  expect(() =>
    parseBeaCalendar(syntheticCalendar.replace('END:VCALENDAR', '')),
  ).toThrow();
  expect(() =>
    parseBeaCalendar(
      syntheticCalendar.replace('SEQUENCE:2', 'UID:duplicate\r\nSEQUENCE:2'),
    ),
  ).toThrow();
  expect(
    parseBeaCalendar(
      syntheticCalendar.replace(
        'Synthetic release',
        'Synthetic long\r\n  release',
      ),
    )[0]?.title,
  ).toBe('Synthetic long release');
});
test('E2E-API-1056 durable due worker stages real glossary drafts once without provider traffic @RESEARCH-AUTO-002', async ({
  feedbackSandbox,
}) => {
  const moduleUrl = new URL(
    '../../../../apps/api/dist/research-auto.js',
    import.meta.url,
  ).href;
  const discoveryUrl = new URL(
    '../../../../apps/api/dist/discovery.js',
    import.meta.url,
  ).href;
  const configUrl = new URL(
    '../../../../apps/api/dist/config.js',
    import.meta.url,
  ).href;
  const { ResearchAutoStore } = await import(moduleUrl),
    { DiscoveryStore } = await import(discoveryUrl),
    { readConfig } = await import(configUrl);
  // Glossary path never connects Mongo or fetches providers; database is fixture-owned.
  const config = readConfig({
    DATABASE_URL: feedbackSandbox.databaseUrl,
    MONGODB_URI: 'mongodb://127.0.0.1:57017/research_auto_unused',
    WEB_ORIGIN: connectionHeaders.Origin,
  });
  const discovery = new DiscoveryStore(config),
    worker = new ResearchAutoStore(config, discovery, true),
    pool = await connectionDatabase(feedbackSandbox);
  try {
    await worker.initialize();
    await pool.query(
      "UPDATE research_auto_schedules SET enabled=(source_id='glossary'),next_at=now()",
    );
    await worker.tick();
    const first = await pool.query(
      "SELECT status,discovery_run_id FROM research_auto_runs WHERE source_id='glossary'",
    );
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0].status).toBe('succeeded');
    expect(first.rows[0].discovery_run_id).toBeTruthy();
    const drafts = await pool.query(
      "SELECT count(*)::int AS count FROM discovery_versions WHERE data->>'status'='draft'",
    );
    expect(drafts.rows[0].count).toBeGreaterThan(0);
    await worker.tick();
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM research_auto_runs',
        )
      ).rows[0].count,
    ).toBe(1);
  } finally {
    await worker.onApplicationShutdown();
    await discovery.onApplicationShutdown();
    await pool.end();
  }
});
test('E2E-API-1057 reviewed source policy actually publishes retained official drafts with durable receipt @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { randomUUID } = await import('node:crypto'),
    { automaticPublicationConfig } =
      await import('../../helpers/research-auto-publication');
  const { config, mongo } = await automaticPublicationConfig(feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox);
  const policyUrl = new URL(
      '../../../../apps/api/dist/research-auto-policy.js',
      import.meta.url,
    ).href,
    discoveryUrl = new URL(
      '../../../../apps/api/dist/discovery.js',
      import.meta.url,
    ).href,
    providerUrl = new URL(
      '../../../../apps/api/dist/discovery-provider.js',
      import.meta.url,
    ).href;
  const { ResearchAutoPolicyStore } = await import(policyUrl),
    { DiscoveryStore } = await import(discoveryUrl),
    { parseFedRss, FED_FEED } = await import(providerUrl);
  const discovery = new DiscoveryStore(config),
    policy = new ResearchAutoPolicyStore(config, discovery),
    runId = randomUUID();
  const body =
    '<rss version="2.0"><channel><item><title>Synthetic policy fixture</title><link>https://www.federalreserve.gov/newsevents/pressreleases/synthetic-policy-fixture.htm</link><description>Synthetic official-format fixture; no actual market claim.</description><pubDate>Mon, 14 Sep 2026 00:00:00 GMT</pubDate></item></channel></rss>';
  const item = parseFedRss(body, '2026-09-14T01:00:00.000Z')[0];
  try {
    await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
      item.id,
    ]);
    await pool.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2::jsonb)',
      [item.id, JSON.stringify(item)],
    );
    await mongo.db().collection('discovery_raw').insertOne({
      _id: item.sourceHash,
      url: FED_FEED,
      body,
      retrievedAt: '2026-09-14T01:00:00.000Z',
    });
    await pool.query(
      "INSERT INTO research_auto_schedules(source_id) VALUES('fed') ON CONFLICT DO NOTHING",
    );
    await pool.query(
      "INSERT INTO research_auto_runs(id,source_id,status) VALUES($1,'fed','running')",
      [runId],
    );
    expect((await policy.publish('fed', runId)).published).toBe(0);
    await request.post('/api/v1/ops/session', {
      headers: connectionHeaders,
      data: { key: await operatorKey() },
    });
    const id = randomUUID();
    expect(
      (
        await request.post('/api/v1/ops/research-auto/policies', {
          headers: connectionHeaders,
          data: {
            requestId: id,
            sourceId: 'fed',
            expectedVersion: 0,
            enabled: true,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            rightsReviewed: true,
            note: 'Synthetic explicit policy and rights acceptance for isolated test.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post(
          '/api/v1/ops/research-auto/policies/' + id + '/approve',
          { headers: connectionHeaders, data: {} },
        )
      ).status(),
    ).toBe(201);
    expect((await policy.publish('fed', runId)).published).toBe(1);
    expect(
      (await request.get('/api/v1/discovery/items/' + item.id)).status(),
    ).toBe(200);
    expect(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM research_publication_receipts WHERE run_id=$1',
          [runId],
        )
      ).rows[0].n,
    ).toBe(1);
    expect((await policy.publish('fed', runId)).published).toBe(0);
  } finally {
    await policy.onApplicationShutdown();
    await discovery.onApplicationShutdown();
    await mongo.close();
    await pool.end();
  }
});
test.describe('Named automatic publication policy', () => {
  test.use({ namedOperators: true });
  test('E2E-API-1058 policy author cannot self-approve in named mode @RESEARCH-AUTO-002', async ({
    request,
    feedbackSandbox,
  }) => {
    const { randomUUID } = await import('node:crypto');
    expect(feedbackSandbox.namedCredentials).toBeDefined();
    await request.post('/api/v1/ops/session', {
      headers: connectionHeaders,
      data: feedbackSandbox.namedCredentials,
    });
    const id = randomUUID();
    expect(
      (
        await request.post('/api/v1/ops/research-auto/policies', {
          headers: connectionHeaders,
          data: {
            requestId: id,
            sourceId: 'fed',
            expectedVersion: 0,
            enabled: true,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            rightsReviewed: true,
            note: 'Synthetic named policy rights review and automatic publishing scope.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post(
          '/api/v1/ops/research-auto/policies/' + id + '/approve',
          { headers: connectionHeaders, data: {} },
        )
      ).status(),
    ).toBe(409);
  });
});

test('E2E-API-1060 source-specific batches advance beyond invalid drafts and rotate exclusions @RESEARCH-AUTO-002 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { randomUUID } = await import('node:crypto');
  const { automaticPublicationConfig } =
    await import('../../helpers/research-auto-publication');
  const { config, mongo } = await automaticPublicationConfig(feedbackSandbox);
  const pool = await connectionDatabase(feedbackSandbox);
  const policyUrl = new URL(
    '../../../../apps/api/dist/research-auto-policy.js',
    import.meta.url,
  ).href;
  const discoveryUrl = new URL(
    '../../../../apps/api/dist/discovery.js',
    import.meta.url,
  ).href;
  const providerUrl = new URL(
    '../../../../apps/api/dist/discovery-provider.js',
    import.meta.url,
  ).href;
  const { ResearchAutoPolicyStore } = await import(policyUrl);
  const { DiscoveryStore } = await import(discoveryUrl);
  const { parseFedRss, FED_FEED } = await import(providerUrl);
  const discovery = new DiscoveryStore(config);
  const policy = new ResearchAutoPolicyStore(config, discovery);
  const body =
    '<rss version="2.0"><channel><item><title>Synthetic fair queue fixture</title><link>https://www.federalreserve.gov/newsevents/pressreleases/synthetic-fair-queue.htm</link><description>Synthetic official-format queue fixture, not an actual market release.</description><pubDate>Mon, 14 Sep 2026 00:00:00 GMT</pubDate></item></channel></rss>';
  const item = parseFedRss(body, '2026-09-14T01:00:00.000Z')[0];
  const planId = randomUUID();
  try {
    // All malformed own-source IDs precede the parser's hash ID under C collation.
    // More than one batch of unrelated heads must never enter the source queue.
    for (const [prefix, count] of [
      ['bea-unrelated-', 60],
      ['fed--invalid-', 50],
    ] as const) {
      for (let index = 0; index < count; index++) {
        const id = prefix + String(index).padStart(3, '0');
        await pool.query(
          'INSERT INTO discovery_items(id,version) VALUES($1,1)',
          [id],
        );
        await pool.query(
          'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2::jsonb)',
          [id, JSON.stringify({ status: 'draft' })],
        );
      }
    }
    await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
      item.id,
    ]);
    await pool.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2::jsonb)',
      [item.id, JSON.stringify(item)],
    );
    await mongo.db().collection('discovery_raw').insertOne({
      _id: item.sourceHash,
      url: FED_FEED,
      body,
      retrievedAt: '2026-09-14T01:00:00.000Z',
    });
    await pool.query(
      "INSERT INTO research_auto_schedules(source_id) VALUES('fed') ON CONFLICT DO NOTHING",
    );
    expect(
      (
        await request.post('/api/v1/ops/session', {
          headers: connectionHeaders,
          data: { key: await operatorKey() },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/research-auto/policies', {
          headers: connectionHeaders,
          data: {
            requestId: planId,
            sourceId: 'fed',
            expectedVersion: 0,
            enabled: true,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            rightsReviewed: true,
            note: 'Synthetic isolated policy verifies bounded source selection and fair retries.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post(
          '/api/v1/ops/research-auto/policies/' + planId + '/approve',
          { headers: connectionHeaders, data: {} },
        )
      ).status(),
    ).toBe(201);
    for (let batch = 0; batch < 3; batch++) {
      const runId = randomUUID();
      await pool.query(
        "INSERT INTO research_auto_runs(id,source_id,status) VALUES($1,'fed','running')",
        [runId],
      );
      const result = await policy.publish('fed', runId);
      expect(result.published).toBe(batch === 1 ? 1 : 0);
      expect(result.excluded).toBe(batch === 1 ? 49 : 50);
      const receipts = await pool.query(
        'SELECT count(*)::int AS n FROM research_publication_receipts WHERE run_id=$1',
        [runId],
      );
      expect(receipts.rows[0].n).toBe(50);
    }
    expect(
      (await request.get('/api/v1/discovery/items/' + item.id)).status(),
    ).toBe(200);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM research_publication_receipts WHERE plan_id=$1 AND item_id LIKE 'bea-%'",
          [planId],
        )
      ).rows[0].n,
    ).toBe(0);
    const retries = await pool.query(
      "SELECT item_id,count(*)::int AS attempts FROM research_publication_receipts WHERE plan_id=$1 AND status='excluded' GROUP BY item_id",
      [planId],
    );
    expect(retries.rows).toHaveLength(50);
    for (const row of retries.rows)
      expect(row.attempts).toBeGreaterThanOrEqual(2);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM research_publication_receipts WHERE plan_id=$1 AND status='published'",
          [planId],
        )
      ).rows[0].n,
    ).toBe(1);
  } finally {
    await policy.onApplicationShutdown();
    await discovery.onApplicationShutdown();
    await mongo.close();
    await pool.end();
  }
});
