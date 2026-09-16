import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  governanceFixture,
  governanceHeaders as headers,
} from './research-governance';
import { fundFixture } from './funds-bonds';
import { syntheticAxisWorkbook } from './axis-portfolio';
import { AXIS_PORTFOLIO_URL } from '../../../packages/contracts/src/index';
import type { FeedbackSandbox } from './feedback-fixture';
export async function axisFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const auth = await governanceFixture(request, playwright, sandbox);
  try {
    const { navText } = await fundFixture(),
      navId = randomUUID(),
      id = randomUUID(),
      body = navText
        .replace('Synthetic Test Asset Management', 'Axis Mutual Fund')
        .replace(
          'Synthetic Test Fund Direct Growth',
          'Axis NIFTY 50 ETF - Synthetic Growth',
        );
    expect(
      (
        await request.post('/api/v1/ops/funds/import', {
          headers,
          data: {
            requestId: navId,
            body,
            permissionReference: 'Synthetic NAV metadata fixture only.',
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
            reason: 'Synthetic independent NAV metadata review.',
          },
        })
      ).status(),
    ).toBe(201);
    const input = {
      requestId: id,
      sourceUrl: AXIS_PORTFOLIO_URL,
      body: Buffer.from(syntheticAxisWorkbook()).toString('base64'),
      permissionReference:
        'Synthetic source fixture scope includes retained bytes, display and offline delivery.',
    };
    return { ...auth, id, navId, input };
  } catch (error) {
    await auth.reviewer.dispose();
    throw error;
  }
}
