import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  prepareConnectionAccount,
  connectionHeaders as headers,
} from '../../helpers/research-connection-fixture';
import { actionPlanInput } from '../../helpers/action-plan';
import {
  ActionCentreReceiptSchema,
  ActionCentreListSchema,
} from '../../../../packages/contracts/src/index';
test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-1280 reconciled FIFO rebalance and purchase save replay export delete without changing actual finances @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const goal = await prepareConnectionAccount(request),
    before = await (await request.get('/api/v1/account/privacy/export')).json();
  for (const kind of ['rebalance', 'buy', 'sell-fifo'] as const) {
    const input = actionPlanInput(goal.id, kind),
      path = '/api/v1/account/action-centre/' + randomUUID();
    if (input.plan?.purchase)
      input.plan.purchase.asOf = new Date(Date.now() - 9 * 86400000)
        .toISOString()
        .slice(0, 10);
    const response = await request.put(path, { headers, data: input });
    expect(response.status(), await response.text()).toBe(200);
    const receipt = ActionCentreReceiptSchema.parse(await response.json());
    expect(receipt.policy).toBe('proposed-trades-education-v2');
    expect(receipt.result.plan?.kind).toBe(kind);
    if (kind === 'rebalance') {
      expect(receipt.result.plan).toMatchObject({
        purchaseCostMinor: '10000',
        saleGrossMinor: '20000',
        realizedGainMinor: '18000',
        lotDisposals: [
          {
            reference: 'Synthetic opening A',
            costMinor: '2000',
            proceedsMinor: '20000',
            gainMinor: '18000',
          },
        ],
      });
      expect(receipt.result.proposal).toMatchObject({
        afterCashMinor: '59700',
        remainingPortfolioCostMinor: '18000',
        remainingQuantity: '2.000001',
        projectedGoalMinor: '11900',
      });
    } else if (kind === 'buy') {
      expect(receipt.result.proposal).toMatchObject({
        afterCashMinor: '29700',
        remainingPortfolioCostMinor: '30000',
        remainingQuantity: '4.000001',
        projectedGoalMinor: '2200',
      });
      expect(receipt.result.plan?.lotDisposals).toEqual([]);
    }
    expect(
      await (await request.put(path, { headers, data: input })).json(),
    ).toEqual(receipt);
    if (kind === 'rebalance') {
      const list = ActionCentreListSchema.parse(
        await (await request.get('/api/v1/account/action-centre')).json(),
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
    const exported = await (
      await request.get('/api/v1/account/privacy/export')
    ).json();
    expect(exported.holdings).toEqual(before.holdings);
    expect(exported.goals).toEqual(before.goals);
    expect(exported.actionCentre.assessments).toContainEqual(receipt);
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
    expect((await request.put(path, { headers, data: input })).status()).toBe(
      410,
    );
  }
});
test('E2E-API-1281 missing or conflicting open lots are rejected and unfunded purchase is explicitly breached @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const goal = await prepareConnectionAccount(request),
    input = actionPlanInput(goal.id),
    plan = input.plan!;
  for (const invalid of [
    { ...input, plan: { ...plan, lots: plan.lots.slice(1) } },
    {
      ...input,
      plan: {
        ...plan,
        lots: plan.lots.map((l) => ({ ...l, reference: 'duplicate' })),
      },
    },
    {
      ...input,
      plan: {
        ...plan,
        lots: plan.lots.map((l) => ({ ...l, acquiredOn: '2099-01-01' })),
      },
    },
    {
      ...input,
      plan: { ...plan, purchase: { ...plan.purchase!, isin: input.isin } },
    },
  ])
    expect([400, 409]).toContain(
      (
        await request.put('/api/v1/account/action-centre/' + randomUUID(), {
          headers,
          data: invalid,
        })
      ).status(),
    );
  const buy = actionPlanInput(goal.id, 'buy');
  buy.suitability.availableCashMinor = '1';
  const response = await request.put(
    '/api/v1/account/action-centre/' + randomUUID(),
    { headers, data: buy },
  );
  expect(response.status()).toBe(200);
  const receipt = ActionCentreReceiptSchema.parse(await response.json());
  expect(receipt.result.classification).toBe('constraints-breached');
  expect(
    receipt.result.constraints.find((c) => c.id === 'net-proceeds')?.status,
  ).toBe('breached');
});

