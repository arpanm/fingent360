import { randomUUID, createHash } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  beaStorage,
  beaRaw,
  ingestBea,
  setupBea,
  beaOperator,
  reviewBea,
  beaConnectionInput,
} from '../../helpers/bea-fixture';
import {
  connectionDatabase,
  connectionHeaders as headers,
  prepareConnectionAccount,
  connectionPassword,
} from '../../helpers/research-connection-fixture';
import {
  BEA_FEED,
  DiscoveryOperationsSchema,
  DiscoveryRunSchema,
  DiscoveryEvidenceSchema,
  FeedSchema,
  FeedItemSchema,
  ResearchCatalogSchema,
  ResearchRunsSchema,
  ResearchConnectionsSchema,
  PrivacyExportSchema,
  connectionSource,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const base = '/api/v1/discovery',
  ops = '/api/v1/ops/discovery',
  connections = '/api/v1/account/research-connections';

test('E2E-API-320 ordinary BEA provider to actual isolated evidence draft review and published reader @BEA-001 @external', async ({
  request,
  feedbackSandbox,
}) => {
  test.setTimeout(90000);
  await beaOperator(request);
  const response = await request.post(`${ops}/refresh`, {
    headers,
    data: { sourceIds: ['bea'] },
    timeout: 45000,
  });
  expect(response.status(), await response.text()).toBe(201);
  expect(DiscoveryRunSchema.parse(await response.json()).status).toBe(
    'succeeded',
  );
  const state = DiscoveryOperationsSchema.parse(
    await (await request.get(`${ops}/items`)).json(),
  );
  const source = state.items.find((i) => i.id.startsWith('bea-'))!;
  expect(source, 'Ordinary BEA refresh must create a real draft.').toBeTruthy();
  expect(source.status).toBe('draft');
  expect((await request.get(`${base}/items/${source.id}`)).status()).toBe(404);
  const published = await reviewBea(request, source, 'published');
  const evidence = DiscoveryEvidenceSchema.parse(
    await (await request.get(`${base}/items/${source.id}/evidence`)).json(),
  );
  expect(evidence.scope).toBe('release-metadata');
  expect(evidence.hash).toBe(published.sourceHash);
  expect(evidence.body).not.toMatch(/description|percentChange|<data>|<pdf>/);
  const storage = await beaStorage(feedbackSandbox);
  try {
    const raw = await storage.mongo
      .db()
      .collection('discovery_raw')
      .findOne({ _id: published.sourceHash });
    expect(raw.url).toBe(BEA_FEED);
    expect(
      createHash('sha256')
        .update(raw.url + '\n' + raw.body)
        .digest('hex'),
    ).toBe(published.sourceHash);
    expect(raw.body).toContain('<rss');
  } finally {
    await storage.close();
  }
  const feed = FeedSchema.parse(
    await (
      await request.get(`${base}/feed?source=bea&region=global&view=explore`)
    ).json(),
  );
  expect(feed.items).toEqual([published]);
});

test('E2E-API-321 parent-captured RSS replay deduplicates stored editions and catalogue tracks independent real runs @BEA-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await ingestBea(feedbackSandbox);
  expect(first.inserted).toBeGreaterThan(10);
  const second = await ingestBea(feedbackSandbox);
  expect(second.inserted).toBe(0);
  await beaOperator(request);
  const state = DiscoveryOperationsSchema.parse(
    await (await request.get(`${ops}/items`)).json(),
  );
  expect(state.items).toHaveLength(first.inserted);
  expect(
    state.items.every((i) => i.version === 1 && i.status === 'draft'),
  ).toBe(true);
  const source = state.items[0]!;
  await reviewBea(request, source, 'published');
  expect((await ingestBea(feedbackSandbox)).inserted).toBe(0);
  const catalog = ResearchCatalogSchema.parse(
    await (await request.get(`${base}/catalog`)).json(),
  ).sources.find((s) => s.id === 'bea')!;
  expect(catalog.publishedCount).toBe(1);
  expect(catalog.lastRunStatus).toBe('succeeded');
  expect(catalog.feedUrl).toBe(BEA_FEED);
  expect(
    ResearchRunsSchema.parse(
      await (await request.get(`${ops}/runs`)).json(),
    ).runs.filter((r) => r.sourceId === 'bea'),
  ).toHaveLength(3);
});

test('E2E-API-322 synthetic malformed source keeps raw evidence and prior publications while another selected source succeeds @BEA-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox),
    invalid = '<html>Synthetic provider failure, not economic evidence.</html>';
  const run = await ingestBea(feedbackSandbox, invalid, ['bea', 'glossary']);
  expect(run.status).toBe('succeeded');
  const runs = ResearchRunsSchema.parse(
    await (await request.get(`${ops}/runs`)).json(),
  ).runs.filter((r) => r.runId === run.id);
  expect(runs.find((r) => r.sourceId === 'bea')?.status).toBe('failed');
  expect(runs.find((r) => r.sourceId === 'glossary')?.status).toBe('succeeded');
  expect(
    FeedItemSchema.parse(
      await (await request.get(`${base}/items/${source.id}`)).json(),
    ),
  ).toEqual(source);
  const storage = await beaStorage(feedbackSandbox);
  try {
    expect(
      await storage.mongo
        .db()
        .collection('discovery_raw')
        .countDocuments({ body: invalid }),
    ).toBe(1);
  } finally {
    await storage.close();
  }
});

