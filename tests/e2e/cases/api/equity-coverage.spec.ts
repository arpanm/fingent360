import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  equityInput,
  publishEquity,
  publishUdiff,
  loginRetentionOperator,
  retentionHeaders,
} from '../../helpers/equity-coverage';
import {
  EquityCompanySchema,
  EquitySnapshotSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-API-900 five synthetic families retain exact values, source receipt, replay and withdrawal @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const payload = await publishEquity(request);
  const detail = EquityCompanySchema.parse(
    await (await request.get('/api/v1/equities/INE002A01018')).json(),
  );
  expect(detail.records).toHaveLength(5);
  expect(
    detail.records.find((r) => r.observation.kind === 'price')?.observation,
  ).toMatchObject({ close: '123.4500', volume: '9007199254740993' });
  const evidence = await (
    await request.get(`/api/v1/ops/equities/${payload.requestId}/evidence`)
  ).json();
  expect(evidence.body).toBe(payload.body);
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: payload,
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: { ...payload, rightsBasis: 'Different permission statement' },
      })
    ).status(),
  ).toBe(409);
  const snapshot = EquitySnapshotSchema.parse(
    await (await request.get('/api/v1/equities/snapshot')).json(),
  );
  expect(snapshot.companies[0]?.records).toHaveLength(5);
  expect(
    (
      await request.post('/api/v1/ops/equities/review', {
        headers: retentionHeaders,
        data: {
          requestId: randomUUID(),
          editionId: payload.requestId,
          decision: 'withdraw',
          reason: 'Synthetic withdrawal acceptance.',
        },
      })
    ).status(),
  ).toBe(201);
  expect((await request.get('/api/v1/equities/INE002A01018')).status()).toBe(
    404,
  );
  expect(
    EquitySnapshotSchema.parse(
      await (await request.get('/api/v1/equities/snapshot')).json(),
    ).companies,
  ).toHaveLength(0);
});
test('E2E-API-901 unauthenticated, missing rights and malformed source cannot publish @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const payload = await equityInput();
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: payload,
      })
    ).status(),
  ).toBe(401);
  await loginRetentionOperator(request);
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: { ...payload, rightsConfirmed: false },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: { ...payload, body: '<!DOCTYPE html>blocked' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await (await request.get('/api/v1/equities')).json()).companies,
  ).toEqual([]);
});

test('E2E-API-902 UDiFF retained CSV produces searchable exact reviewed quotes and rejects wrong filename @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const payload = await publishUdiff(request);
  const detail = EquityCompanySchema.parse(
    await (await request.get('/api/v1/equities/INE002A01018')).json(),
  );
  expect(detail.name).toBe('Synthetic UDiFF company');
  expect(detail.records[0]?.observation).toMatchObject({
    close: '123.450000',
    udiff: { open: '123.100000', high: '124.000000', low: '122.000000' },
  });
  expect(
    (await (await request.get('/api/v1/equities?q=SYNTHETIC')).json())
      .companies,
  ).toHaveLength(1);
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: {
          ...payload,
          requestId: randomUUID(),
          sourceFileName: 'wrong.csv',
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await (
        await request.get(`/api/v1/ops/equities/${payload.requestId}/evidence`)
      ).json()
    ).body,
  ).toBe(payload.body);
});

test('E2E-API-904 action CSV retains source and identity provenance, future ex-date, replay and snapshot @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const { publishActions } = await import('../../helpers/equity-coverage');
  const { payload, edition, identity } = await publishActions(request);
  expect(edition.observations[0]).toMatchObject({
    kind: 'corporate-action',
    effectiveOn: '2025-01-31',
    adjustment: 'not-applied',
    nseAction: { exOn: '2025-02-03', identityEditionId: identity.requestId },
  });
  const evidence = await request.get(
    `/api/v1/ops/equities/${payload.requestId}/evidence`,
  );
  expect(evidence.status()).toBe(200);
  expect((await evidence.json()).body).toBe(payload.body);
  const replay = await request.post('/api/v1/ops/equities/import', {
    headers: retentionHeaders,
    data: payload,
  });
  expect(replay.status()).toBe(201);
  expect(await replay.json()).toEqual(edition);
  const snapshot = EquitySnapshotSchema.parse(
    await (await request.get('/api/v1/equities/snapshot')).json(),
  );
  expect(
    snapshot.companies[0]?.records.find(
      (r) => r.editionId === payload.requestId,
    )?.observation,
  ).toEqual(edition.observations[0]);
});

test('E2E-API-905 action CSV rejects missing identity and malformed date without publishing @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const { actionInput } = await import('../../helpers/equity-coverage');
  await loginRetentionOperator(request);
  const payload = await actionInput();
  expect(
    (
      await request.post('/api/v1/ops/equities/import', {
        headers: retentionHeaders,
        data: payload,
      })
    ).status(),
  ).toBe(400);
  await publishEquity(request);
  for (const body of [
    payload.body.replace('03-Feb-2025', '31-Feb-2025'),
    payload.body.replace('SYNTHETIC,', 'UNRESOLVED,'),
    payload.body.replace('FACE VALUE', 'FACE_VALUE'),
  ]) {
    expect(
      (
        await request.post('/api/v1/ops/equities/import', {
          headers: retentionHeaders,
          data: { ...payload, requestId: randomUUID(), body },
        })
      ).status(),
    ).toBe(400);
  }
});

test('E2E-API-906 official-layout synthetic Ind AS source retains exact period facts and source receipt @EQUITY-COVERAGE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const { publishIndas } = await import('../../helpers/equity-coverage');
  const { payload, edition } = await publishIndas(request);
  expect(edition.observations).toHaveLength(4);
  expect(edition.observations[1]).toMatchObject({
    metric: 'profit-after-tax',
    value: '-12.3400',
    scale: 'lakhs',
    basis: 'consolidated',
  });
  const evidence = await request.get(
    `/api/v1/ops/equities/${payload.requestId}/evidence`,
  );
  expect((await evidence.json()).body).toBe(payload.body);
  const detail = EquityCompanySchema.parse(
    await (await request.get('/api/v1/equities/INE002A01018')).json(),
  );
  expect(detail.records).toHaveLength(4);
  for (const data of [
    {
      ...payload,
      requestId: randomUUID(),
      sourceUrl: 'https://example.com/statement.html',
    },
    {
      ...payload,
      requestId: randomUUID(),
      body: payload.body.replace('INR', 'USD'),
    },
  ])
    expect(
      (
        await request.post('/api/v1/ops/equities/import', {
          headers: retentionHeaders,
          data,
        })
      ).status(),
    ).toBe(400);
});
