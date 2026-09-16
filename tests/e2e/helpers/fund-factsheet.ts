import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { expect } from '@playwright/test';
import {
  governanceFixture,
  governanceHeaders as headers,
} from './research-governance';
import type { FeedbackSandbox } from './feedback-fixture';
export { test, expect } from './app-fixture';
export { governanceHeaders as headers } from './research-governance';
/** Reconstructed official grammar, independently transcribed facts; synthetic AMFI codes below are not real mappings. */
export const factsheetHtml =
  '<h1>KOTAK MULTI ASSET OMNI FOF</h1><p>Data as on 31st August, 2026 unless otherwise specified.</p><table><tr><td>AUM</td><td>Rs 2,644.66 crs</td></tr><tr><td>AAUM</td><td>Rs 2,641.18 crs</td></tr></table><h3>Month End Expense Ratio</h3><table><tr><th>Plan</th><th>Scheme</th><th>Underlying Funds** (Dir Plan)</th><th>Total</th></tr><tr><td>Direct</td><td>0.40%</td><td>0.62%</td><td>1.02%</td></tr><tr><td>Regular</td><td>1.14%</td><td>0.62%</td><td>1.76%</td></tr></table><p>Base Expense Ratio (BER) excludes brokerage, transaction costs and related statutory levies</p>';
export function factsheetInput() {
  return {
    requestId: randomUUID(),
    sourceUrl:
      'https://www.kotakmf.com/factsheet/August_2026/kotak/ASSET-ALLOCATOR.html',
    body: factsheetHtml,
    permissionReference:
      'TEST-SIMULATION reconstructed source and synthetic plan mapping, no actual licence.',
    rightsConfirmed: true,
  };
}
export async function factsheetFixture(
  request: APIRequestContext,
  playwright: PlaywrightWorkerArgs['playwright'],
  sandbox: FeedbackSandbox,
) {
  const auth = await governanceFixture(request, playwright, sandbox),
    navId = randomUUID();
  try {
    const body =
      'Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date\n\nOpen Ended Schemes ( Other Scheme - FoF Domestic )\n\nKotak Mahindra Mutual Fund\n908001;INF000000001;;Kotak Multi Asset Omni FOF;Direct Plan;Growth;10.0000;31-Aug-2026\n908002;INF000000002;;Kotak Multi Asset Omni FOF;Regular Plan;Growth;10.0000;31-Aug-2026\n';
    const captured = await request.post('/api/v1/ops/funds/import', {
      headers,
      data: {
        requestId: navId,
        body,
        permissionReference: 'Synthetic identity mapping fixture only.',
        writtenPermissionConfirmed: true,
      },
    });
    expect(captured.status(), await captured.text()).toBe(201);
    expect(
      (
        await auth.reviewer.post('/api/v1/ops/funds/review', {
          headers,
          data: {
            requestId: randomUUID(),
            editionId: navId,
            decision: 'publish',
            reason: 'Independent synthetic AMFI identity admission.',
          },
        })
      ).status(),
    ).toBe(201);
    return {
      ...auth,
      navId,
      input: factsheetInput(),
      review: {
        requestId: randomUUID(),
        decision: 'publish',
        reason:
          'Independent original fees and synthetic explicit plan mapping review.',
        plans: [
          { plan: 'Direct', schemeCode: '908001' },
          { plan: 'Regular', schemeCode: '908002' },
        ],
      },
    };
  } catch (error) {
    await auth.reviewer.dispose();
    throw error;
  }
}
