import { randomUUID } from 'node:crypto';
import { test as base } from './feedback-fixture';
export { expect } from './feedback-fixture';
export { retentionHeaders } from './retention';
export { indiaActors } from './india-macro';
export const test = base.extend({
  context: async ({ context, feedbackSandbox }, use) => {
    await context.route(/\/api\/v1\/eia-spot(?:[/?]|$)/, (route) => {
      const u = new URL(route.request().url());
      return route.continue({
        url: feedbackSandbox.apiOrigin + u.pathname + u.search,
      });
    });
    await use(context);
  },
});
export const eiaRights =
  'TEST-SIMULATION synthetic source cells only, no Refinitiv/LSEG permission asserted.';
export function eiaInput() {
  const dates = [
    '09/02/26',
    '09/03/26',
    '09/04/26',
    '09/07/26',
    '09/08/26',
    '09/09/26',
  ];
  return {
    requestId: randomUUID(),
    body:
      '<p>TEST-SIMULATION reconstructed original grammar with synthetic prices, not an actual capture.</p><p>(Crude Oil in Dollars per Barrel, Products in Dollars per Gallon)</p><select><option value="pet_pri_spt_s1_d.htm" SELECTED>Daily</option></select><table><tr>' +
      dates.map((d) => `<th class="Series5">${d}</th>`).join('') +
      '</tr>' +
      [
        ['WTI - Cushing, Oklahoma', 'RWTC'],
        ['Brent - Europe', 'RBRTE'],
      ]
        .map(
          ([name, code]) =>
            '<tr><td class="DataStub1">' +
            name +
            '</td>' +
            ['10.00', '11.00', '12.00', '&nbsp;', '13.00', '14.00']
              .map(
                (v, i) =>
                  `<td class="${i === 5 ? 'Current2' : 'DataB'}">${v}</td>`,
              )
              .join('') +
            `<td class="DataHist"><a href="./hist/LeafHandler.ashx?n=PET&s=${code}&f=D">history</a></td></tr>`,
        )
        .join('') +
      '</table><td class="Update">Release Date: 9/10/2026</td><p>Next Release Date: 9/16/2026</p>',
  };
}
export const eiaReview = (id: string, decision = 'publish') => ({
  requestId: randomUUID(),
  id,
  decision,
  reason: 'Independent synthetic daily crude units and dates review.',
  confirmed: true,
});
