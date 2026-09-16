import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  spfInput,
} from '../../helpers/gdp-expectations';
import { gdpOriginalInputs } from '../../helpers/bea-gdp-original';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { automaticPublicationConfig } from '../../helpers/research-auto-publication';
import { originalGdpItem } from '../../../../apps/api/src/bea-gdp-original-provider';
import { sourceHash } from '../../../../apps/api/src/discovery-provider';
import {
  GdpExpectationPublicSchema,
  parseSpfGdp,
  parseBeaGdpOriginal,
  compareGdpExpectation,
} from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1620 independently reviewed original SPF expectation compares with real BEA vintage and retains final reconstruction @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    data = spfInput();
  const pool = await connectionDatabase(feedbackSandbox),
    { mongo } = await automaticPublicationConfig(feedbackSandbox);
  try {
    const raw = (await gdpOriginalInputs())[0]!,
      item = originalGdpItem(raw);
    await mongo.db().collection('discovery_raw').insertOne({
      _id: raw.hash,
      url: raw.url,
      body: raw.body,
      retrievedAt: raw.retrievedAt,
    });
    await pool.query('INSERT INTO discovery_items(id,version) VALUES($1,1)', [
      item.id,
    ]);
    await pool.query(
      'INSERT INTO discovery_versions(item_id,version,data) VALUES($1,1,$2)',
      [item.id, item],
    );
    expect(
      (
        await reviewer.put('/api/v1/ops/discovery/items/' + item.id, {
          headers: retentionHeaders,
          data: {
            expectedVersion: 1,
            status: 'published',
            correctionNote:
              'Synthetic reconstruction of actual original GDP release values.',
          },
        })
      ).status(),
    ).toBe(200);
    const capture = await request.post('/api/v1/ops/gdp-expectations/import', {
      headers: retentionHeaders,
      data,
    });
    expect(capture.status(), await capture.text()).toBe(201);
    const review = {
      requestId: randomUUID(),
      editionId: data.requestId,
      decision: 'publish',
      reason: 'Independently review published median and original report day.',
    };
    expect(
      (
        await request.post('/api/v1/ops/gdp-expectations/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await reviewer.post('/api/v1/ops/gdp-expectations/review', {
          headers: retentionHeaders,
          data: review,
        })
      ).status(),
    ).toBe(201);
    const publicData = GdpExpectationPublicSchema.parse(
      await (await request.get('/api/v1/gdp-expectations')).json(),
    );
    expect(publicData.expectations).toHaveLength(1);
    const expected = publicData.expectations[0]!,
      actual = publicData.actuals.items[0]!;
    expect(
      compareGdpExpectation(
        expected.expectation,
        actual.original,
        expected.reviewedAt,
      ),
    ).toMatchObject({
      status: 'comparable',
      difference: '1.80',
      contemporaneous: false,
    });
    expect(
      (
        await pool.query(
          'SELECT count(*)::integer AS n FROM gdp_expectation_views',
        )
      ).rows[0].n,
    ).toBe(1);
    expect(
      (
        await (
          await request.get(
            `/api/v1/ops/gdp-expectations/${data.requestId}/evidence`,
          )
        ).json()
      ).body,
    ).toBe(data.body);
    expect(
      (
        await reviewer.post('/api/v1/ops/gdp-expectations/review', {
          headers: retentionHeaders,
          data: { ...review, requestId: randomUUID(), decision: 'withdraw' },
        })
      ).status(),
    ).toBe(201);
    expect(
      GdpExpectationPublicSchema.parse(
        await (await request.get('/api/v1/gdp-expectations')).json(),
      ).expectations,
    ).toEqual([]);
  } finally {
    await Promise.allSettled([reviewer.dispose(), pool.end(), mongo.close()]);
  }
});
test('E2E-API-1621 median column quarter annualization and known-at gates reject misleading expectation comparisons @EVENT-SCENARIOS-001 @TEST-SIMULATION', async () => {
  const data = spfInput(),
    raw = {
      url: data.url,
      body: data.body,
      hash: sourceHash(data.url, data.body),
      retrievedAt: '2026-09-15T00:00:00.000Z',
    },
    expectation = parseSpfGdp(raw),
    actual = parseBeaGdpOriginal((await gdpOriginalInputs())[0]!);
  for (const body of [
    data.body.replace('>New<', '>Previous<'),
    data.body.replace('2025:Q2', '2025:Q3'),
    data.body.replace('>1.5<', '>1.4<'),
    data.body.replace('annual rate', 'annual-average rate'),
    data.body.replace('16 May', '16 Aug'),
  ])
    expect(() => parseSpfGdp({ ...raw, body })).toThrow();
  expect(compareGdpExpectation(expectation, actual)).toMatchObject({
    contemporaneous: false,
    difference: '1.80',
  });
  const early = { ...expectation, retrievedAt: '2025-05-17T00:00:00.000Z' };
  expect(
    compareGdpExpectation(early, actual, '2025-05-18T00:00:00.000Z')
      .contemporaneous,
  ).toBe(true);
  expect(
    compareGdpExpectation(early, actual, '2026-01-01T00:00:00.000Z')
      .contemporaneous,
  ).toBe(false);
});
test('E2E-API-1623 original GDP public snapshot refuses silently truncating reviewed editions @EVENT-SCENARIOS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox),
    pool = await connectionDatabase(feedbackSandbox),
    data = spfInput();
  try {
    expect(
      (
        await request.post('/api/v1/ops/gdp-expectations/import', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(201);
    const publication = {
      requestId: randomUUID(),
      editionId: data.requestId,
      decision: 'publish',
      reason: 'Independent original synthetic source inspection.',
    };
    expect(
      (
        await reviewer.post('/api/v1/ops/gdp-expectations/review', {
          headers: retentionHeaders,
          data: publication,
        })
      ).status(),
    ).toBe(201);
    /* Explicit isolated storage-volume simulation; does not claim100 independent editorial reviews. */ await pool.query(
      "WITH ids AS MATERIALIZED (SELECT gen_random_uuid() AS id FROM generate_series(1,100)), inserted AS (INSERT INTO gdp_expectation_editions(id,fingerprint,payload) SELECT ids.id,'synthetic-capacity-fixture',jsonb_set(e.payload,'{id}',to_jsonb(ids.id::text)) FROM ids CROSS JOIN gdp_expectation_editions e WHERE e.id=$1 RETURNING id) INSERT INTO gdp_expectation_reviews(request_id,edition_id,actor_id,decision,reason) SELECT gen_random_uuid(),id,'synthetic-capacity-reviewer','publish','Synthetic snapshot capacity setup' FROM inserted",
      [data.requestId],
    );
    const response = await request.get('/api/v1/gdp-expectations');
    expect(response.status()).toBe(409);
    expect(await response.text()).toContain('GDP snapshot limit reached');
  } finally {
    await pool.end();
    await reviewer.dispose();
  }
});
