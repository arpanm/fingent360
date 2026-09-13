import { test, expect } from '../../helpers/app-fixture';
import { randomUUID } from 'node:crypto';
import {
  AllocationStateSchema,
  AllocationHistorySchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
const goal = {
  name: 'Synthetic allocation goal',
  type: 'education',
  targetMinor: '100000',
  savedMinor: '0',
  monthlyMinor: '100',
  horizonMonths: 12,
  currency: 'INR',
  scale: 2,
  assumptions: 'no-growth-nominal-v1',
  storageConsent: true,
};
const headers = { Origin: process.env.E2E_WEB_URL || 'http://localhost:5173' };
test('E2E-API-200 exact allocations reject oversubscription and stale concurrent saves and retain review history @ALLOCATIONS-001', async ({
  request,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `alloc_${randomUUID().slice(0, 12)}`,
      password: 'Synthetic-allocation-2026',
      consent: true,
    },
  });
  const g = await (
    await request.post('/api/v1/account/goals', { headers, data: goal })
  ).json();
  const preview = await (
    await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,3,10000',
        expectedVersion: 0,
        storageConsent: true,
      },
    })
  ).json();
  await request.post('/api/v1/account/holdings/confirm', {
    headers,
    data: { previewId: preview.previewId, expectedVersion: 0 },
  });
  const input = {
    expectedVersion: 0,
    expectedHoldingsVersion: 1,
    storageConsent: true,
    rows: [
      {
        goalId: g.id,
        goalVersion: 1,
        isin: 'INE002A01018',
        quantity: '1.000001',
      },
    ],
  };
  expect(
    (
      await request.put('/api/v1/account/allocations', {
        headers,
        data: { ...input, rows: [{ ...input.rows[0], quantity: '4' }] },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.put('/api/v1/account/allocations', {
        headers,
        data: { ...input, rows: [{ ...input.rows[0], goalId: randomUUID() }] },
      })
    ).status(),
  ).toBe(400);
  const replies = await Promise.all([
    request.put('/api/v1/account/allocations', { headers, data: input }),
    request.put('/api/v1/account/allocations', { headers, data: input }),
  ]);
  expect(replies.map((r) => r.status()).sort()).toEqual([200, 409]);
  const saved = AllocationStateSchema.parse(
    await (await request.get('/api/v1/account/allocations')).json(),
  );
  expect(saved.snapshot.rows[0]?.recordedCostMinor).toBe('3333');
  expect(saved.requiresReview).toBe(false);
  const reduced = await (
    await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,1,3000',
        expectedVersion: 1,
        storageConsent: true,
      },
    })
  ).json();
  await request.post('/api/v1/account/holdings/confirm', {
    headers,
    data: { previewId: reduced.previewId, expectedVersion: 1 },
  });
  const changed = AllocationStateSchema.parse(
    await (await request.get('/api/v1/account/allocations')).json(),
  );
  expect(changed.requiresReview).toBe(true);
  expect(changed.review[0]?.reasons.join(' ')).toContain('exceeds');
  expect(changed.snapshot).toEqual(saved.snapshot);
  expect(
    (
      await request.put('/api/v1/account/allocations', {
        headers,
        data: { ...input, expectedVersion: 1 },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.put('/api/v1/account/allocations', {
        headers,
        data: {
          expectedVersion: 1,
          expectedHoldingsVersion: 2,
          rows: [],
          storageConsent: true,
        },
      })
    ).status(),
  ).toBe(200);
  const history = AllocationHistorySchema.parse(
    await (await request.get('/api/v1/account/allocations/history')).json(),
  );
  expect(history.revisions.map((r) => r.version)).toEqual([2, 1]);
  expect(history.revisions[1]).toEqual(saved.snapshot);
});
test('E2E-API-201 split quantities stay owned and removed goals require review without losing history @ALLOCATIONS-001', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  await request.post('/api/v1/account/register', {
    headers,
    data: {
      username: `alloc_${randomUUID().slice(0, 12)}`,
      password: 'Synthetic-allocation-2026',
      consent: true,
    },
  });
  const g = await (
    await request.post('/api/v1/account/goals', { headers, data: goal })
  ).json();
  const second = await (
    await request.post('/api/v1/account/goals', {
      headers,
      data: { ...goal, name: 'Second synthetic goal' },
    })
  ).json();
  const p = await (
    await request.post('/api/v1/account/holdings/preview', {
      headers,
      data: {
        csv: 'isin,quantity,total_cost_paise\nINE002A01018,3,10000',
        expectedVersion: 0,
        storageConsent: true,
      },
    })
  ).json();
  await request.post('/api/v1/account/holdings/confirm', {
    headers,
    data: { previewId: p.previewId, expectedVersion: 0 },
  });
  const rows = [
    { goalId: g.id, goalVersion: 1, isin: 'INE002A01018', quantity: '1.5' },
    {
      goalId: second.id,
      goalVersion: 1,
      isin: 'INE002A01018',
      quantity: '1.5',
    },
  ];
  const input = {
    expectedVersion: 0,
    expectedHoldingsVersion: 1,
    storageConsent: true,
    rows,
  };
  expect(
    (
      await request.put('/api/v1/account/allocations', {
        headers,
        data: {
          ...input,
          rows: [rows[0], { ...rows[1], quantity: '1.500001' }],
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.put('/api/v1/account/allocations', { headers, data: input })
    ).status(),
  ).toBe(200);
  const owner = AllocationStateSchema.parse(
    await (await request.get('/api/v1/account/allocations')).json(),
  );
  expect(owner.snapshot.rows.map((r) => r.recordedCostMinor)).toEqual([
    '5000',
    '5000',
  ]);
  const other = await playwright.request.newContext({
    baseURL: feedbackSandbox.apiOrigin,
  });
  try {
    await other.post('/api/v1/account/register', {
      headers,
      data: {
        username: `other_${randomUUID().slice(0, 12)}`,
        password: 'Synthetic-allocation-2026',
        consent: true,
      },
    });
    expect(
      AllocationStateSchema.parse(
        await (await other.get('/api/v1/account/allocations')).json(),
      ).snapshot.rows,
    ).toHaveLength(0);
    expect(
      (
        await other.put('/api/v1/account/allocations', {
          headers,
          data: { ...input, expectedHoldingsVersion: 0 },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await other.dispose();
  }
  await request.delete(`/api/v1/account/goals/${g.id}`, {
    headers,
    data: { expectedVersion: 1 },
  });
  const after = AllocationStateSchema.parse(
    await (await request.get('/api/v1/account/allocations')).json(),
  );
  expect(after.requiresReview).toBe(true);
  expect(
    after.review.find((r) => r.goalId === g.id)?.reasons.join(' '),
  ).toContain('Goal was removed');
  expect(after.snapshot).toEqual(owner.snapshot);
  const exported = PrivacyExportSchema.parse(
    await (await request.get('/api/v1/account/privacy/export')).json(),
  );
  expect(exported.allocations.revisions).toEqual([owner.snapshot]);
});
