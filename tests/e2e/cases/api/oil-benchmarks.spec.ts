import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  oilWorkbook,
  oilRaw,
  oilStorage,
  captureOilFixture,
  seedOilEdition,
  oilDatabase,
  oilOperator,
  oilHeaders,
  reviewOil,
} from '../../helpers/oil-benchmarks';
import {
  OilBenchmarkOperationsSchema,
  OilBenchmarkPublicSchema,
  OilBenchmarkHistorySchema,
  OilBenchmarkEvidenceSchema,
  OilBenchmarkRetainedSchema,
  OilBenchmarkReviewsSchema,
  OperatorIdentitySchema,
  OperatorSessionSchema,
  PublicationProposalSchema,
} from '../../../../packages/contracts/src/index';
import { waitForQueryBlocked } from '../../helpers/withdrawal-fixture';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-API-740 synthetic fixed-source transport flows through actual raw store numeric reconciliation review and evidence @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { raw, run } = await captureOilFixture(feedbackSandbox);
  expect(run).toMatchObject({
    status: 'succeeded',
    category: 'changed',
    edition: 1,
    observationCount: 4,
    sourceHash: raw.hash,
  });
  expect(
    OilBenchmarkPublicSchema.parse(
      await (await request.get('/api/v1/oil-benchmarks')).json(),
    ).status,
  ).toBe('never-published');
  await oilOperator(request);
  const { receipt } = await reviewOil(request);
  const current = OilBenchmarkPublicSchema.parse(
    await (await request.get('/api/v1/oil-benchmarks')).json(),
  );
  expect(current.edition?.sourceHash).toBe(raw.hash);
  expect(current.edition?.knownAt).toBeNull();
  expect(
    current.edition?.observations.find((row) => row.series === 'BRENT')?.value,
  ).toBe('12.3');
  const evidence = OilBenchmarkEvidenceSchema.parse(
    await (await request.get('/api/v1/oil-benchmarks/evidence/1')).json(),
  );
  expect(evidence.edition).toEqual(current.edition);
  expect(JSON.stringify(evidence)).not.toContain('base64');
  const retained = OilBenchmarkRetainedSchema.parse(
    await (
      await request.get(`/api/v1/ops/oil-benchmarks/retained/${run.requestId}`)
    ).json(),
  );
  expect(retained.body).toBe(raw.body);
  expect(retained.sourceHash).toBe(raw.hash);
  expect(
    OilBenchmarkReviewsSchema.parse(
      await (await request.get('/api/v1/ops/oil-benchmarks/reviews')).json(),
    ).reviews,
  ).toEqual([receipt]);
});
test('E2E-API-741 parse failure retains a real quarantine receipt without accepted or published numbers @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { raw, run } = await captureOilFixture(
    feedbackSandbox,
    new TextEncoder().encode('synthetic invalid workbook'),
  );
  expect(run).toMatchObject({
    status: 'failed',
    category: 'parse',
    edition: null,
    sourceHash: raw.hash,
  });
  await oilOperator(request);
  expect(
    OilBenchmarkOperationsSchema.parse(
      await (await request.get('/api/v1/ops/oil-benchmarks')).json(),
    ).latest,
  ).toBeNull();
  const retained = OilBenchmarkRetainedSchema.parse(
    await (
      await request.get(`/api/v1/ops/oil-benchmarks/retained/${run.requestId}`)
    ).json(),
  );
  expect(retained.body).toBe(raw.body);
  expect(
    (
      await request.post('/api/v1/ops/oil-benchmarks/refresh', {
        headers: oilHeaders,
        data: { requestId: run.requestId },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.put('/api/v1/ops/oil-benchmarks/review', {
        headers: oilHeaders,
        data: {
          requestId: randomUUID(),
          expectedVersion: 0,
          status: 'published',
          correctionNote: 'Cannot publish a rejected fixture.',
        },
      })
    ).status(),
  ).toBe(409);
});
test('E2E-API-742 missing previously accepted months fails without mutating immutable history @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await seedOilEdition(feedbackSandbox);
  await oilOperator(request);
  await reviewOil(request);
  const truncated = await oilWorkbook({ truncate: true });
  expect(
    (await captureOilFixture(feedbackSandbox, truncated)).run,
  ).toMatchObject({ status: 'failed', category: 'parse' });
  expect(
    OilBenchmarkPublicSchema.parse(
      await (await request.get('/api/v1/oil-benchmarks')).json(),
    ).edition,
  ).toEqual(first);
  const pool = await oilDatabase(feedbackSandbox);
  try {
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM oil_benchmark_editions'))
          .rows[0].n,
      ),
    ).toBe(1);
    await expect(
      pool.query(
        'UPDATE oil_benchmark_observations SET value=0 WHERE edition=1',
      ),
    ).rejects.toThrow();
    await expect(
      pool.query('DELETE FROM oil_benchmark_reviews'),
    ).rejects.toThrow();
  } finally {
    await pool.end();
  }
});
test('E2E-API-743 unchanged capture advances checked time while replay performs no provider action @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await seedOilEdition(feedbackSandbox),
    raw = oilRaw(
      await oilWorkbook({ brent: '12.3' }),
      new Date(Date.parse(first.retrievedAt) + 1).toISOString(),
    );
  let calls = 0;
  const storage = await oilStorage(feedbackSandbox, async () => {
      calls++;
      return raw;
    }),
    id = randomUUID();
  try {
    const result = await storage.store.refresh(
      { requestId: id },
      async () => {},
    );
    expect(result).toMatchObject({
      status: 'succeeded',
      category: 'unchanged',
      edition: first.edition,
    });
    expect(
      await storage.store.refresh({ requestId: id }, async () => {}),
    ).toEqual(result);
    expect(calls).toBe(1);
    await oilOperator(request);
    const overview = OilBenchmarkOperationsSchema.parse(
      await (await request.get('/api/v1/ops/oil-benchmarks')).json(),
    );
    expect(overview.latest).toEqual(first);
    expect(overview.head.checkedAt).toBe(raw.retrievedAt);
    expect(
      (
        await request.post('/api/v1/ops/oil-benchmarks/refresh', {
          headers: oilHeaders,
          data: { requestId: randomUUID() },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await storage.close();
  }
});
test('E2E-API-744 withdrawal retires every old public edition even after later publication and old review replay @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedOilEdition(feedbackSandbox);
  await oilOperator(request);
  const published = await reviewOil(request);
  await reviewOil(request, 'withdrawn');
  for (const path of ['history', 'editions/1', 'evidence/1'])
    expect((await request.get(`/api/v1/oil-benchmarks/${path}`)).status()).toBe(
      404,
    );
  const second = await seedOilEdition(
    feedbackSandbox,
    await oilWorkbook({ brent: '21.3' }),
  );
  await reviewOil(request);
  expect(
    OilBenchmarkHistorySchema.parse(
      await (await request.get('/api/v1/oil-benchmarks/history')).json(),
    ).editions,
  ).toEqual([second]);
  for (const path of ['editions/1', 'evidence/1'])
    expect((await request.get(`/api/v1/oil-benchmarks/${path}`)).status()).toBe(
      404,
    );
  expect(
    (
      await request.put('/api/v1/ops/oil-benchmarks/review', {
        headers: oilHeaders,
        data: published.body,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.put('/api/v1/ops/oil-benchmarks/review', {
        headers: oilHeaders,
        data: {
          ...published.body,
          correctionNote: 'Changed same-ID input must conflict.',
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    OilBenchmarkPublicSchema.parse(
      await (await request.get('/api/v1/oil-benchmarks')).json(),
    ).edition,
  ).toEqual(second);
  expect(
    (await request.get('/api/v1/ops/oil-benchmarks/editions/1')).status(),
  ).toBe(200);
});
test('E2E-API-745 operator read rechecks real session expiry after the exact source lock wait @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedOilEdition(feedbackSandbox);
  expect((await request.get('/api/v1/ops/oil-benchmarks')).status()).toBe(401);
  await oilOperator(request);
  expect(
    (
      await request.post('/api/v1/ops/oil-benchmarks/refresh', {
        headers: { Origin: 'https://untrusted.example' },
        data: { requestId: randomUUID() },
      })
    ).status(),
  ).toBe(403);
  const blocker = await oilDatabase(feedbackSandbox),
    observer = await oilDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query(
      "SELECT id FROM oil_benchmark_head WHERE id='world-bank-oil-benchmarks' FOR UPDATE",
    );
    pending = request.get('/api/v1/ops/oil-benchmarks');
    await waitForQueryBlocked(
      observer,
      'SELECT version,status,edition,published_edition,checked_at,reviewed_at FROM oil_benchmark_head WHERE id=$1 FOR SHARE',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('ROLLBACK');
    const response = await pending;
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain('observations');
    await oilOperator(request);
    expect((await request.get('/api/v1/ops/oil-benchmarks')).status()).toBe(
      200,
    );
    expect(
      OilBenchmarkPublicSchema.parse(
        await (await request.get('/api/v1/oil-benchmarks')).json(),
      ).edition,
    ).toBeNull();
  } finally {
    try {
      await blocker.query('ROLLBACK');
      await pending?.catch(() => {});
    } finally {
      await Promise.all([blocker.end(), observer.end()]);
    }
  }
});
test('E2E-API-746 competing instances cannot admit a second actual refresh during an admitted capture @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  const raw = oilRaw(await oilWorkbook());
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    admitted = new Promise<void>((resolve) => {
      entered = resolve;
    });
  let secondCalls = 0;
  const first = await oilStorage(feedbackSandbox, async () => {
    entered();
    await gate;
    return raw;
  });
  const second = await oilStorage(feedbackSandbox, async () => {
    secondCalls++;
    return raw;
  });
  const pending = first.store.refresh(
    { requestId: randomUUID() },
    async () => {},
  );
  try {
    await admitted;
    await expect(
      second.store.refresh({ requestId: randomUUID() }, async () => {}),
    ).rejects.toMatchObject({ status: 409 });
    expect(secondCalls).toBe(0);
    release();
    expect(await pending).toMatchObject({ status: 'succeeded', edition: 1 });
  } finally {
    release();
    await pending.catch(() => {});
    await Promise.all([first.close(), second.close()]);
  }
});
test('E2E-API-747 actual relational write failure rolls back partial edition but preserves linked raw quarantine evidence @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const pool = await oilDatabase(feedbackSandbox);
  try {
    await pool.query(
      "CREATE FUNCTION oil_fixture_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic oil storage fault'; END; $$",
    );
    await pool.query(
      'CREATE TRIGGER oil_fixture_reject BEFORE INSERT ON oil_benchmark_observations FOR EACH ROW EXECUTE FUNCTION oil_fixture_reject()',
    );
    const { run, raw } = await captureOilFixture(feedbackSandbox);
    expect(run).toMatchObject({
      status: 'failed',
      category: 'storage',
      sourceHash: raw.hash,
    });
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM oil_benchmark_editions'))
          .rows[0].n,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await pool.query(
            'SELECT count(*) AS n FROM oil_benchmark_observations',
          )
        ).rows[0].n,
      ),
    ).toBe(0);
    await oilOperator(request);
    expect(
      (
        await request.get(
          `/api/v1/ops/oil-benchmarks/retained/${run.requestId}`,
        )
      ).status(),
    ).toBe(200);
    expect(
      OilBenchmarkOperationsSchema.parse(
        await (await request.get('/api/v1/ops/oil-benchmarks')).json(),
      ).head.version,
    ).toBe(0);
  } finally {
    try {
      await pool.query(
        'DROP TRIGGER IF EXISTS oil_fixture_reject ON oil_benchmark_observations',
      );
      await pool.query('DROP FUNCTION IF EXISTS oil_fixture_reject()');
    } finally {
      await pool.end();
    }
  }
});
test('E2E-API-748 bounded public edition and protected review pages preserve integer ordering without writes @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await seedOilEdition(feedbackSandbox),
    pool = await oilDatabase(feedbackSandbox);
  try {
    // Synthetic immutable pagination population only; these are not 51 provider captures/reviews.
    await pool.query('BEGIN');
    await pool.query(
      "INSERT INTO oil_benchmark_editions(edition,retrieved_at,source_hash,canonical_hash,payload) SELECT n,retrieved_at,source_hash,canonical_hash,jsonb_set(payload,'{edition}',to_jsonb(n)) FROM oil_benchmark_editions CROSS JOIN generate_series(2,51) n WHERE edition=1",
    );
    await pool.query(
      'INSERT INTO oil_benchmark_observations(edition,series,period,value,source_value) SELECT n,series,period,value,source_value FROM oil_benchmark_observations CROSS JOIN generate_series(2,51) n WHERE edition=1',
    );
    await pool.query(
      "INSERT INTO oil_benchmark_reviews(request_id,fingerprint,edition,status,head_version,reviewed_at,payload) SELECT id,repeat('a',64),n,'published',n*2,$1::timestamptz,jsonb_build_object('requestId',id,'sourceId','world-bank-oil-benchmarks','headVersion',n*2,'edition',n,'status','published','correctionNote','Synthetic pagination fixture only','reviewedAt',$1::text) FROM (SELECT n,gen_random_uuid() AS id FROM generate_series(1,51) n) x",
      [first.retrievedAt],
    );
    await pool.query(
      "UPDATE oil_benchmark_head SET version=102,edition=51,published_edition=51,status='published',reviewed_at=$1",
      [first.retrievedAt],
    );
    await pool.query('COMMIT');
    await oilOperator(request);
    const page = OilBenchmarkHistorySchema.parse(
      await (await request.get('/api/v1/oil-benchmarks/history')).json(),
    );
    expect(page.editions).toHaveLength(50);
    expect(page.editions[0]?.edition).toBe(51);
    expect(page.nextBefore).toBe(2);
    const last = OilBenchmarkHistorySchema.parse(
      await (
        await request.get('/api/v1/oil-benchmarks/history?before=2')
      ).json(),
    );
    expect(last.editions.map((value) => value.edition)).toEqual([1]);
    expect(last.nextBefore).toBeNull();
    const reviews = OilBenchmarkReviewsSchema.parse(
      await (await request.get('/api/v1/ops/oil-benchmarks/reviews')).json(),
    );
    expect(reviews.reviews).toHaveLength(50);
    expect(reviews.nextBefore).toBe(4);
    expect(
      OilBenchmarkReviewsSchema.parse(
        await (
          await request.get('/api/v1/ops/oil-benchmarks/reviews?before=4')
        ).json(),
      ).reviews.map((value) => value.headVersion),
    ).toEqual([2]);
    for (const query of [
      '?before=0',
      '?before=2&unexpected=true',
      '?before=2&before=1',
    ])
      expect(
        (await request.get('/api/v1/oil-benchmarks/history' + query)).status(),
      ).toBe(400);
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM oil_benchmark_reviews'))
          .rows[0].n,
      ),
    ).toBe(51);
  } finally {
    try {
      await pool.query('ROLLBACK');
    } finally {
      await pool.end();
    }
  }
});
test('E2E-API-749 expiry during the actual final review write rolls back publication and receipt @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedOilEdition(feedbackSandbox);
  await oilOperator(request);
  const blocker = await oilDatabase(feedbackSandbox),
    observer = await oilDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.put> | undefined;
  try {
    await observer.query(
      'CREATE FUNCTION oil_fixture_wait() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(360749); RETURN NEW; END; $$',
    );
    await observer.query(
      'CREATE TRIGGER oil_fixture_wait BEFORE INSERT ON oil_benchmark_reviews FOR EACH ROW EXECUTE FUNCTION oil_fixture_wait()',
    );
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query('SELECT pg_advisory_xact_lock(360749)');
    pending = request.put('/api/v1/ops/oil-benchmarks/review', {
      headers: oilHeaders,
      data: {
        requestId: randomUUID(),
        expectedVersion: 1,
        status: 'published',
        correctionNote: 'Synthetic final-write admission test.',
      },
    });
    await waitForQueryBlocked(
      observer,
      'INSERT INTO oil_benchmark_reviews(request_id,fingerprint,edition,status,head_version,reviewed_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('ROLLBACK');
    expect((await pending).status()).toBe(401);
    expect(
      Number(
        (
          await observer.query(
            'SELECT count(*) AS n FROM oil_benchmark_reviews',
          )
        ).rows[0].n,
      ),
    ).toBe(0);
    expect(
      (await observer.query('SELECT version,status FROM oil_benchmark_head'))
        .rows[0],
    ).toMatchObject({ version: 1, status: 'draft' });
    await oilOperator(request);
    expect(
      (await request.get('/api/v1/ops/oil-benchmarks/editions/1')).status(),
    ).toBe(200);
  } finally {
    try {
      await blocker.query('ROLLBACK');
      await pending?.catch(() => {});
      await observer.query(
        'DROP TRIGGER IF EXISTS oil_fixture_wait ON oil_benchmark_reviews',
      );
      await observer.query('DROP FUNCTION IF EXISTS oil_fixture_wait()');
    } finally {
      await Promise.all([blocker.end(), observer.end()]);
    }
  }
});
test('E2E-API-751 actual A to B to A retrieval appends a new immutable edition without restoring the original receipt @EIA-BENCHMARKS-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const xml = await oilWorkbook(),
    first = await seedOilEdition(feedbackSandbox, xml);
  await oilOperator(request);
  await reviewOil(request);
  const second = await seedOilEdition(
    feedbackSandbox,
    await oilWorkbook({ brent: '21.3' }),
  );
  const raw = oilRaw(
      xml,
      new Date(Date.parse(second.retrievedAt) + 1).toISOString(),
    ),
    storage = await oilStorage(feedbackSandbox, async () => raw);
  try {
    const run = await storage.store.refresh(
      { requestId: randomUUID() },
      async () => {},
    );
    expect(run).toMatchObject({
      status: 'succeeded',
      category: 'changed',
      edition: 3,
      sourceHash: raw.hash,
    });
    const overview = OilBenchmarkOperationsSchema.parse(
      await (await request.get('/api/v1/ops/oil-benchmarks')).json(),
    );
    expect(overview.latest?.observations).toEqual(first.observations);
    expect(overview.latest?.sourceHash).not.toBe(first.sourceHash);
    expect(
      OilBenchmarkPublicSchema.parse(
        await (await request.get('/api/v1/oil-benchmarks')).json(),
      ).edition,
    ).toEqual(first);
    expect(
      await (await request.get('/api/v1/ops/oil-benchmarks/editions/1')).json(),
    ).toEqual(first);
    expect(
      await (await request.get('/api/v1/ops/oil-benchmarks/editions/2')).json(),
    ).toEqual(second);
    await reviewOil(request);
    expect(
      OilBenchmarkPublicSchema.parse(
        await (await request.get('/api/v1/oil-benchmarks')).json(),
      ).edition?.edition,
    ).toBe(3);
    expect(
      OilBenchmarkHistorySchema.parse(
        await (await request.get('/api/v1/oil-benchmarks/history')).json(),
      ).editions.map((value) => value.edition),
    ).toEqual([3, 1]);
  } finally {
    await storage.close();
  }
});
test.describe('oil named publication dispatch', () => {
  test.use({ namedOperators: true });
  test('E2E-API-750 actual named proposal independently approves the captured numerical draft atomically with replay @EIA-BENCHMARKS-001 @NAMED-OPERATORS-001 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    expect(feedbackSandbox.namedCredentials).toBeDefined();
    const signedIn = await request.post('/api/v1/ops/session', {
      headers: oilHeaders,
      data: feedbackSandbox.namedCredentials,
    });
    expect(signedIn.status()).toBe(200);
    expect(OperatorSessionSchema.parse(await signedIn.json()).mode).toBe(
      'named',
    );
    // Only this capture's transport is synthetic; subsequent named API requests
    // read and approve the actual Mongo/Postgres edition and immutable run receipt.
    const { run, raw } = await captureOilFixture(feedbackSandbox);
    const replay = await request.post('/api/v1/ops/oil-benchmarks/refresh', {
      headers: oilHeaders,
      data: { requestId: run.requestId },
    });
    expect(replay.status()).toBe(201);
    expect(await replay.json()).toEqual(run);
    const username = `oil_publisher_${randomUUID().slice(0, 8)}`,
      password = 'Synthetic-oil-publisher-2026';
    const created = await request.post('/api/v1/ops/operators', {
      headers: oilHeaders,
      data: { username, password, role: 'publisher' },
    });
    expect(created.status()).toBe(201);
    const identity = OperatorIdentitySchema.parse(await created.json());
    const publisher = await playwright.request.newContext({
      baseURL: feedbackSandbox.apiOrigin,
    });
    try {
      expect(
        (
          await publisher.post('/api/v1/ops/session', {
            headers: oilHeaders,
            data: { username, password },
          })
        ).status(),
      ).toBe(200);
      const id = randomUUID(),
        review = {
          requestId: randomUUID(),
          expectedVersion: 1,
          status: 'published',
          correctionNote:
            'Synthetic exact monthly oil numerical edition reviewed independently.',
        };
      expect(
        (
          await request.put('/api/v1/ops/oil-benchmarks/review', {
            headers: oilHeaders,
            data: review,
          })
        ).status(),
      ).toBe(403);
      const pending = await request.put(`/api/v1/ops/proposals/${id}`, {
        headers: oilHeaders,
        data: {
          kind: 'oil-benchmarks',
          target: 'world-bank-oil-benchmarks',
          body: review,
        },
      });
      expect(pending.status()).toBe(200);
      expect(PublicationProposalSchema.parse(await pending.json()).state).toBe(
        'pending',
      );
      expect(
        OilBenchmarkPublicSchema.parse(
          await (await request.get('/api/v1/oil-benchmarks')).json(),
        ).edition,
      ).toBeNull();
      expect(
        (
          await request.post(`/api/v1/ops/proposals/${id}/approve`, {
            headers: oilHeaders,
            data: { note: 'Self-approval is forbidden.' },
          })
        ).status(),
      ).toBe(403);
      const decision = {
        note: 'Independent synthetic acceptance review of both fixed monthly series.',
      };
      const approved = await publisher.post(
        `/api/v1/ops/proposals/${id}/approve`,
        { headers: oilHeaders, data: decision },
      );
      expect(approved.status()).toBe(201);
      const receipt = PublicationProposalSchema.parse(await approved.json());
      expect(receipt.state).toBe('approved');
      expect(receipt.reviewer?.id).toBe(identity.id);
      expect(receipt.reviewer?.id).not.toBe(receipt.proposer.id);
      expect(
        OilBenchmarkPublicSchema.parse(
          await (await request.get('/api/v1/oil-benchmarks')).json(),
        ).edition?.sourceHash,
      ).toBe(raw.hash);
      const repeated = await publisher.post(
        `/api/v1/ops/proposals/${id}/approve`,
        { headers: oilHeaders, data: decision },
      );
      expect(repeated.status()).toBe(201);
      expect(await repeated.json()).toEqual(receipt);
      const pool = await oilDatabase(feedbackSandbox);
      try {
        expect(
          Number(
            (
              await pool.query(
                'SELECT count(*) AS n FROM oil_benchmark_reviews',
              )
            ).rows[0].n,
          ),
        ).toBe(1);
        expect(
          (await pool.query('SELECT version FROM oil_benchmark_head')).rows[0]
            .version,
        ).toBe(2);
      } finally {
        await pool.end();
      }
    } finally {
      await publisher.dispose();
    }
  });
});