test('E2E-API-323 BEA withdrawal redacts public history and denies evidence while preserving exact internal editions @BEA-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox);
  const withdrawn = await reviewBea(request, source, 'withdrawn');
  const publicItem = FeedItemSchema.parse(
    await (await request.get(`${base}/items/${source.id}`)).json(),
  );
  expect(publicItem.title).toBe('Withdrawn BEA release');
  expect(publicItem.body).toBe('');
  const history = FeedItemSchema.array().parse(
    await (await request.get(`${base}/items/${source.id}/history`)).json(),
  );
  expect(history).toHaveLength(2);
  expect(JSON.stringify(history)).not.toContain(source.title);
  for (const suffix of ['evidence', 'context', 'media'])
    expect(
      (await request.get(`${base}/items/${source.id}/${suffix}`)).status(),
    ).toBe(404);
  expect(
    FeedSchema.parse(
      await (await request.get(`${base}/feed?source=bea`)).json(),
    ).items,
  ).toEqual([]);
  const pool = await connectionDatabase(feedbackSandbox);
  try {
    const original = await pool.query(
      'SELECT data FROM discovery_versions WHERE item_id=$1 AND version=$2',
      [source.id, source.version],
    );
    expect(original.rows[0].data).toEqual(source);
  } finally {
    await pool.end();
  }
  const restored = await reviewBea(request, withdrawn, 'published');
  expect(
    (await request.get(`${base}/items/${source.id}/evidence`)).status(),
  ).toBe(200);
  const reopened = FeedItemSchema.array().parse(
    await (await request.get(`${base}/items/${source.id}/history`)).json(),
  );
  expect(reopened[0]).toEqual(restored);
  expect(reopened.find((v) => v.status === 'withdrawn')?.title).toBe(
    'Withdrawn BEA release',
  );
});

test('E2E-API-324 corrected BEA title remains a draft until explicit current-version review @BEA-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox);
  const xml = await beaRaw();
  const changed = xml.replace(source.title, 'Synthetic corrected BEA headline');
  expect((await ingestBea(feedbackSandbox, changed)).inserted).toBe(1);
  expect(
    FeedItemSchema.parse(
      await (await request.get(`${base}/items/${source.id}`)).json(),
    ),
  ).toEqual(source);
  const draft = DiscoveryOperationsSchema.parse(
    await (await request.get(`${ops}/items`)).json(),
  ).items.find((i) => i.id === source.id)!;
  expect(draft.status).toBe('draft');
  expect(draft.version).toBe(source.version + 1);
  expect(
    (
      await request.put(`${ops}/items/${source.id}`, {
        headers,
        data: {
          expectedVersion: source.version,
          status: 'published',
          correctionNote: 'Stale synthetic review',
        },
      })
    ).status(),
  ).toBe(409);
  const published = await reviewBea(request, draft, 'published');
  expect(published.title).toBe('Synthetic corrected BEA headline');
  expect(
    (await request.get(`${base}/items/${source.id}/evidence`)).status(),
  ).toBe(200);
});

test('E2E-API-325 actual BEA edition binds owned records with exact replay withdrawal review and unchanged finances @BEA-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
  playwright,
}) => {
  const source = await setupBea(request, feedbackSandbox),
    goal = await prepareConnectionAccount(request),
    id = randomUUID(),
    input = beaConnectionInput(source, goal.id);
  const before = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  const saved = await request.put(`${connections}/${id}`, {
    headers,
    data: input,
  });
  expect(saved.status()).toBe(200);
  const receipt = await saved.json();
  expect(receipt.source).toEqual(connectionSource(source));
  expect(receipt.source).not.toHaveProperty('title');
  await reviewBea(request, source, 'withdrawn');
  expect(
    await (
      await request.put(`${connections}/${id}`, { headers, data: input })
    ).json(),
  ).toEqual(receipt);
  expect(
    ResearchConnectionsSchema.parse(
      await (await request.get(connections)).json(),
    ).connections[0]!.reviewReasons,
  ).toContainEqual(expect.stringMatching(/withdrawn/));
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await prepareConnectionAccount(other);
    expect((await other.get(`${connections}/${id}/history`)).status()).toBe(
      404,
    );
  } finally {
    await other.dispose();
  }
  const after = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(after.holdings).toEqual(before.holdings);
  expect(after.goals).toEqual(before.goals);
  expect(after.researchConnections.revisions).toEqual([receipt]);
  expect(
    (
      await request.delete('/api/v1/account', {
        headers,
        data: { password: connectionPassword },
      })
    ).status(),
  ).toBe(200);
});

