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
