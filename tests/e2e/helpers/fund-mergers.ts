import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from '@playwright/test';
import { indiaActors, retentionHeaders as headers } from './india-macro';
import { fundFixture } from './funds-bonds';
import type { FeedbackSandbox } from './feedback-fixture';
export const syntheticMergerPdf = Buffer.from(
  '%PDF-1.4\n% TEST-SIMULATION: envelope only, no original notice or permission claimed.\n%%EOF',
).toString('base64');
export function mergerInput() {
  return {
    requestId: randomUUID(),
    from: 'HDFC Long Term Advantage Fund',
    body: syntheticMergerPdf,
    permissionReference:
      'TEST-SIMULATION: synthetic original and manual review only.',
    originalConfirmed: true,
  };
}
export async function mergerFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const reviewer = await indiaActors(request, playwright, sandbox);
  try {
    const { navText } = await fundFixture(),
      navId = randomUUID();
    const body = navText
      .replace('Synthetic Test Asset Management', 'HDFC Mutual Fund')
      .replace(
        'Synthetic Test Fund Direct Growth',
        'HDFC Long Term Advantage Fund - Direct Growth',
      )
      .replace(
        'Synthetic Test Fund Regular Growth',
        'HDFC Large and Mid Cap Fund - Direct Growth',
      );
    expect(
      (
        await request.post('/api/v1/ops/funds/import', {
          headers,
          data: {
            requestId: navId,
            body,
            permissionReference: 'TEST-SIMULATION: generated AMFI identities.',
            writtenPermissionConfirmed: true,
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await reviewer.post('/api/v1/ops/funds/review', {
          headers,
          data: {
            requestId: randomUUID(),
            editionId: navId,
            decision: 'publish',
            reason: 'Independent synthetic identity approval.',
          },
        })
      ).status(),
    ).toBe(201);
    const input = mergerInput();
    expect(
      (
        await request.post('/api/v1/ops/fund-mergers/import', {
          headers,
          data: input,
        })
      ).status(),
    ).toBe(201);
    const review = {
      requestId: randomUUID(),
      decision: 'publish',
      fromCode: '108001',
      toCode: '108002',
      reason: 'Synthetic independent original and exact plan check; no ratio.',
      originalAndPlansChecked: true,
    };
    return { reviewer, navId, input, review };
  } catch (error) {
    await reviewer.dispose();
    throw error;
  }
}
