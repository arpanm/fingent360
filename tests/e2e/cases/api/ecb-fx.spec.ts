import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  fxXml,
  fxRaw,
  fxStorage,
  captureFxFixture,
  seedFxEdition,
  fxDatabase,
  fxOperator,
  fxHeaders,
  reviewFx,
} from '../../helpers/ecb-fx';
import {
  EcbFxOperationsSchema,
  EcbFxPublicSchema,
  EcbFxHistorySchema,
  EcbFxEvidenceSchema,
  EcbFxRetainedSchema,
  EcbFxReviewsSchema,
  OperatorIdentitySchema,
  OperatorSessionSchema,
  PublicationProposalSchema,
} from '../../../../packages/contracts/src/index';
import { waitForQueryBlocked } from '../../helpers/withdrawal-fixture';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test('E2E-API-810 synthetic fixed-source transport flows through actual raw store numeric reconciliation review and evidence @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { raw, run } = await captureFxFixture(feedbackSandbox);
  expect(run).toMatchObject({
    status: 'succeeded',
    category: 'changed',
    edition: 1,
    sourceHash: raw.hash,
  });
  expect(
    EcbFxPublicSchema.parse(
      await (await request.get('/api/v1/reference-fx')).json(),
    ).status,
  ).toBe('never-published');
  await fxOperator(request);
  const { receipt } = await reviewFx(request);
  const current = EcbFxPublicSchema.parse(
    await (await request.get('/api/v1/reference-fx')).json(),
  );
  expect(current.edition?.sourceHash).toBe(raw.hash);
  expect(current.edition?.knownAt).toBeNull();
  expect(current.edition?.observations.length).toBe(run.observationCount);
  expect(
    current.edition?.observations.every(
      (row) => row.derivedInrPerUsd.methodVersion === 'f360-inr-per-usd-v1',
    ),
  ).toBe(true);
  expect(current.edition?.comparison.previousEdition).toBeNull();
  const evidence = EcbFxEvidenceSchema.parse(
    await (await request.get('/api/v1/reference-fx/evidence/1')).json(),
  );
  expect(evidence.edition).toEqual(current.edition);
  expect(JSON.stringify(evidence)).not.toContain('gesmes:Envelope');
  expect(evidence).not.toHaveProperty('body');
  const retained = EcbFxRetainedSchema.parse(
    await (
      await request.get(`/api/v1/ops/reference-fx/retained/${run.requestId}`)
    ).json(),
  );
  expect(retained.body).toBe(raw.body);
  expect(retained.sourceHash).toBe(raw.hash);
  expect(
    EcbFxReviewsSchema.parse(
      await (await request.get('/api/v1/ops/reference-fx/reviews')).json(),
    ).reviews,
  ).toEqual([receipt]);
});
test('E2E-API-811 parse failure retains a real quarantine receipt without accepted or published numbers @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { raw, run } = await captureFxFixture(
    feedbackSandbox,
    'synthetic invalid XML',
  );
  expect(run).toMatchObject({
    status: 'failed',
    category: 'parse',
    edition: null,
    sourceHash: raw.hash,
  });
  await fxOperator(request);
  expect(
    EcbFxOperationsSchema.parse(
      await (await request.get('/api/v1/ops/reference-fx')).json(),
    ).latest,
  ).toBeNull();
  const retained = EcbFxRetainedSchema.parse(
    await (
      await request.get(`/api/v1/ops/reference-fx/retained/${run.requestId}`)
    ).json(),
  );
  expect(retained.body).toBe(raw.body);
  expect(
    (
      await request.post('/api/v1/ops/reference-fx/refresh', {
        headers: fxHeaders,
        data: { requestId: run.requestId },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.put('/api/v1/ops/reference-fx/review', {
        headers: fxHeaders,
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
test('E2E-API-812 rolling-window absent dates are disclosed without erasing reviewed originals or inferring provider withdrawal @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await seedFxEdition(feedbackSandbox);
  await fxOperator(request);
  await reviewFx(request);
  const changed = await captureFxFixture(
    feedbackSandbox,
    await fxXml({ dropOldest: true }),
  );
  expect(changed.run).toMatchObject({
    status: 'succeeded',
    category: 'changed',
    edition: 2,
  });
  const state = EcbFxOperationsSchema.parse(
    await (await request.get('/api/v1/ops/reference-fx')).json(),
  );
  expect(state.latest?.comparison.previousEdition).toBe(1);
  expect(state.latest?.comparison.absentDates).toHaveLength(1);
  expect(state.latest?.observations).toHaveLength(
    first.observations.length - 1,
  );
  expect(
    EcbFxPublicSchema.parse(
      await (await request.get('/api/v1/reference-fx')).json(),
    ).edition,
  ).toEqual(first);
  await reviewFx(request);
  const history = EcbFxHistorySchema.parse(
    await (await request.get('/api/v1/reference-fx/history')).json(),
  );
  expect(history.editions).toEqual([state.latest, first]);
  const pool = await fxDatabase(feedbackSandbox);
  try {
    await expect(
      pool.query(
        'UPDATE ecb_fx_observations SET usd_per_eur=0 WHERE edition=1',
      ),
    ).rejects.toThrow();
    await expect(pool.query('DELETE FROM ecb_fx_reviews')).rejects.toThrow();
  } finally {
    await pool.end();
  }
});
test('E2E-API-813 unchanged capture advances checked time while replay performs no provider action @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await seedFxEdition(feedbackSandbox),
    raw = fxRaw(
      await fxXml(),
      new Date(Date.parse(first.retrievedAt) + 1).toISOString(),
    );
  let calls = 0;
  const storage = await fxStorage(feedbackSandbox, async () => {
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
    await fxOperator(request);
    const overview = EcbFxOperationsSchema.parse(
      await (await request.get('/api/v1/ops/reference-fx')).json(),
    );
    expect(overview.latest).toEqual(first);
    expect(overview.head.checkedAt).toBe(raw.retrievedAt);
    expect(
      (
        await request.post('/api/v1/ops/reference-fx/refresh', {
          headers: fxHeaders,
          data: { requestId: randomUUID() },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await storage.close();
  }
});
test('E2E-API-814 withdrawal retires every old public edition even after later publication and old review replay @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedFxEdition(feedbackSandbox);
  await fxOperator(request);
  const published = await reviewFx(request);
  await reviewFx(request, 'withdrawn');
  for (const path of ['history', 'editions/1', 'evidence/1'])
    expect((await request.get(`/api/v1/reference-fx/${path}`)).status()).toBe(
      404,
    );
  const second = await seedFxEdition(
    feedbackSandbox,
    await fxXml({ usd: '2.123400' }),
  );
  await reviewFx(request);
  expect(
    EcbFxHistorySchema.parse(
      await (await request.get('/api/v1/reference-fx/history')).json(),
    ).editions,
  ).toEqual([second]);
  for (const path of ['editions/1', 'evidence/1'])
    expect((await request.get(`/api/v1/reference-fx/${path}`)).status()).toBe(
      404,
    );
  expect(
    (
      await request.put('/api/v1/ops/reference-fx/review', {
        headers: fxHeaders,
        data: published.body,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.put('/api/v1/ops/reference-fx/review', {
        headers: fxHeaders,
        data: {
          ...published.body,
          correctionNote: 'Changed same-ID input must conflict.',
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    EcbFxPublicSchema.parse(
      await (await request.get('/api/v1/reference-fx')).json(),
    ).edition,
  ).toEqual(second);
  expect(
    (await request.get('/api/v1/ops/reference-fx/editions/1')).status(),
  ).toBe(200);
});
test('E2E-API-815 operator read rechecks real session expiry after the exact source lock wait @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedFxEdition(feedbackSandbox);
  expect((await request.get('/api/v1/ops/reference-fx')).status()).toBe(401);
  await fxOperator(request);
  expect(
    (
      await request.post('/api/v1/ops/reference-fx/refresh', {
        headers: { Origin: 'https://untrusted.example' },
        data: { requestId: randomUUID() },
      })
    ).status(),
  ).toBe(403);
  const blocker = await fxDatabase(feedbackSandbox),
    observer = await fxDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.get> | undefined;
  try {
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query(
      "SELECT id FROM ecb_fx_head WHERE id='ecb-reference-fx' FOR UPDATE",
    );
    pending = request.get('/api/v1/ops/reference-fx');
    await waitForQueryBlocked(
      observer,
      'SELECT version,status,edition,published_edition,checked_at,reviewed_at FROM ecb_fx_head WHERE id=$1 FOR SHARE',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('ROLLBACK');
    const response = await pending;
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain('observations');
    await fxOperator(request);
    expect((await request.get('/api/v1/ops/reference-fx')).status()).toBe(200);
    expect(
      EcbFxPublicSchema.parse(
        await (await request.get('/api/v1/reference-fx')).json(),
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
test('E2E-API-816 competing instances cannot admit a second actual refresh during an admitted capture @ECB-FX-001 @TEST-SIMULATION', async ({
  feedbackSandbox,
}) => {
  const raw = fxRaw(await fxXml());
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    admitted = new Promise<void>((resolve) => {
      entered = resolve;
    });
  let secondCalls = 0;
  const first = await fxStorage(feedbackSandbox, async () => {
    entered();
    await gate;
    return raw;
  });
  const second = await fxStorage(feedbackSandbox, async () => {
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
test('E2E-API-817 actual relational write failure rolls back partial edition but preserves linked raw quarantine evidence @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const pool = await fxDatabase(feedbackSandbox);
  try {
    await pool.query(
      "CREATE FUNCTION fx_fixture_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic FX storage fault'; END; $$",
    );
    await pool.query(
      'CREATE TRIGGER fx_fixture_reject BEFORE INSERT ON ecb_fx_observations FOR EACH ROW EXECUTE FUNCTION fx_fixture_reject()',
    );
    const { run, raw } = await captureFxFixture(feedbackSandbox);
    expect(run).toMatchObject({
      status: 'failed',
      category: 'storage',
      sourceHash: raw.hash,
    });
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM ecb_fx_editions')).rows[0]
          .n,
      ),
    ).toBe(0);
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM ecb_fx_observations'))
          .rows[0].n,
      ),
    ).toBe(0);
    await fxOperator(request);
    expect(
      (
        await request.get(`/api/v1/ops/reference-fx/retained/${run.requestId}`)
      ).status(),
    ).toBe(200);
    expect(
      EcbFxOperationsSchema.parse(
        await (await request.get('/api/v1/ops/reference-fx')).json(),
      ).head.version,
    ).toBe(0);
  } finally {
    try {
      await pool.query(
        'DROP TRIGGER IF EXISTS fx_fixture_reject ON ecb_fx_observations',
      );
      await pool.query('DROP FUNCTION IF EXISTS fx_fixture_reject()');
    } finally {
      await pool.end();
    }
  }
});
test('E2E-API-818 bounded public edition and protected review pages preserve integer ordering without writes @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const first = await seedFxEdition(feedbackSandbox),
    pool = await fxDatabase(feedbackSandbox);
  try {
    // Synthetic immutable pagination population only; these are not 51 provider captures/reviews.
    await pool.query('BEGIN');
    await pool.query(
      "INSERT INTO ecb_fx_editions(edition,retrieved_at,source_hash,canonical_hash,payload) SELECT n,retrieved_at,source_hash,canonical_hash,jsonb_set(payload,'{edition}',to_jsonb(n)) FROM ecb_fx_editions CROSS JOIN generate_series(2,51) n WHERE edition=1",
    );
    await pool.query(
      'INSERT INTO ecb_fx_observations(edition,observed_on,usd_per_eur,inr_per_eur,usd_source,inr_source,derived_inr_per_usd) SELECT n,observed_on,usd_per_eur,inr_per_eur,usd_source,inr_source,derived_inr_per_usd FROM ecb_fx_observations CROSS JOIN generate_series(2,51) n WHERE edition=1',
    );
    await pool.query(
      "INSERT INTO ecb_fx_reviews(request_id,fingerprint,edition,status,head_version,reviewed_at,payload) SELECT id,repeat('a',64),n,'published',n*2,$1::timestamptz,jsonb_build_object('requestId',id,'sourceId','ecb-reference-fx','headVersion',n*2,'edition',n,'status','published','correctionNote','Synthetic pagination fixture only','reviewedAt',$1::text) FROM (SELECT n,gen_random_uuid() AS id FROM generate_series(1,51) n) x",
      [first.retrievedAt],
    );
    await pool.query(
      "UPDATE ecb_fx_head SET version=102,edition=51,published_edition=51,status='published',reviewed_at=$1",
      [first.retrievedAt],
    );
    await pool.query('COMMIT');
    await fxOperator(request);
    const page = EcbFxHistorySchema.parse(
      await (await request.get('/api/v1/reference-fx/history')).json(),
    );
    expect(page.editions).toHaveLength(50);
    expect(page.editions[0]?.edition).toBe(51);
    expect(page.nextBefore).toBe(2);
    const last = EcbFxHistorySchema.parse(
      await (await request.get('/api/v1/reference-fx/history?before=2')).json(),
    );
    expect(last.editions.map((value) => value.edition)).toEqual([1]);
    expect(last.nextBefore).toBeNull();
    const reviews = EcbFxReviewsSchema.parse(
      await (await request.get('/api/v1/ops/reference-fx/reviews')).json(),
    );
    expect(reviews.reviews).toHaveLength(50);
    expect(reviews.nextBefore).toBe(4);
    expect(
      EcbFxReviewsSchema.parse(
        await (
          await request.get('/api/v1/ops/reference-fx/reviews?before=4')
        ).json(),
      ).reviews.map((value) => value.headVersion),
    ).toEqual([2]);
    for (const query of [
      '?before=0',
      '?before=2&unexpected=true',
      '?before=2&before=1',
    ])
      expect(
        (await request.get('/api/v1/reference-fx/history' + query)).status(),
      ).toBe(400);
    expect(
      Number(
        (await pool.query('SELECT count(*) AS n FROM ecb_fx_reviews')).rows[0]
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
test('E2E-API-819 expiry during the actual final review write rolls back publication and receipt @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await seedFxEdition(feedbackSandbox);
  await fxOperator(request);
  const blocker = await fxDatabase(feedbackSandbox),
    observer = await fxDatabase(feedbackSandbox);
  let pending: ReturnType<typeof request.put> | undefined;
  try {
    await observer.query(
      'CREATE FUNCTION fx_fixture_wait() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(360819); RETURN NEW; END; $$',
    );
    await observer.query(
      'CREATE TRIGGER fx_fixture_wait BEFORE INSERT ON ecb_fx_reviews FOR EACH ROW EXECUTE FUNCTION fx_fixture_wait()',
    );
    await blocker.query('BEGIN');
    const pid = Number(
      (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    await blocker.query('SELECT pg_advisory_xact_lock(360819)');
    pending = request.put('/api/v1/ops/reference-fx/review', {
      headers: fxHeaders,
      data: {
        requestId: randomUUID(),
        expectedVersion: 1,
        status: 'published',
        correctionNote: 'Synthetic final-write admission test.',
      },
    });
    await waitForQueryBlocked(
      observer,
      'INSERT INTO ecb_fx_reviews(request_id,fingerprint,edition,status,head_version,reviewed_at,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [pid],
    );
    await observer.query(
      "UPDATE operator_sessions SET expires_at=clock_timestamp()-interval '1 second'",
    );
    await blocker.query('ROLLBACK');
    expect((await pending).status()).toBe(401);
    expect(
      Number(
        (await observer.query('SELECT count(*) AS n FROM ecb_fx_reviews'))
          .rows[0].n,
      ),
    ).toBe(0);
    expect(
      (await observer.query('SELECT version,status FROM ecb_fx_head')).rows[0],
    ).toMatchObject({ version: 1, status: 'draft' });
    await fxOperator(request);
    expect(
      (await request.get('/api/v1/ops/reference-fx/editions/1')).status(),
    ).toBe(200);
  } finally {
    try {
      await blocker.query('ROLLBACK');
      await pending?.catch(() => {});
      await observer.query(
        'DROP TRIGGER IF EXISTS fx_fixture_wait ON ecb_fx_reviews',
      );
      await observer.query('DROP FUNCTION IF EXISTS fx_fixture_wait()');
    } finally {
      await Promise.all([blocker.end(), observer.end()]);
    }
  }
});
test('E2E-API-822 source lexical precision revisions remain distinct while exact derived values reconstruct unchanged @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const xml = await fxXml(),
    first = await seedFxEdition(feedbackSandbox, xml);
  const next = xml.replace(
    /(currency=["']USD["']\s+rate=["'])([0-9]+\.[0-9]+)/,
    (_match, prefix: string, decimal: string) => prefix + decimal + '0',
  );
  expect(next).not.toBe(xml);
  const result = await captureFxFixture(feedbackSandbox, next);
  expect(result.run).toMatchObject({
    status: 'succeeded',
    category: 'changed',
    edition: 2,
  });
  await fxOperator(request);
  const latest = EcbFxOperationsSchema.parse(
    await (await request.get('/api/v1/ops/reference-fx')).json(),
  ).latest!;
  expect(latest.comparison.changedDates).toHaveLength(1);
  expect(latest.observations.map((row) => row.derivedInrPerUsd)).toEqual(
    first.observations.map((row) => row.derivedInrPerUsd),
  );
  expect(latest.observations).not.toEqual(first.observations);
  expect(latest.sourceHash).not.toBe(first.sourceHash);
});
test('E2E-API-821 actual A to B to A retrieval appends a new immutable edition without restoring the original receipt @ECB-FX-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const xml = await fxXml(),
    first = await seedFxEdition(feedbackSandbox, xml);
  await fxOperator(request);
  await reviewFx(request);
  const second = await seedFxEdition(
    feedbackSandbox,
    await fxXml({ usd: '2.123400' }),
  );
  const raw = fxRaw(
      xml,
      new Date(Date.parse(second.retrievedAt) + 1).toISOString(),
    ),
    storage = await fxStorage(feedbackSandbox, async () => raw);
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
    const overview = EcbFxOperationsSchema.parse(
      await (await request.get('/api/v1/ops/reference-fx')).json(),
    );
    expect(overview.latest?.observations).toEqual(first.observations);
    expect(overview.latest?.sourceHash).not.toBe(first.sourceHash);
    expect(
      EcbFxPublicSchema.parse(
        await (await request.get('/api/v1/reference-fx')).json(),
      ).edition,
    ).toEqual(first);
    expect(
      await (await request.get('/api/v1/ops/reference-fx/editions/1')).json(),
    ).toEqual(first);
    expect(
      await (await request.get('/api/v1/ops/reference-fx/editions/2')).json(),
    ).toEqual(second);
    await reviewFx(request);
    expect(
      EcbFxPublicSchema.parse(
        await (await request.get('/api/v1/reference-fx')).json(),
      ).edition?.edition,
    ).toBe(3);
    expect(
      EcbFxHistorySchema.parse(
        await (await request.get('/api/v1/reference-fx/history')).json(),
      ).editions.map((value) => value.edition),
    ).toEqual([3, 1]);
  } finally {
    await storage.close();
  }
});
test.describe('FX named publication dispatch', () => {
  test.use({ namedOperators: true });
  test('E2E-API-820 actual named proposal independently approves the captured numerical draft atomically with replay @ECB-FX-001 @NAMED-OPERATORS-001 @TEST-SIMULATION', async ({
    request,
    playwright,
    feedbackSandbox,
  }) => {
    expect(feedbackSandbox.namedCredentials).toBeDefined();
    const signedIn = await request.post('/api/v1/ops/session', {
      headers: fxHeaders,
      data: feedbackSandbox.namedCredentials,
    });
    expect(signedIn.status()).toBe(200);
    expect(OperatorSessionSchema.parse(await signedIn.json()).mode).toBe(
      'named',
    );
    // Only this capture's transport is synthetic; subsequent named API requests
    // read and approve the actual Mongo/Postgres edition and immutable run receipt.
    const { run, raw } = await captureFxFixture(feedbackSandbox);
    const replay = await request.post('/api/v1/ops/reference-fx/refresh', {
      headers: fxHeaders,
      data: { requestId: run.requestId },
    });
    expect(replay.status()).toBe(201);
    expect(await replay.json()).toEqual(run);
    const username = `fx_publisher_${randomUUID().slice(0, 8)}`,
      password = 'Synthetic-fx-publisher-2026';
    const created = await request.post('/api/v1/ops/operators', {
      headers: fxHeaders,
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
            headers: fxHeaders,
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
            'Synthetic exact ECB reference inputs and cross-rate reviewed independently.',
        };
      expect(
        (
          await request.put('/api/v1/ops/reference-fx/review', {
            headers: fxHeaders,
            data: review,
          })
        ).status(),
      ).toBe(403);
      const pending = await request.put(`/api/v1/ops/proposals/${id}`, {
        headers: fxHeaders,
        data: { kind: 'ecb-fx', target: 'ecb-reference-fx', body: review },
      });
      expect(pending.status()).toBe(200);
      expect(PublicationProposalSchema.parse(await pending.json()).state).toBe(
        'pending',
      );
      expect(
        EcbFxPublicSchema.parse(
          await (await request.get('/api/v1/reference-fx')).json(),
        ).edition,
      ).toBeNull();
      expect(
        (
          await request.post(`/api/v1/ops/proposals/${id}/approve`, {
            headers: fxHeaders,
            data: { note: 'Self-approval is forbidden.' },
          })
        ).status(),
      ).toBe(403);
      const decision = {
        note: 'Independent synthetic acceptance review of both unchanged same-date references and marked calculation.',
      };
      const approved = await publisher.post(
        `/api/v1/ops/proposals/${id}/approve`,
        { headers: fxHeaders, data: decision },
      );
      expect(approved.status()).toBe(201);
      const receipt = PublicationProposalSchema.parse(await approved.json());
      expect(receipt.state).toBe('approved');
      expect(receipt.reviewer?.id).toBe(identity.id);
      expect(receipt.reviewer?.id).not.toBe(receipt.proposer.id);
      expect(
        EcbFxPublicSchema.parse(
          await (await request.get('/api/v1/reference-fx')).json(),
        ).edition?.sourceHash,
      ).toBe(raw.hash);
      const repeated = await publisher.post(
        `/api/v1/ops/proposals/${id}/approve`,
        { headers: fxHeaders, data: decision },
      );
      expect(repeated.status()).toBe(201);
      expect(await repeated.json()).toEqual(receipt);
      const pool = await fxDatabase(feedbackSandbox);
      try {
        expect(
          Number(
            (await pool.query('SELECT count(*) AS n FROM ecb_fx_reviews'))
              .rows[0].n,
          ),
        ).toBe(1);
        expect(
          (await pool.query('SELECT version FROM ecb_fx_head')).rows[0].version,
        ).toBe(2);
      } finally {
        await pool.end();
      }
    } finally {
      await publisher.dispose();
    }
  });
});
