import { actionPlanInput } from '../../helpers/action-plan';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  ActionCentreReceiptSchema,
  ActionCentreListSchema,
  calculateActionCentre,
  SavedGoalSchema,
  HoldingsSnapshotSchema,
} from '../../../../packages/contracts/src/index';
import { actionCentreInput } from '../../helpers/action-centre';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
async function fixture() {
  const at = new Date().toISOString(),
    userId = randomUUID();
  const goal = SavedGoalSchema.parse({
    id: randomUUID(),
    version: 1,
    name: 'Synthetic comparison goal',
    type: 'education',
    targetMinor: '100000',
    savedMinor: '1000',
    monthlyMinor: '100',
    horizonMonths: 12,
    currency: 'INR',
    scale: 2,
    assumptions: 'no-growth-nominal-v1',
    storageConsent: true,
    createdAt: at,
    updatedAt: at,
    projectedMinor: '2200',
    gapMinor: '97800',
  });
  const holdings = HoldingsSnapshotSchema.parse({
    version: 1,
    holdings: [
      { isin: 'INE002A01018', quantity: '3.000001', totalCostMinor: '10000' },
    ],
    totalCostMinor: '10000',
    currency: 'INR',
    scale: 2,
    provenance: 'user-entered-unverified',
    updatedAt: at,
  });
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    sessionUserId: userId,
    users: {
      [userId]: {
        id: userId,
        username: 'synthetic',
        passwordHash: 'synthetic',
        passwordSalt: 'synthetic',
        createdAt: at,
        consentedAt: at,
      },
    },
    data: {
      localGoals: {
        [userId]: { [goal.id]: { revisions: [goal], deletedAt: null } },
      },
      localHoldings: { [userId]: { revisions: [holdings], previews: {} } },
    },
  };
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  bundle.equityCoverage = { capturedAt: at, companies: [] };
  return { at, goal, holdings, state, bundle };
}
test('E2E-OFFLINE-990 exact local educational comparison persists replays invalidates and deletes without network @ACTION-CENTRE-001 @TEST-SIMULATION', async () => {
  const { handleActionCentre, exportLocalActionCentre } =
    await import('../../../../apps/web/src/offline/action-centre');
  const { goal, holdings, state, bundle } = await fixture(),
    input = actionCentreInput(goal.id),
    originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('Local comparison must not call network.');
  };
  try {
    const request = {
      path: '/api/v1/account/action-centre/' + randomUUID(),
      method: 'PUT',
      headers: new Headers(),
      query: new URLSearchParams(),
      body: input,
    };
    const receipt = ActionCentreReceiptSchema.parse(
      (await handleActionCentre(request, state, bundle))!.body,
    );
    expect(receipt.result.proposal.projectedGoalMinor).toBe('21900');
    expect(receipt.result.proposal.remainingQuantity).toBe('2.000001');
    expect(
      (await handleActionCentre(request, structuredClone(state), bundle))!.body,
    ).toEqual(receipt);
    expect(
      exportLocalActionCentre(state, state.sessionUserId!).assessments,
    ).toEqual([receipt]);
    state.data.localHoldings = {
      [state.sessionUserId!]: {
        revisions: [holdings, { ...holdings, version: 2 }],
        previews: {},
      },
    };
    const view = ActionCentreListSchema.parse(
      (await handleActionCentre(
        { ...request, path: '/api/v1/account/action-centre', method: 'GET' },
        state,
        bundle,
      ))!.body,
    );
    expect(view.assessments[0]!.reviewReasons).toContain(
      'Your holdings changed. Review a new comparison.',
    );
    await expect(
      handleActionCentre(
        { ...request, path: '/api/v1/account/action-centre/' + randomUUID() },
        state,
        bundle,
      ),
    ).rejects.toThrow(/changed/);
    await handleActionCentre({ ...request, method: 'DELETE' }, state, bundle);
    expect(
      exportLocalActionCentre(state, state.sessionUserId!).assessments,
    ).toEqual([]);
    await expect(handleActionCentre(request, state, bundle)).rejects.toThrow(
      /deleted/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test('E2E-OFFLINE-991 golden no-action fees liquidity concentration turnover downside and cooldown outcomes @ACTION-CENTRE-001 @TEST-SIMULATION', async () => {
  const { at, goal, holdings } = await fixture(),
    input = actionCentreInput(goal.id),
    original = JSON.stringify({ goal, holdings });
  const baseline = calculateActionCentre(input, holdings, goal, at);
  expect(baseline.baseline).toMatchObject({
    holdingQuantity: '3.000001',
    holdingCostMinor: '10000',
    portfolioCostMinor: '10000',
    projectedGoalMinor: '2200',
    goalGapMinor: '97800',
  });
  expect(baseline.proposal).toMatchObject({
    disposedCostMinor: '3333',
    remainingHoldingCostMinor: '6667',
    stressedLossMinor: '667',
    grossProceedsMinor: '20000',
    netProceedsMinor: '19700',
    projectedGoalMinor: '21900',
  });
  const cases = [
    {
      input: {
        ...input,
        costs: { ...input.costs, feeMinor: '60000', taxMinor: '0' },
      },
      id: 'net-proceeds',
    },
    {
      input: {
        ...input,
        limits: { ...input.limits, executableQuantity: '0.5' },
      },
      id: 'liquidity',
    },
    {
      input: {
        ...input,
        limits: { ...input.limits, maximumConcentrationBps: 5000 },
      },
      id: 'concentration',
    },
    {
      input: {
        ...input,
        limits: { ...input.limits, previousTurnoverCostMinor: '1000' },
      },
      id: 'turnover',
    },
    {
      input: {
        ...input,
        suitability: { ...input.suitability, lossCapacityMinor: '666' },
      },
      id: 'downside-capacity',
    },
    {
      input: {
        ...input,
        limits: { ...input.limits, lastDisposalOn: at.slice(0, 10) },
      },
      id: 'cooldown',
    },
    {
      input: { ...input, limits: { ...input.limits, settlementDays: 31 } },
      id: 'settlement',
    },
  ];
  for (const item of cases) {
    const result = calculateActionCentre(item.input, holdings, goal, at);
    expect(result.classification).toBe('constraints-breached');
    expect(
      result.constraints.find((constraint) => constraint.id === item.id)
        ?.status,
    ).toBe('breached');
    expect(result.action).toBe('none-educational-comparison');
  }
  expect(
    calculateActionCentre(
      { ...input, earmarkNetProceeds: false },
      holdings,
      goal,
      at,
    ).proposal.projectedGoalMinor,
  ).toBe('2200');
  expect(
    calculateActionCentre(
      { ...input, costs: { ...input.costs, feeMinor: '80000' } },
      holdings,
      goal,
      at,
    ).proposal.afterCashMinor,
  ).toBe('-10200');
  expect(() =>
    calculateActionCentre({ ...input, quantity: '4' }, holdings, goal, at),
  ).toThrow(/exceeds/);
  expect(JSON.stringify({ goal, holdings })).toBe(original);
});

test('E2E-OFFLINE-1280 local buy and FIFO rebalance preserve exact positions and private replay without network @ACTION-CENTRE-001 @TEST-SIMULATION', async () => {
  const { handleActionCentre } =
    await import('../../../../apps/web/src/offline/action-centre');
  const { goal, state, bundle } = await fixture(),
    before = structuredClone(state.data.localHoldings),
    originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw Error('No network allowed.');
  };
  try {
    for (const kind of ['rebalance', 'buy', 'sell-fifo'] as const) {
      const request = {
        path: '/api/v1/account/action-centre/' + randomUUID(),
        method: 'PUT',
        headers: new Headers(),
        query: new URLSearchParams(),
        body: actionPlanInput(goal.id, kind),
      };
      if (request.body.plan?.purchase)
        request.body.plan.purchase.asOf = new Date(Date.now() - 9 * 86400000)
          .toISOString()
          .slice(0, 10);
      const receipt = ActionCentreReceiptSchema.parse(
        (await handleActionCentre(request, state, bundle))!.body,
      );
      expect(receipt.policy).toBe('proposed-trades-education-v2');
      expect(receipt.result.proposal.afterCashMinor).toBe(
        kind === 'rebalance' ? '59700' : kind === 'buy' ? '29700' : '69700',
      );
      expect(
        (await handleActionCentre(request, structuredClone(state), bundle))!
          .body,
      ).toEqual(receipt);
      if (kind === 'rebalance') {
        const list = ActionCentreListSchema.parse(
          (await handleActionCentre(
            {
              ...request,
              path: '/api/v1/account/action-centre',
              method: 'GET',
            },
            state,
            bundle,
          ))!.body,
        );
        expect(
          list.assessments.find((item) => item.receipt.id === receipt.id)
            ?.reviewReasons,
        ).toContain('Purchase price is beyond the seven-day review window.');
        expect(
          list.assessments.find((item) => item.receipt.id === receipt.id)
            ?.receipt,
        ).toEqual(receipt);
      }
      expect(state.data.localHoldings).toEqual(before);
      await handleActionCentre({ ...request, method: 'DELETE' }, state, bundle);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('E2E-OFFLINE-1283 local eligible tax policy reconstructs exact retained tax and cash @ACTION-CENTRE-001 @TEST-SIMULATION', async () => {
  const { actionTaxProfile } = await import('../../helpers/action-plan');
  const { handleActionCentre } =
    await import('../../../../apps/web/src/offline/action-centre');
  const { goal, state, bundle } = await fixture();
  const input = actionPlanInput(goal.id);
  input.costs.taxMinor = '0';
  input.plan!.taxProfile = actionTaxProfile();
  const receipt = ActionCentreReceiptSchema.parse(
    (await handleActionCentre(
      {
        path: '/api/v1/account/action-centre/' + randomUUID(),
        method: 'PUT',
        headers: new Headers(),
        query: new URLSearchParams(),
        body: input,
      },
      state,
      bundle,
    ))!.body,
  );
  expect(receipt.result.plan?.tax?.taxMinor).toBe('2328');
  expect(receipt.result.proposal.afterCashMinor).toBe('57572');
});
