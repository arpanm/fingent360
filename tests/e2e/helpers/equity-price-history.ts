import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { equityInput, expect, retentionHeaders } from './equity-coverage';
export { test, expect, retentionHeaders } from './equity-coverage';
export { indiaActors } from './india-macro';
export async function retainPriceHistory(
  request: APIRequestContext,
  reviewer: APIRequestContext,
) {
  const original = await equityInput();
  const observations = Array.from({ length: 17 }, (_, i) => ({
    kind: 'price',
    isin: 'INE002A01018',
    effectiveOn: `2025-01-${String(i + 1).padStart(2, '0')}`,
    sourceRow: i + 2,
    exchange: 'NSE',
    currency: 'INR',
    close: '100.00',
    volume: '1000',
    adjusted: false,
  }));
  const ids: string[] = [];
  for (const points of [
    observations,
    [{ ...observations[0], close: '101.00' }],
  ]) {
    const input = {
      ...original,
      requestId: randomUUID(),
      body: JSON.stringify({
        format: 'f360-equity-evidence-v1',
        observations: points,
      }),
    };
    const capture = await request.post('/api/v1/ops/equities/import', {
      headers: retentionHeaders,
      data: input,
    });
    expect(capture.status(), await capture.text()).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/equities/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: input.requestId,
            decision: 'publish',
            reason: 'Synthetic price-history source independently reviewed.',
          },
        })
      ).status(),
    ).toBe(201);
    ids.push(input.requestId);
  }
  return ids;
}
