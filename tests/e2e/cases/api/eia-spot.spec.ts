import { createHash, randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  eiaInput,
  eiaRights,
  eiaReview,
} from '../../helpers/eia-spot';
import {
  EiaSpotPublicSchema,
  parseEiaSpot,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1940 disabled contributor gate actual retention independent review missing cells history and revocation @SRC-009 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    data = eiaInput();
  try {
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/capture', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(403);
    expect((await request.get('/api/v1/eia-spot')).status()).toBe(404);
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/gate', {
          headers: retentionHeaders,
          data: { enabled: true, rightsEvidence: eiaRights },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/capture', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/review', {
          headers: retentionHeaders,
          data: eiaReview(data.requestId),
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post('/api/v1/ops/eia-spot/review', {
          headers: retentionHeaders,
          data: eiaReview(data.requestId),
        })
      ).status(),
    ).toBe(201);
    const view = EiaSpotPublicSchema.parse(
      await (await request.get('/api/v1/eia-spot')).json(),
    );
    expect(view.receipt.points.filter((p) => p.value === null)).toHaveLength(2);
    expect(view.receipt.unit).toBe('USD-per-barrel');
    expect(view.receipt.points[0]?.value).toBe('10.00');
    const next = {
      ...data,
      requestId: randomUUID(),
      body: data.body.replaceAll('10.00', '10.50'),
    };
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/capture', {
          headers: retentionHeaders,
          data: next,
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/eia-spot/review', {
          headers: retentionHeaders,
          data: eiaReview(next.requestId),
        })
      ).status(),
    ).toBe(201);
    expect(
      EiaSpotPublicSchema.parse(
        await (
          await request.get('/api/v1/eia-spot?edition=' + data.requestId)
        ).json(),
      ).receipt.points[0]?.value,
    ).toBe('10.00');
    const invalid = {
      requestId: randomUUID(),
      body: data.body.replace('Dollars per Barrel', 'Dollars per Gallon'),
    };
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/capture', {
          headers: retentionHeaders,
          data: invalid,
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await reviewer.get(
          '/api/v1/ops/eia-spot/' + invalid.requestId + '/evidence',
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/gate', {
          headers: retentionHeaders,
          data: { enabled: false, rightsEvidence: eiaRights },
        })
      ).status(),
    ).toBe(201);
    expect((await request.get('/api/v1/eia-spot')).status()).toBe(404);
    expect(
      (
        await reviewer.post('/api/v1/ops/eia-spot/review', {
          headers: retentionHeaders,
          data: eiaReview(data.requestId, 'withdraw'),
        })
      ).status(),
    ).toBe(201);
  } finally {
    await reviewer.dispose();
  }
});
test('E2E-API-1941 verified daily grammar rejects weekly measure missing row wrong units and duplicate dates @SRC-009 @TEST-SIMULATION', async () => {
  const data = eiaInput(),
    parse = (body: string) =>
      parseEiaSpot(
        body,
        data.requestId,
        createHash('sha256').update(body).digest('hex'),
        '2026-09-15T00:00:00.000Z',
      );
  expect(parse(data.body).releasedOn).toBe('2026-09-10');
  for (const body of [
    data.body.replace('Daily', 'Weekly'),
    data.body.replace('s=RWTC&f=D', 's=RWTC&f=W'),
    data.body.replace('09/03/26', '09/02/26'),
    data.body.replace('09/09/26', '09/09/27'),
    data.body.replace('10.00', 'garbled'),
    data.body.replace('Dollars per Barrel', 'Dollars per Gallon'),
  ])
    expect(() => parse(body)).toThrow();
});

