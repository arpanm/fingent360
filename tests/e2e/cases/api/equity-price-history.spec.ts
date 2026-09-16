import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  retentionHeaders,
  indiaActors,
  retainPriceHistory,
} from '../../helpers/equity-price-history';
import { EquityPriceHistorySchema } from '../../../../packages/contracts/src/index';
test.use({ namedOperators: true });
test('E2E-API-1800 retained historical prices paginate complete dates preserve conflicting receipts and withdraw exactly one source @SRC-002 @TEST-SIMULATION', async ({
  request,
  playwright,
  feedbackSandbox,
}) => {
  const reviewer = await indiaActors(request, playwright, feedbackSandbox);
  try {
    const ids = await retainPriceHistory(request, reviewer),
      path =
        '/api/v1/equities/INE002A01018/prices?from=2025-01-01&to=2025-01-19&limit=2';
    const first = EquityPriceHistorySchema.parse(
      await (await request.get(path)).json(),
    );
    expect(first.days.map((day) => day.on)).toEqual([
      '2025-01-17',
      '2025-01-16',
    ]);
    expect(first.nextAfter).toBe('2025-01-16');
    expect(first.datesWithoutCapture).toEqual(['2025-01-18', '2025-01-19']);
    const next = EquityPriceHistorySchema.parse(
      await (await request.get(path + '&after=' + first.nextAfter)).json(),
    );
    expect(next.days.map((day) => day.on)).toEqual([
      '2025-01-15',
      '2025-01-14',
    ]);
    const last = EquityPriceHistorySchema.parse(
      await (await request.get(path + '&after=2025-01-02')).json(),
    );
    expect(last.days[0]?.status).toBe('conflicting-revisions');
    expect(last.days[0]?.records).toHaveLength(2);
    expect(last.nextAfter).toBeNull();
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: ids[1],
            decision: 'withdraw',
            reason: 'Synthetic conflicting correction withdrawn.',
          },
        })
      ).status(),
    ).toBe(201);
    const refreshed = EquityPriceHistorySchema.parse(
      await (await request.get(path + '&after=2025-01-02')).json(),
    );
    expect(refreshed.days[0]?.status).toBe('retained');
    expect(refreshed.days[0]?.records).toHaveLength(1);
    expect(
      (
        await request.get(
          '/api/v1/equities/INE002A01018/prices?from=2023-01-01&to=2025-01-19',
        )
      ).status(),
    ).toBe(400);
    expect((await request.get(path + '&after=2024-01-01')).status()).toBe(400);
  } finally {
    await reviewer.dispose();
  }
});
