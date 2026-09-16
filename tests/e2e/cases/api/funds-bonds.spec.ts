import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  publishNav,
  fundFixture,
  fundAccount,
  retentionHeaders,
  loginRetentionOperator,
} from '../../helpers/funds-bonds';
import {
  FundsListSchema,
  FundDetailSchema,
  FundsSnapshotSchema,
  SavedBondComparisonSchema,
} from '../../../../packages/contracts/src/index';
test('E2E-API-1080 synthetic NAV actual raw persistence exact history snapshot and withdrawal @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const id = await publishNav(request),
    list = FundsListSchema.parse(
      await (await request.get('/api/v1/funds')).json(),
    );
  expect(list.funds).toHaveLength(2);
  expect(list.funds[0]?.observation.nav).toBe('123.456700');
  expect(list.funds[1]?.observation.nav).toBeNull();
  const detail = FundDetailSchema.parse(
    await (await request.get('/api/v1/funds/108001')).json(),
  );
  expect(detail.lookThrough).toBe('not-connected');
  expect(
    (await (await request.get(`/api/v1/ops/funds/${id}/evidence`)).json()).body,
  ).toBe((await fundFixture()).navText);
  expect(
    FundsSnapshotSchema.parse(
      await (await request.get('/api/v1/funds/snapshot')).json(),
    ).totalSchemeCount,
  ).toBe(2);
  expect(
    (
      await request.post('/api/v1/ops/funds/review', {
        headers: retentionHeaders,
        data: {
          requestId: randomUUID(),
          editionId: id,
          decision: 'withdraw',
          reason: 'Synthetic withdrawal acceptance',
        },
      })
    ).status(),
  ).toBe(201);
  expect((await request.get('/api/v1/funds/108001')).status()).toBe(404);
});
test('E2E-API-1081 private exact bond comparison persists replays exports and deletes @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  await fundAccount(request);
  const { comparison } = await fundFixture(),
    id = randomUUID(),
    path = `/api/v1/account/bond-comparisons/${id}`;
  const response = await request.put(path, {
    headers: retentionHeaders,
    data: comparison,
  });
  expect(response.status()).toBe(200);
  const saved = SavedBondComparisonSchema.parse(await response.json());
  expect(saved.result.accruedPaise).toBe('4972');
  expect(saved.result.depositMaturityPaise).toBe('108634');
  expect(
    await (
      await request.put(path, { headers: retentionHeaders, data: comparison })
    ).json(),
  ).toEqual(saved);
  expect(
    (
      await request.put(path, {
        headers: retentionHeaders,
        data: { ...comparison, feesPaise: '101' },
      })
    ).status(),
  ).toBe(409);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await fundAccount(other);
    expect(
      (await other.delete(path, { headers: retentionHeaders })).status(),
    ).toBe(404);
  } finally {
    await other.dispose();
  }
  expect(
    (await (await request.get('/api/v1/account/privacy/export')).json())
      .bondComparisons.comparisons[0].id,
  ).toBe(id);
  expect(
    (await request.delete(path, { headers: retentionHeaders })).status(),
  ).toBe(200);
  expect(
    (
      await request.put(path, { headers: retentionHeaders, data: comparison })
    ).status(),
  ).toBe(410);
  expect(
    (await (await request.get('/api/v1/account/bond-comparisons')).json())
      .comparisons,
  ).toEqual([]);
});
test('E2E-API-1082 missing written permission and malformed NAV remain unpublished @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  request,
}) => {
  await loginRetentionOperator(request);
  const payload = {
    requestId: randomUUID(),
    permissionReference: 'Synthetic fixture source',
    writtenPermissionConfirmed: false,
    body: (await fundFixture()).navText,
  };
  expect(
    (
      await request.post('/api/v1/ops/funds/import', {
        headers: retentionHeaders,
        data: payload,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/v1/ops/funds/import', {
        headers: retentionHeaders,
        data: {
          ...payload,
          writtenPermissionConfirmed: true,
          body: '<html>error</html>',
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    FundsListSchema.parse(await (await request.get('/api/v1/funds')).json())
      .funds,
  ).toEqual([]);
});

test('E2E-API-1084 current AMFI plan/option format retains v2 provenance and searchable distinct schemes @FUNDS-BONDS-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const { publishNavV2 } = await import('../../helpers/funds-bonds');
  const { edition } = await publishNavV2(request);
  expect(edition.parser).toBe('amfi-navall-v2');
  expect(edition.sourceUrl).toBe(
    'https://portal.amfiindia.com/spages/NAVAll.txt',
  );
  const list = await request.get('/api/v1/funds?q=Direct%20Plan');
  expect(list.status()).toBe(200);
  expect((await list.json()).funds).toHaveLength(1);
  const detail = await request.get('/api/v1/funds/900001');
  expect((await detail.json()).history[0].observation).toMatchObject({
    plan: 'Direct Plan',
    option: 'Growth Option',
    nav: '123.4500',
  });
});
