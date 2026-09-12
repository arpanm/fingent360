import { randomUUID } from 'node:crypto';
import {
  CatalogSchema, PortfolioInputSchema, ReviewSchema, ValuationSchema,
  type PortfolioInput, type Catalog,
} from '@fingent360/contracts';

export const catalog: Catalog = CatalogSchema.parse({
  mode: 'synthetic', version: 'fixture-v1', asOf: '2026-09-12T00:00:00.000Z',
  event: {
    id: 'oil-supply-scenario', title: 'An oil supply disruption: follow the effects',
    summary: 'Fictional exercise: a supply interruption raises uncertainty about fuel costs. This is not a current market report.',
    mechanism: 'Supply interruption → possible fuel cost pressure → airline operating costs → exposure in an airline holding. Exposure measures capital linked to this scenario, not expected loss.',
    claimKind: 'scenario', affectedInstrumentIds: ['alpha-air'],
    sources: [
      { id: 'scenario-note', title: 'Synthetic supply scenario', locator: 'FIX-OIL-001 / paragraph 1', text: 'Fictional premise: a temporary oil supply interruption occurs. No live event, price forecast or probability is asserted.' },
      { id: 'mechanism-note', title: 'Synthetic company mechanism', locator: 'FIX-OIL-001 / paragraph 2', text: 'Alpha Air is a fictional airline. This exercise assumes sensitivity to fuel costs. The magnitude and direction of its share-price response are unknown.' },
    ],
  },
  companies: [
    { id: 'alpha-air', name: 'Alpha Air', sector: 'Aviation', price: '100.00', currency: 'INR', explanation: 'Fictional airline linked to the oil scenario through fuel costs. Fundamentals and consensus are unavailable.' },
    { id: 'bharat-software', name: 'Bharat Software', sector: 'Technology', price: '200.00', currency: 'INR', explanation: 'Fictional technology company with no mapped direct link in this exercise. This does not imply no real-world risk.' },
  ],
});
export const emptyPortfolio: PortfolioInput = { holdings: [], cash: '0.00', goals: [] };
export function minor(value: string): bigint { return BigInt(value.replace('.', '')); }
export function money(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}
// Positive exact rational, half-even rounding; no floating-point monetary operations.
export function round(n: bigint, d: bigint): bigint {
  const q = n / d; const r = n % d;
  return q + (r * 2n > d || (r * 2n === d && q % 2n !== 0n) ? 1n : 0n);
}
function scaledQuantity(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
}
export function valuePortfolio(input: PortfolioInput) {
  const p = PortfolioInputSchema.parse(input);
  const positions = p.holdings.map((h) => {
    const company = catalog.companies.find((c) => c.id === h.instrumentId);
    if (!company) throw new Error('Unknown instrument');
    return { instrumentId: h.instrumentId, value: money(round(minor(company.price) * scaledQuantity(h.quantity), 1000000n)) };
  });
  const equity = positions.reduce((sum, p) => sum + minor(p.value), 0n);
  const total = equity + minor(p.cash);
  const affected = positions.filter((p) => catalog.event.affectedInstrumentIds.includes(p.instrumentId)).reduce((sum, p) => sum + minor(p.value), 0n);
  let allocated = 0n;
  const goals = p.goals.map((g) => {
    // Floor allocated minor units; deterministic remainder stays unallocated.
    const funded = total * BigInt(g.allocationPercent) / 100n;
    allocated += funded;
    return { id: g.id, funded: money(funded), affected: money(affected * BigInt(g.allocationPercent) / 100n), fundedPercent: money(round(funded * 10000n, minor(g.target))) };
  });
  return ValuationSchema.parse({ total: money(total), equity: money(equity), affected: money(affected), affectedPercent: total === 0n ? null : money(round(affected * 10000n, total)), positions, goals, unallocated: money(total - allocated) });
}
export function createReview(portfolio: PortfolioInput, revision: number, scenario: 'baseline' | 'stale' | 'conflicting') {
  const valuation = valuePortfolio(portfolio);
  const blockers = [];
  if (!portfolio.holdings.length) blockers.push('Add holdings before assessing their scenario exposure.');
  if (!portfolio.goals.length) blockers.push('Add a goal to assess goal context.');
  if (scenario === 'stale') blockers.push('The simulated price input is stale. Historical values below are not a current assessment.');
  if (scenario === 'conflicting') blockers.push('The simulated evidence conflicts. Resolve the contradiction before assessment.');
  const status = blockers.length ? 'unable_to_assess' : minor(valuation.affected) > 0n ? 'review' : 'no_review_trigger';
  return ReviewSchema.parse({ id: randomUUID(), issuedAt: new Date().toISOString(), revision, policyVersion: 'educational-demo-v1', fixtureVersion: 'fixture-v1', scenario, status,
    reasons: blockers.length ? blockers : [status === 'review' ? 'A holding is linked to the fictional oil scenario. Review the mechanism and your goal context; exposure is not an expected loss.' : 'No direct holding link was found in this limited fictional scenario. This is not a hold recommendation or a statement of safety.'],
    comparator: 'Compare with leaving the virtual portfolio unchanged. This exercise estimates neither future returns nor costs/taxes and recommends no transaction.', portfolio, valuation });
}
export function parseCsv(csv: string) {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const issues: string[] = [];
  const holdings: PortfolioInput['holdings'] = [];
  if (lines.shift()?.trim() !== 'instrumentId,quantity') issues.push('Header must be instrumentId,quantity. Only the supplied simple CSV template is supported.');
  if (lines.length > 2) issues.push('At most two unique instrument rows are supported.');
  for (const [index, line] of lines.entries()) {
    const cells = line.split(',').map((s) => s.trim());
    const parsed = PortfolioInputSchema.safeParse({ holdings: [{ instrumentId: cells[0], quantity: cells[1] }], cash: '0.00', goals: [] });
    if (cells.length !== 2 || !parsed.success) issues.push(`Row ${index + 2}: unsupported instrument or invalid positive quantity.`);
    else holdings.push(...parsed.data.holdings);
  }
  if (!holdings.length) issues.push('Include at least one holding.');
  if (new Set(holdings.map((h) => h.instrumentId)).size !== holdings.length) issues.push('Duplicate instrument rows; combine quantities before importing.');
  return { holdings: issues.length ? [] : holdings.sort((a, b) => a.instrumentId.localeCompare(b.instrumentId)), issues };
}