test('E2E-API-1942 actual research-auto tick uses daily source branch and refuses permission change during acquisition @SRC-009 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const { createRequire } = await import('node:module'),
    { readFile } = await import('node:fs/promises'),
    { parseEnv } = await import('node:util'),
    { connectionDatabase } =
      await import('../../helpers/research-connection-fixture');
  const require = createRequire(
    new URL('../../../../apps/api/package.json', import.meta.url),
  );
  require('reflect-metadata');
  const env = {
      ...parseEnv(
        await readFile(new URL('../../../../.env', import.meta.url), 'utf8'),
      ),
      ...process.env,
    },
    uri = new URL(env.MONGODB_URI!);
  if (
    uri.protocol !== 'mongodb:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(uri.hostname)
  )
    throw Error('Owned loopback MongoDB required.');
  if (!uri.searchParams.has('authSource'))
    uri.searchParams.set('authSource', uri.pathname.slice(1) || 'admin');
  uri.pathname = '/' + feedbackSandbox.schema;
  const { readConfig } = await import(
      new URL('../../../../apps/api/dist/config.js', import.meta.url).href
    ),
    { ResearchAutoStore } = await import(
      new URL('../../../../apps/api/dist/research-auto.js', import.meta.url)
        .href
    ),
    { DiscoveryStore } = await import(
      new URL('../../../../apps/api/dist/discovery.js', import.meta.url).href
    ),
    config = readConfig({
      DATABASE_URL: feedbackSandbox.databaseUrl,
      MONGODB_URI: uri.href,
      WEB_ORIGIN: retentionHeaders.Origin,
    }),
    discovery = new DiscoveryStore(config),
    worker = new ResearchAutoStore(config, discovery, true),
    pool = await connectionDatabase(feedbackSandbox),
    reviewer = await indiaActors(request, playwright, feedbackSandbox),
    savedFetch = globalThis.fetch;
  let revoke = false,
    calls = 0;
  globalThis.fetch = async (input) => {
    if (String(input) !== 'https://www.eia.gov/dnav/pet/PET_PRI_SPT_S1_D.htm')
      throw Error('Unexpected source request in isolated simulation.');
    calls++;
    if (revoke)
      expect(
        (
          await request.post('/api/v1/ops/eia-spot/gate', {
            headers: retentionHeaders,
            data: { enabled: false, rightsEvidence: eiaRights },
          })
        ).status(),
      ).toBe(201);
    return new Response(eiaInput().body, { status: 200 });
  };
  try {
    await worker.initialize();
    await pool.query('UPDATE research_auto_schedules SET enabled=false');
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/gate', {
          headers: retentionHeaders,
          data: { enabled: true, rightsEvidence: eiaRights },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.put('/api/v1/ops/research-auto', {
          headers: retentionHeaders,
          data: {
            sourceId: 'eia-daily-spot',
            enabled: true,
            intervalMinutes: 1440,
          },
        })
      ).status(),
    ).toBe(200);
    await worker.tick();
    expect(calls).toBe(1);
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM eia_spot_sources'))
        .rows[0].n,
    ).toBe(1);
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM eia_spot_reviews'))
        .rows[0].n,
    ).toBe(0);
    await worker.tick();
    expect(calls).toBe(1);
    await pool.query(
      "UPDATE research_auto_schedules SET next_at=now() WHERE source_id='eia-daily-spot'",
    );
    revoke = true;
    await expect(worker.tick()).rejects.toThrow();
    expect(
      (await pool.query('SELECT count(*)::int AS n FROM eia_spot_sources'))
        .rows[0].n,
    ).toBe(1);
    expect(
      (
        await pool.query(
          "SELECT status FROM research_auto_runs WHERE source_id='eia-daily-spot' ORDER BY started_at DESC LIMIT 1",
        )
      ).rows[0].status,
    ).toBe('failed');
  } finally {
    globalThis.fetch = savedFetch;
    await Promise.allSettled([
      worker.onApplicationShutdown(),
      discovery.onApplicationShutdown(),
      pool.end(),
      reviewer.dispose(),
    ]);
  }
});

test('E2E-API-1944 escaped original whitespace fits decoded1MB while multibyte overflow is rejected before raw storage @SRC-009 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/gate', {
          headers: retentionHeaders,
          data: { enabled: true, rightsEvidence: eiaRights },
        })
      ).status(),
    ).toBe(201);
    const original = eiaInput(),
      body =
        original.body +
        '\t'.repeat(1000000 - Buffer.byteLength(original.body, 'utf8'));
    expect(Buffer.byteLength(body, 'utf8')).toBe(1000000);
    expect(
      Buffer.byteLength(JSON.stringify({ ...original, body }), 'utf8'),
    ).toBeGreaterThan(1100000);
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/capture', {
          headers: retentionHeaders,
          data: { ...original, body },
        })
      ).status(),
    ).toBe(201);
    const evidence = await reviewer.get(
      `/api/v1/ops/eia-spot/${original.requestId}/evidence`,
    );
    expect(evidence.status()).toBe(200);
    expect((await evidence.json()).body).toBe(body);
    const id = randomUUID();
    expect(
      (
        await request.post('/api/v1/ops/eia-spot/capture', {
          headers: retentionHeaders,
          data: { requestId: id, body: original.body + '€'.repeat(400000) },
        })
      ).status(),
    ).toBe(400);
    expect(
      (await reviewer.get(`/api/v1/ops/eia-spot/${id}/evidence`)).status(),
    ).toBe(409);
  } finally {
    await reviewer.dispose();
  }
});
