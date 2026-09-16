import { randomUUID } from 'node:crypto';
import { test as base } from './equity-coverage';
export { expect, retentionHeaders } from './equity-coverage';
export { indiaActors } from './india-macro';
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(
      /\/api\/v1\/cpi-expectations(?:\?|$)/,
      async (route) => {
        const url = new URL(route.request().url());
        await route.continue({
          url: `${feedbackSandbox.apiOrigin}${url.pathname}${url.search}`,
        });
      },
    );
    await use(context);
  },
});
export function cpiNowcastInput() {
  return {
    requestId: randomUUID(),
    url: 'https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting',
    rightsBasis:
      'Synthetic reconstructed source fixture, no production permission.',
    rightsConfirmed: true as const,
    body: '<h1>Inflation Nowcasting</h1><table><caption>Inflation, month-over-month percent change</caption><thead><tr><th>Month</th><th>CPI</th><th>Core CPI</th><th>PCE</th><th>Core PCE</th><th>Updated</th></tr></thead><tbody><tr><td>August 2026</td><td>0.37</td><td>0.20</td><td>0.37</td><td>0.28</td><td>09/10</td></tr></tbody></table>',
  };
}
// Hypothetical prior model row above; never described as an actual captured historical nowcast.
export function cpiActualInput() {
  return {
    requestId: randomUUID(),
    url: 'https://www.bls.gov/news.release/archives/cpi_09112026.htm',
    rightsBasis: 'Synthetic reconstructed official BLS numerical fact layout.',
    rightsConfirmed: true as const,
    body: '<pre>Transmission of material in this release is embargoed until 8:30 a.m. (ET) Friday, September 11, 2026 CONSUMER PRICE INDEX - AUGUST 2026 The Consumer Price Index for All Urban Consumers (CPI-U) increased 0.4 percent on a seasonally adjusted basis in August</pre>',
  };
}
