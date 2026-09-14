import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  ecbXml,
  ecbRaw,
  ecbStorage,
  captureEcbFixture,
  seedEcbEdition,
  ecbDatabase,
  ecbOperator,
  ecbHeaders,
  reviewEcb,
} from '../../helpers/ecb-rates';
import {
  EcbRateOperationsSchema,
  EcbRatePublicSchema,
  EcbRateHistorySchema,
  EcbRateEvidenceSchema,
  EcbRateRetainedSchema,
  EcbRateReviewsSchema,
  OperatorIdentitySchema,
  OperatorSessionSchema,
  PublicationProposalSchema,
} from '../../../../packages/contracts/src/index';
import { waitForQueryBlocked } from '../../helpers/withdrawal-fixture';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-API-680 synthetic fixed-source transport flows through actual raw store numeric reconciliation review and evidence @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { raw, run } = await captureEcbFixture(feedbackSandbox);
  expect(run).toMatchObject({
    status: 'succeeded',
    category: 'changed',
    edition: 1,
    observationCount: 6,
    sourceHash: raw.hash,
  });
  expect(
    EcbRatePublicSchema.parse(
      await (await request.get('/api/v1/policy-rates')).json(),
    ).status,
  ).toBe('never-published');
  await ecbOperator(request);
  const { receipt } = await reviewEcb(request);
  const current = EcbRatePublicSchema.parse(
    await (await request.get('/api/v1/policy-rates')).json(),
  );
  expect(current.edition?.sourceHash).toBe(raw.hash);
  expect(current.edition?.knownAt).toBeNull();
  expect(
    current.edition?.observations.find((row) => row.series === 'MRR_FR')?.value,
  ).toBe('1.2345678');
  const evidence = EcbRateEvidenceSchema.parse(
    await (await request.get('/api/v1/policy-rates/evidence/1')).json(),
  );
  expect(evidence.edition).toEqual(current.edition);
  expect(JSON.stringify(evidence)).not.toContain('<message:');
  const retained = EcbRateRetainedSchema.parse(
    await (
      await request.get(`/api/v1/ops/policy-rates/retained/${run.requestId}`)
    ).json(),
  );
  expect(retained.body).toBe(raw.body);
  expect(retained.sourceHash).toBe(raw.hash);
  expect(
    EcbRateReviewsSchema.parse(
      await (await request.get('/api/v1/ops/policy-rates/reviews')).json(),
    ).reviews,
  ).toEqual([receipt]);
});
test('E2E-API-681 parse failure retains a real quarantine receipt without accepted or published numbers @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { raw, run } = await captureEcbFixture(
    feedbackSandbox,
    '<synthetic-invalid/>',
  );
  expect(run).toMatchObject({
    status: 'failed',
    category: 'parse',
    edition: null,
    sourceHash: raw.hash,
  });
  await ecbOperator(request);
  expect(
    EcbRateOperationsSchema.parse(
      await (await request.get('/api/v1/ops/policy-rates')).json(),
    ).latest,
  ).toBeNull();
  const retained = EcbRateRetainedSchema.parse(
    await (
      await request.get(`/api/v1/ops/policy-rates/retained/${run.requestId}`)
    ).json(),
  );
  expect(retained.body).toBe(raw.body);
  expect(
    (
      await request.post('/api/v1/ops/policy-rates/refresh', {
        headers: ecbHeaders,
        data: { requestId: run.requestId },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.put('/api/v1/ops/policy-rates/review', {
        headers: ecbHeaders,
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
test('E2E-API-682 missing previously accepted change dates fails without mutating immutable history @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await seedEcbEdition(feedbackSandbox);
  await ecbOperator(request);
  await reviewEcb(request);
  const truncated = (await ecbXml()).replace(
    '<generic:Obs><generic:ObsDimension value="2200-01-02"/><generic:ObsValue value="0.0000000"/></generic:Obs>',
    '',
  );
  expect(
    (await captureEcbFixture(feedbackSandbox, truncated)).run,
  ).toMatchObject({ status: 'failed', category: 'parse' });
  expect(
    EcbRatePublicSchema.parse(
      await (await request.get('/api/v1/policy-rates')).json(),
    ).edition,
  ).toEqual(first);
  const pool = await ecbDatabase(feedbackSandbox);
  try {
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM ecb_rate_editions'))
          .rows[0].n,
      ),
    ).toBe(1);
    await expect(
      pool.query('UPDATE ecb_rate_observations SET value=0 WHERE edition=1'),
    ).rejects.toThrow();
    await expect(pool.query('DELETE FROM ecb_rate_reviews')).rejects.toThrow();
  } finally {
    await pool.end();
  }
});
test('E2E-API-683 unchanged capture advances checked time while replay performs no provider action @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await seedEcbEdition(feedbackSandbox),
    raw = ecbRaw(
      await ecbXml(),
      new Date(Date.parse(first.retrievedAt) + 1).toISOString(),
    );
  let calls = 0;
  const storage = await ecbStorage(feedbackSandbox, async () => {
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
    await ecbOperator(request);
    const overview = EcbRateOperationsSchema.parse(
      await (await request.get('/api/v1/ops/policy-rates')).json(),
    );
    expect(overview.latest).toEqual(first);
    expect(overview.head.checkedAt).toBe(raw.retrievedAt);
    expect(
      (
        await request.post('/api/v1/ops/policy-rates/refresh', {
          headers: ecbHeaders,
          data: { requestId: randomUUID() },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await storage.close();
  }
});
test('E2E-API-684 withdrawal retires every old public edition even after later publication and old review replay @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedEcbEdition(feedbackSandbox);
  await ecbOperator(request);
  const published = await reviewEcb(request);
  await reviewEcb(request, 'withdrawn');
  for (const path of ['history', 'editions/1', 'evidence/1'])
    expect((await request.get(`/api/v1/policy-rates/${path}`)).status()).toBe(
      404,
    );
  const second = await seedEcbEdition(
    feedbackSandbox,
    (await ecbXml()).replace('-0.1250000', '-0.2500000'),
  );
  await reviewEcb(request);
  expect(
    EcbRateHistorySchema.parse(
      await (await request.get('/api/v1/policy-rates/history')).json(),
    ).editions,
  ).toEqual([second]);
  for (const path of ['editions/1', 'evidence/1'])
    expect((await request.get(`/api/v1/policy-rates/${path}`)).status()).toBe(
      404,
    );
  expect(
    (
      await request.put('/api/v1/ops/policy-rates/review', {
        headers: ecbHeaders,
        data: published.body,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.put('/api/v1/ops/policy-rates/review', {
        headers: ecbHeaders,
        data: {
          ...published.body,
          correctionNote: 'Changed same-ID input must conflict.',
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    EcbRatePublicSchema.parse(
      await (await request.get('/api/v1/policy-rates')).json(),
    ).edition,
  ).toEqual(second);
  expect(
    (await request.get('/api/v1/ops/policy-rates/editions/1')).status(),
  ).toBe(200);
});
test('E2E-API-685 operator read rechecks real session expiry after the exact source lock wait @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedEcbEdition(feedbackSandbox);
  expect((await request.get('/api/v1/ops/policy-rates')).status()).toBe(401);
  await ecbOperator(request);
  expect(
    (
      await request.post('/api/v1/ops/policy-rates/refresh', {
        headers: { Origin: 'https://untrusted.example' },
        data: { requestId: randomUUID() },
      })
    ).status(),
  ).toBe(403);
  const blocker = await ecbDatabase(feedbackSandbox),
    observer = await ecbDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query(
      "SELECT id FROM ecb_rate_head WHERE id='ecb-policy-rates' FOR UPDATE",
    );
    pending = request.get('/api/v1/ops/policy-rates');
    await waitForQueryBlocked(
      observer,
      'SELECT version,status,edition,published_edition,checked_at,reviewed_at FROM ecb_rate_head WHERE id=$1 FOR SHARE',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('ROLLBACK');
    const response = await pending;
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain('observations');
    await ecbOperator(request);
    expect((await request.get('/api/v1/ops/policy-rates')).status()).toBe(200);
    expect(
      EcbRatePublicSchema.parse(
        await (await request.get('/api/v1/policy-rates')).json(),
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
test('E2E-API-686 competing instances cannot admit a second actual refresh during an admitted capture @ECB-RATES-001 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  const raw = ecbRaw(await ecbXml());
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    admitted = new Promise<void>((resolve) => {
      entered = resolve;
    });
  let secondCalls = 0;
  const first = await ecbStorage(feedbackSandbox, async () => {
    entered();
    await gate;
    return raw;
  });
  const second = await ecbStorage(feedbackSandbox, async () => {
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
test('E2E-API-687 actual relational write failure rolls back partial edition but preserves linked raw quarantine evidence @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const pool = await ecbDatabase(feedbackSandbox);
  try {
    await pool.query(
      "CREATE FUNCTION ecb_fixture_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic ECB storage fault'; END; $$",
    );
    await pool.query(
      'CREATE TRIGGER ecb_fixture_reject BEFORE INSERT ON ecb_rate_observations FOR EACH ROW EXECUTE FUNCTION ecb_fixture_reject()',
    );
    const { run, raw } = await captureEcbFixture(feedbackSandbox);
    expect(run).toMatchObject({
      status: 'failed',
      category: 'storage',
      sourceHash: raw.hash,
    });
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM ecb_rate_editions'))
          .rows[0].n,
      ),
    ).toBe(0);
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM ecb_rate_observations'))
          .rows[0].n,
      ),
    ).toBe(0);
    await ecbOperator(request);
    expect(
      (
        await request.get(`/api/v1/ops/policy-rates/retained/${run.requestId}`)
      ).status(),
    ).toBe(200);
    expect(
      EcbRateOperationsSchema.parse(
        await (await request.get('/api/v1/ops/policy-rates')).json(),
      ).head.version,
    ).toBe(0);
  } finally {
    try {
      await pool.query(
        'DROP TRIGGER IF EXISTS ecb_fixture_reject ON ecb_rate_observations',
      );
      await pool.query('DROP FUNCTION IF EXISTS ecb_fixture_reject()');
    } finally {
      await pool.end();
    }
  }
});
test('E2E-API-688 bounded public edition and protected review pages preserve integer ordering without writes @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await seedEcbEdition(feedbackSandbox),
    pool = await ecbDatabase(feedbackSandbox);
  try {
    // Synthetic immutable pagination population only; these are not 51 provider captures/reviews.
    await pool.query('BEGIN');
    await pool.query(
      "INSERT INTO ecb_rate_editions(edition,retrieved_at,source_hash,canonical_hash,payload) SELECT n,retrieved_at,source_hash,canonical_hash,jsonb_set(payload,'{edition}',to_jsonb(n)) FROM ecb_rate_editions CROSS JOIN generate_series(2,51) n WHERE edition=1",
    );
    await pool.query(
      'INSERT INTO ecb_rate_observations(edition,series,effective_on,value) SELECT n,series,effective_on,value FROM ecb_rate_observations CROSS JOIN generate_series(2,51) n WHERE edition=1',
    );
    await pool.query(
      "INSERT INTO ecb_rate_reviews(request_id,fingerprint,edition,status,head_version,reviewed_at,payload) SELECT id,repeat('a',64),n,'published',n*2,$1::timestamptz,jsonb_build_object('requestId',id,'sourceId','ecb-policy-rates','headVersion',n*2,'edition',n,'status','published','correctionNote','Synthetic pagination fixture only','reviewedAt',$2::text) FROM (SELECT n,gen_random_uuid() AS id FROM generate_series(1,51) n) x",
      [first.retrievedAt, first.retrievedAt],
    );
    await pool.query(
      "UPDATE ecb_rate_head SET version=102,edition=51,published_edition=51,status='published',reviewed_at=$1",
      [first.retrievedAt],
    );
    await pool.query('COMMIT');
    await ecbOperator(request);
    const page = EcbRateHistorySchema.parse(
      await (await request.get('/api/v1/policy-rates/history')).json(),
    );
    expect(page.editions).toHaveLength(50);
    expect(page.editions[0]?.edition).toBe(51);
    expect(page.nextBefore).toBe(2);
    const last = EcbRateHistorySchema.parse(
      await (await request.get('/api/v1/policy-rates/history?before=2')).json(),
    );
    expect(last.editions.map((value) => value.edition)).toEqual([1]);
    expect(last.nextBefore).toBeNull();
    const reviews = EcbRateReviewsSchema.parse(
      await (await request.get('/api/v1/ops/policy-rates/reviews')).json(),
    );
    expect(reviews.reviews).toHaveLength(50);
    expect(reviews.nextBefore).toBe(4);
    expect(
      EcbRateReviewsSchema.parse(
        await (
          await request.get('/api/v1/ops/policy-rates/reviews?before=4')
        ).json(),
      ).reviews.map((value) => value.headVersion),
    ).toEqual([2]);
    for (const query of [
      '?before=0',
      '?before=2&unexpected=true',
      '?before=2&before=1',
    ])
      expect(
        (await request.get('/api/v1/policy-rates/history' + query)).status(),
      ).toBe(400);
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM ecb_rate_reviews')).rows[0]
          .n,
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
test('E2E-API-689 expiry during the actual final review write rolls back publication and receipt @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedEcbEdition(feedbackSandbox);
  await ecbOperator(request);
  const blocker = await ecbDatabase(feedbackSandbox),
    observer = await ecbDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.put> | undefined;
  try {
    await observer.query(
      'CREATE FUNCTION ecb_fixture_wait() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(360689); RETURN NEW; END; $$',
    );
    await observer.query(
      'CREATE TRIGGER ecb_fixture_wait BEFORE INSERT ON ecb_rate_reviews FOR EACH ROW EXECUTE FUNCTION ecb_fixture_wait()',
    );
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query('SELECT pg_advisory_xact_lock(360689)');
    pending = request.put('/api/v1/ops/policy-rates/review', {
      headers: ecbHeaders,
      data: {
        requestId: randomUUID(),
        expectedVersion: 1,
        status: 'published',
        correctionNote: 'Synthetic final-write admission test.',
      },
    });
    await waitForQueryBlocked(
      observer,
      'INSERT INTO ecb_rate_reviews(request_id,fingerprint,edition,status,head_version,reviewed_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('ROLLBACK');
    expect((await pending).status()).toBe(401);
    expect(
      Number(
        (await observer.query('SELECT count(*) AS n FROM ecb_rate_reviews'))
          .rows[0].n,
      ),
    ).toBe(0);
    expect(
      (await observer.query('SELECT version,status FROM ecb_rate_head'))
        .rows[0],
    ).toMatchObject({ version: 1, status: 'draft' });
    await ecbOperator(request);
    expect(
      (await request.get('/api/v1/ops/policy-rates/editions/1')).status(),
    ).toBe(200);
  } finally {
    try {
      await blocker.query('ROLLBACK');
      await pending?.catch(() => {});
      await observer.query(
        'DROP TRIGGER IF EXISTS ecb_fixture_wait ON ecb_rate_reviews',
      );
      await observer.query('DROP FUNCTION IF EXISTS ecb_fixture_wait()');
    } finally {
      await Promise.all([blocker.end(), observer.end()]);
    }
  }
});
test('E2E-API-691 actual A to B to A retrieval appends a new immutable edition without restoring the original receipt @ECB-RATES-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const xml = await ecbXml(),
    first = await seedEcbEdition(feedbackSandbox, xml);
  await ecbOperator(request);
  await reviewEcb(request);
  const second = await seedEcbEdition(
    feedbackSandbox,
    xml.replace('-0.1250000', '-0.2500000'),
  );
  const raw = ecbRaw(
      xml,
      new Date(Date.parse(second.retrievedAt) + 1).toISOString(),
    ),
    storage = await ecbStorage(feedbackSandbox, async () => raw);
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
    const overview = EcbRateOperationsSchema.parse(
      await (await request.get('/api/v1/ops/policy-rates')).json(),
    );
    expect(overview.latest?.observations).toEqual(first.observations);
    expect(overview.latest?.sourceHash).not.toBe(first.sourceHash);
    expect(
      EcbRatePublicSchema.parse(
        await (await request.get('/api/v1/policy-rates')).json(),
      ).edition,
    ).toEqual(first);
    expect(
      await (await request.get('/api/v1/ops/policy-rates/editions/1')).json(),
    ).toEqual(first);
    expect(
      await (await request.get('/api/v1/ops/policy-rates/editions/2')).json(),
    ).toEqual(second);
    await reviewEcb(request);
    expect(
      EcbRatePublicSchema.parse(
        await (await request.get('/api/v1/policy-rates')).json(),
      ).edition?.edition,
    ).toBe(3);
    expect(
      EcbRateHistorySchema.parse(
        await (await request.get('/api/v1/policy-rates/history')).json(),
      ).editions.map((value) => value.edition),
    ).toEqual([3, 1]);
  } finally {
    await storage.close();
  }
});
test.describe('ECB named publication dispatch', () => {
  test.use({ namedOperators: true });
  test('E2E-API-690 actual named proposal independently approves the captured numerical draft atomically with replay @ECB-RATES-001 @NAMED-OPERATORS-001 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    expect(feedbackSandbox.namedCredentials).toBeDefined();
    const signedIn = await request.post('/api/v1/ops/session', {
      headers: ecbHeaders,
      data: feedbackSandbox.namedCredentials,
    });
    expect(signedIn.status()).toBe(200);
    expect(OperatorSessionSchema.parse(await signedIn.json()).mode).toBe(
      'named',
    );
    // Only this capture's transport is synthetic; subsequent named API requests
    // read and approve the actual Mongo/Postgres edition and immutable run receipt.
    const { run, raw } = await captureEcbFixture(feedbackSandbox);
    const replay = await request.post('/api/v1/ops/policy-rates/refresh', {
      headers: ecbHeaders,
      data: { requestId: run.requestId },
    });
    expect(replay.status()).toBe(201);
    expect(await replay.json()).toEqual(run);
    const username = `ecb_publisher_${randomUUID().slice(0, 8)}`,
      password = 'Synthetic-ECB-publisher-2026';
    const created = await request.post('/api/v1/ops/operators', {
      headers: ecbHeaders,
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
            headers: ecbHeaders,
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
            'Synthetic exact ECB numerical edition reviewed independently.',
        };
      expect(
        (
          await request.put('/api/v1/ops/policy-rates/review', {
            headers: ecbHeaders,
            data: review,
          })
        ).status(),
      ).toBe(403);
      const pending = await request.put(`/api/v1/ops/proposals/${id}`, {
        headers: ecbHeaders,
        data: { kind: 'ecb-rates', target: 'ecb-policy-rates', body: review },
      });
      expect(pending.status()).toBe(200);
      expect(PublicationProposalSchema.parse(await pending.json()).state).toBe(
        'pending',
      );
      expect(
        EcbRatePublicSchema.parse(
          await (await request.get('/api/v1/policy-rates')).json(),
        ).edition,
      ).toBeNull();
      expect(
        (
          await request.post(`/api/v1/ops/proposals/${id}/approve`, {
            headers: ecbHeaders,
            data: { note: 'Self-approval is forbidden.' },
          })
        ).status(),
      ).toBe(403);
      const decision = {
        note: 'Independent synthetic acceptance review of all three fixed series.',
      };
      const approved = await publisher.post(
        `/api/v1/ops/proposals/${id}/approve`,
        { headers: ecbHeaders, data: decision },
      );
      expect(approved.status()).toBe(201);
      const receipt = PublicationProposalSchema.parse(await approved.json());
      expect(receipt.state).toBe('approved');
      expect(receipt.reviewer?.id).toBe(identity.id);
      expect(receipt.reviewer?.id).not.toBe(receipt.proposer.id);
      expect(
        EcbRatePublicSchema.parse(
          await (await request.get('/api/v1/policy-rates')).json(),
        ).edition?.sourceHash,
      ).toBe(raw.hash);
      const repeated = await publisher.post(
        `/api/v1/ops/proposals/${id}/approve`,
        { headers: ecbHeaders, data: decision },
      );
      expect(repeated.status()).toBe(201);
      expect(await repeated.json()).toEqual(receipt);
      const pool = await ecbDatabase(feedbackSandbox);
      try {
        expect(
          Number(
            (await pool.query('SELECT count(*) AS n FROM ecb_rate_reviews'))
              .rows[0].n,
          ),
        ).toBe(1);
        expect(
          (await pool.query('SELECT version FROM ecb_rate_head')).rows[0]
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