test('E2E-API-1282 private comparison ciphertext is owner and receipt bound and deletion erases it @ACTION-CENTRE-001 @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const { connectionDatabase } =
    await import('../../helpers/research-connection-fixture');
  const goal = await prepareConnectionAccount(request),
    input = actionPlanInput(goal.id, 'buy'),
    ids = [randomUUID(), randomUUID()];
  for (const id of ids)
    expect(
      (
        await request.put('/api/v1/account/action-centre/' + id, {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(200);
  const pool = await connectionDatabase(feedbackSandbox);
  const stored = await pool.query(
    'SELECT id,payload,encrypted_payload,content_hash FROM app_action_centre WHERE id=ANY($1::uuid[]) ORDER BY id',
    [ids],
  );
  const original = stored.rows.find((row: { id: string }) => row.id === ids[0]);
  const other = stored.rows.find((row: { id: string }) => row.id === ids[1]);
  try {
    expect(stored.rows).toHaveLength(2);
    for (const row of stored.rows) {
      expect(row.payload).toBeNull();
      expect(row.content_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(row.encrypted_payload)).not.toContain('Synthetic');
    }
    await pool.query(
      'UPDATE app_action_centre SET encrypted_payload=$2 WHERE id=$1',
      [ids[0], other.encrypted_payload],
    );
    expect((await request.get('/api/v1/account/action-centre')).status()).toBe(
      503,
    );
    await pool.query(
      'UPDATE app_action_centre SET encrypted_payload=$2 WHERE id=$1',
      [ids[0], original.encrypted_payload],
    );
    expect((await request.get('/api/v1/account/action-centre')).status()).toBe(
      200,
    );
    expect(
      (
        await request.delete('/api/v1/account/action-centre/' + ids[0], {
          headers,
        })
      ).status(),
    ).toBe(200);
    const deleted = await pool.query(
      'SELECT payload,encrypted_payload,deleted_at FROM app_action_centre WHERE id=$1',
      [ids[0]],
    );
    expect(deleted.rows[0].payload).toBeNull();
    expect(deleted.rows[0].encrypted_payload).toBeNull();
    expect(deleted.rows[0].deleted_at).not.toBeNull();
  } finally {
    try {
      if (original)
        await pool.query(
          'UPDATE app_action_centre SET encrypted_payload=$2 WHERE id=$1 AND deleted_at IS NULL',
          [ids[0], original.encrypted_payload],
        );
    } finally {
      await pool.end();
    }
  }
});

test('E2E-API-1283 eligible tax policy is retained and funded exactly and rejects unsupported eligibility @ACTION-CENTRE-001 @TEST-SIMULATION', async ({
  request,
}) => {
  const { actionTaxProfile } = await import('../../helpers/action-plan');
  const goal = await prepareConnectionAccount(request),
    input = actionPlanInput(goal.id);
  input.costs.taxMinor = '0';
  input.plan!.taxProfile = actionTaxProfile();
  const path = '/api/v1/account/action-centre/' + randomUUID(),
    response = await request.put(path, { headers, data: input });
  expect(response.status(), await response.text()).toBe(200);
  const receipt = ActionCentreReceiptSchema.parse(await response.json());
  expect(receipt.result.plan?.tax).toMatchObject({
    longTermGainMinor: '17900',
    taxMinor: '2328',
  });
  expect(receipt.result.proposal.afterCashMinor).toBe('57572');
  expect(
    await (await request.put(path, { headers, data: input })).json(),
  ).toEqual(receipt);
  const bad = {
    ...input,
    plan: {
      ...input.plan,
      taxProfile: { ...actionTaxProfile(), sttConditionsMet: false },
    },
  };
  expect(
    (
      await request.put('/api/v1/account/action-centre/' + randomUUID(), {
        headers,
        data: bad,
      })
    ).status(),
  ).toBe(400);
});
