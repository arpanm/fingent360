import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  prepareConnectionAccount,
  connectionHeaders as headers,
} from '../../helpers/research-connection-fixture';
import { actionCentreInput } from '../../helpers/action-centre';
import {
  ActionCentreReceiptSchema,
  ActionCentreListSchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-990 exact disposal comparison persists replays exports and deletes without changing finances @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const goal = await prepareConnectionAccount(request),
    input = actionCentreInput(goal.id),
    path = '/api/v1/account/action-centre/' + randomUUID();
  const before = await (
    await request.get('/api/v1/account/privacy/export')
  ).json();
  const response = await request.put(path, { headers, data: input });
  expect(response.status()).toBe(200);
  const saved = ActionCentreReceiptSchema.parse(await response.json());
  expect(saved.result.proposal).toMatchObject({
    grossProceedsMinor: '20000',
    feeMinor: '100',
    taxMinor: '200',
    netProceedsMinor: '19700',
    disposedCostMinor: '3333',
    remainingQuantity: '2.000001',
    remainingHoldingCostMinor: '6667',
    afterCashMinor: '69700',
    projectedGoalMinor: '21900',
    goalGapMinor: '78100',
    stressedLossMinor: '667',
  });
  expect(saved.result.baseline.projectedGoalMinor).toBe('2200');
  expect(saved.result.classification).toBe('needs-review');
  expect(
    await (await request.put(path, { headers, data: input })).json(),
  ).toEqual(saved);
  expect(
    (
      await request.put(path, { headers, data: { ...input, quantity: '2' } })
    ).status(),
  ).toBe(409);
  const after = await (
    await request.get('/api/v1/account/privacy/export')
  ).json();
  expect(after.holdings).toEqual(before.holdings);
  expect(after.goals).toEqual(before.goals);
  expect(after.actionCentre.assessments).toContainEqual(saved);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await prepareConnectionAccount(other);
    expect((await other.delete(path, { headers })).status()).toBe(404);
  } finally {
    await other.dispose();
  }
  expect((await request.delete(path, { headers })).status()).toBe(200);
  expect(
    ActionCentreListSchema.parse(
      await (await request.get('/api/v1/account/action-centre')).json(),
    ).assessments,
  ).toEqual([]);
  expect((await request.put(path, { headers, data: input })).status()).toBe(
    410,
  );
});
test('E2E-API-991 insufficient units invalid bindings and explicit breached policy remain safe @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const goal = await prepareConnectionAccount(request),
    input = actionCentreInput(goal.id),
    base = '/api/v1/account/action-centre/';
  for (const invalid of [
    { ...input, quantity: '4' },
    { ...input, holdingsVersion: 99 },
    { ...input, goalVersion: 99 },
    {
      ...input,
      price: {
        ...input.price,
        basis: 'published-equity-close',
        editionId: randomUUID(),
        sourceHash: 'a'.repeat(64),
      },
    },
  ])
    expect(
      (
        await request.put(base + randomUUID(), { headers, data: invalid })
      ).status(),
    ).toBe(409);
  const breached = {
    ...input,
    limits: {
      ...input.limits,
      executableQuantity: '0.5',
      maximumConcentrationBps: 5000,
      turnoverBudgetBps: 1000,
      lastDisposalOn: new Date().toISOString().slice(0, 10),
    },
  };
  const response = await request.put(base + randomUUID(), {
    headers,
    data: breached,
  });
  expect(response.status()).toBe(200);
  const saved = ActionCentreReceiptSchema.parse(await response.json());
  expect(saved.result.classification).toBe('constraints-breached');
  expect(
    saved.result.constraints
      .filter((item) => item.status === 'breached')
      .map((item) => item.id),
  ).toEqual(
    expect.arrayContaining([
      'liquidity',
      'concentration',
      'turnover',
      'cooldown',
    ]),
  );
  expect(saved.result.action).toBe('none-educational-comparison');
});
