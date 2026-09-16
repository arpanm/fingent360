import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import {
  expect,
  fundFixture,
  loginRetentionOperator,
  retentionHeaders,
} from './funds-bonds';

/** Deliberately conflicting synthetic captures; no real investor or provider content. */
export async function publishConflictingFundHistory(
  request: APIRequestContext,
) {
  await loginRetentionOperator(request);
  const { navText } = await fundFixture();
  const ids: string[] = [];
  for (const body of [
    navText,
    navText
      .replace('123.456700', '125.000000')
      .replace('INF000000001', 'INF000000002'),
  ]) {
    const id = randomUUID();
    expect(
      (
        await request.post('/api/v1/ops/funds/import', {
          headers: retentionHeaders,
          data: {
            requestId: id,
            body,
            permissionReference:
              'TEST-SIMULATION original generated NAV continuity fixture only.',
            writtenPermissionConfirmed: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/funds/review', {
          headers: retentionHeaders,
          data: {
            requestId: randomUUID(),
            editionId: id,
            decision: 'publish',
            reason: 'Synthetic conflicting source edition acceptance.',
          },
        })
      ).status(),
    ).toBe(201);
    ids.push(id);
  }
  return ids;
}
