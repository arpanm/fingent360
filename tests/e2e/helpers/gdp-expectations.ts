import { randomUUID } from 'node:crypto';
import { test as base, expect, retentionHeaders } from './equity-coverage';
export { expect, retentionHeaders };
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(
      /\/api\/v1\/(?:gdp-expectations|discovery|research-calendar)(?:[/?]|$)/,
      (route) => {
        const url = new URL(route.request().url());
        return route.continue({
          url: feedbackSandbox.apiOrigin + url.pathname + url.search,
        });
      },
    );
    await use(context);
  },
});
export { indiaActors } from './india-macro';
export function spfInput() {
  return {
    requestId: randomUUID(),
    url: 'https://www.philadelphiafed.org/surveys-and-data/real-time-data-research/spf-q2-2025',
    rightsBasis:
      'TEST-SIMULATION reconstructed source layout and independently encoded published facts; no original HTML or licence claim.',
    rightsConfirmed: true,
    body: `<h1>Second Quarter 2025 Survey of Professional Forecasters</h1><p itemprop="datePublished">16 May ’25</p><p>Synthetic layout reconstruction: annual rate of 1.5 percent this quarter.</p><table><thead><tr><th></th><th colspan="2">Real GDP (%)</th><th colspan="2">Unemployment Rate (%)</th><th colspan="2">Payrolls (000s/month)</th></tr><tr><th>Previous</th><th>New</th><th>Previous</th><th>New</th><th>Previous</th><th>New</th></tr></thead><tbody><tr><td>2025:Q2</td><td>2.1</td><td>1.5</td><td>0</td><td>0</td><td>0</td><td>0</td></tr></tbody></table>`,
  };
}