test('E2E-API-326 BEA minimal receipts survive selected report issue and coalesced withdrawal notice without source text @BEA-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox);
  await prepareConnectionAccount(request);
  const id = randomUUID();
  expect(
    (
      await request.put(`${connections}/${id}`, {
        headers,
        data: beaConnectionInput(source),
      })
    ).status(),
  ).toBe(200);
  const reportInput = {
    requestId: randomUUID(),
    label: 'BEA personal research receipt',
    consent: true,
    researchConnections: [{ id, version: 1 }],
  };
  const created = await request.post('/api/v1/account/reports', {
    headers,
    data: reportInput,
  });
  expect(created.status()).toBe(201);
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(
              `/api/v1/account/reports/${reportInput.requestId}`,
            )
          ).json()
        ).status,
      { timeout: 15000 },
    )
    .toBe('succeeded');
  const issued = (
    await (
      await request.get(`/api/v1/account/reports/${reportInput.requestId}`)
    ).json()
  ).report;
  expect(issued.policy).toBe('saved-record-review-v2');
  expect(
    issued.snapshot.researchConnections.receipts[0].revision.source,
  ).toEqual(connectionSource(source));
  expect(JSON.stringify(issued)).not.toContain(source.title);
  await reviewBea(request, source, 'withdrawn');
  const checkId = randomUUID(),
    inbox = '/api/v1/account/connection-reviews';
  const checked = await request.post(`${inbox}/check`, {
    headers,
    data: { requestId: checkId },
  });
  expect(checked.status()).toBe(201);
  const notices = (await (await request.get(inbox)).json()).notices;
  expect(notices).toHaveLength(1);
  expect(notices[0].reasons).toContainEqual(expect.stringMatching(/withdrawn/));
  expect(JSON.stringify(notices)).not.toContain(source.title);
  expect(
    await (
      await request.post(`${inbox}/check`, {
        headers,
        data: { requestId: checkId },
      })
    ).json(),
  ).toEqual(await checked.json());
  expect(
    (
      await (
        await request.post('/api/v1/account/reports', {
          headers,
          data: reportInput,
        })
      ).json()
    ).report,
  ).toEqual(issued);
});

test('E2E-API-327 BEA operations deny missing auth wrong Origin and non-allowlisted refresh inputs before provider work @BEA-001', async ({
  request,
}) => {
  expect(
    (
      await request.post(`${ops}/refresh`, {
        headers,
        data: { sourceIds: ['bea'] },
      })
    ).status(),
  ).toBe(401);
  await beaOperator(request);
  expect(
    (
      await request.post(`${ops}/refresh`, {
        headers: { Origin: 'https://evil.example' },
        data: { sourceIds: ['bea'] },
      })
    ).status(),
  ).toBe(403);
  for (const data of [
    { sourceIds: ['bea', 'bea'] },
    { sourceIds: ['https://evil.example/rss'] },
    { sourceIds: ['bea'], url: BEA_FEED },
  ])
    expect(
      (await request.post(`${ops}/refresh`, { headers, data })).status(),
    ).toBe(400);
});

test('E2E-API-328 BEA evidence queued behind a withdrawal lock cannot republish the previous source text @BEA-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const source = await setupBea(request, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox);
  let withdraw: ReturnType<typeof request.put> | undefined,
    evidence: ReturnType<typeof request.get> | undefined;
  try {
    await pool.query('BEGIN');
    await pool.query('SELECT id FROM discovery_items WHERE id=$1 FOR UPDATE', [
      source.id,
    ]);
    withdraw = request.put(`${ops}/items/${source.id}`, {
      headers,
      data: {
        expectedVersion: source.version,
        status: 'withdrawn',
        correctionNote: 'Synthetic isolated queued withdrawal.',
      },
    });
    await expect
      .poll(async () => {
        await pool.query('SELECT pg_stat_clear_snapshot()');
        return Number(
          (
            await pool.query(
              'SELECT count(*) FROM pg_stat_activity WHERE pg_backend_pid()=ANY(pg_blocking_pids(pid))',
            )
          ).rows[0].count,
        );
      })
      .toBeGreaterThan(0);
    evidence = request.get(`${base}/items/${source.id}/evidence`);
    await expect
      .poll(async () => {
        await pool.query('SELECT pg_stat_clear_snapshot()');
        return Number(
          (
            await pool.query(
              "SELECT count(*) FROM pg_stat_activity a WHERE a.wait_event_type='Lock' AND (pg_backend_pid()=ANY(pg_blocking_pids(a.pid)) OR EXISTS (SELECT 1 FROM unnest(pg_blocking_pids(a.pid)) AS b(pid) WHERE pg_backend_pid()=ANY(pg_blocking_pids(b.pid))))",
            )
          ).rows[0].count,
        );
      })
      .toBeGreaterThan(1);
    await pool.query('COMMIT');
    expect((await withdraw).status()).toBe(200);
    expect((await evidence).status()).toBe(404);
  } finally {
    await pool.query('ROLLBACK').catch(() => {});
    await Promise.allSettled([withdraw, evidence].filter(Boolean));
    await pool.end();
  }
});
