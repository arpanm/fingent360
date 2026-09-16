import { randomUUID } from 'node:crypto';
import { test, expect, retentionHeaders } from '../../helpers/funds-bonds';
import { publishConflictingFundHistory } from '../../helpers/fund-history';
import { FundDetailSchema } from '../../../../packages/contracts/src/index';

test('E2E-API-1460 retained NAV conflicts and identity changes reconcile after actual withdrawal @SRC-015 @TEST-SIMULATION', async ({
  request,
}) => {
  const ids = await publishConflictingFundHistory(request);
  const read = async () => {
    const response = await request.get('/api/v1/funds/108001');
    expect(response.status()).toBe(200);
    return FundDetailSchema.parse(await response.json());
  };
  const before = await read();
  expect(before.reconciliation.status).toBe('review-required');
  expect(before.reconciliation.conflictingDates).toEqual(['2025-01-31']);
  expect(before.reconciliation.identityChanges).toEqual(['payoutIsin']);
  expect(before.history).toHaveLength(2);
  expect(
    (
      await request.post('/api/v1/ops/funds/review', {
        headers: retentionHeaders,
        data: {
          requestId: randomUUID(),
          editionId: ids[1],
          decision: 'withdraw',
          reason: 'Remove synthetic conflicting edition.',
        },
      })
    ).status(),
  ).toBe(201);
  const after = await read();
  expect(after.reconciliation.status).toBe('insufficient-history');
  expect(after.reconciliation.conflictingDates).toEqual([]);
  expect(after.history).toHaveLength(1);
});
