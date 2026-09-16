import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  governanceFixture,
  governanceHeaders as headers,
} from './research-governance';
import { fundFixture } from './funds-bonds';
import { syntheticSbiWorkbook } from './sbi-portfolio';
import type { FeedbackSandbox } from './feedback-fixture';
export async function publishedSbiFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const auth = await governanceFixture(request, playwright, sandbox);
  try {
    const { navText } = await fundFixture(),
      navId = randomUUID(),
      id = randomUUID();
    const body = navText
      .replace('Synthetic Test Asset Management', 'SBI Mutual Fund')
      .replace(
        'Synthetic Test Fund Direct Growth',
        'SBI Contra Fund - Synthetic Direct Growth',
      );
    expect(
      (
        await request.post('/api/v1/ops/funds/import', {
          headers,
          data: {
            requestId: navId,
            body,
            permissionReference:
              'Synthetic isolated generated NAV fixture only.',
            writtenPermissionConfirmed: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await auth.reviewer.post('/api/v1/ops/funds/review', {
          headers,
          data: {
            requestId: randomUUID(),
            editionId: navId,
            decision: 'publish',
            reason: 'Synthetic independent NAV review.',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await request.post('/api/v1/ops/fund-lookthrough/import', {
          headers,
          data: {
            requestId: id,
            body: Buffer.from(syntheticSbiWorkbook()).toString('base64'),
            permissionReference: 'Synthetic isolated generated workbook only.',
          },
        })
      ).status(),
    ).toBe(201);
    const review = {
      requestId: randomUUID(),
      decision: 'publish',
      schemeCode: '108001',
      reason:
        'Independent synthetic scheme mapping review with explicit source discrepancy.',
      acknowledgeDiscrepancy: true,
    };
    expect(
      (
        await auth.reviewer.post(`/api/v1/ops/fund-lookthrough/${id}/review`, {
          headers,
          data: {
            ...review,
            requestId: randomUUID(),
            acknowledgeDiscrepancy: false,
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await auth.reviewer.post(`/api/v1/ops/fund-lookthrough/${id}/review`, {
          headers,
          data: review,
        })
      ).status(),
    ).toBe(201);
    return { ...auth, id, navId, review };
  } catch (error) {
    await auth.reviewer.dispose();
    throw error;
  }
}
