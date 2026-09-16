import { readFile } from 'node:fs/promises';
import { equityInput } from './equity-coverage';
export { test, expect, retentionHeaders } from './equity-coverage';
export { indiaActors } from './india-macro';
export type CompanyCohort = {
  symbol: string;
  sourceUrl: string;
  inspectedOn: string;
  captureBasis: string;
  isin: string;
  currency: string;
  scale: string;
  approvedOn: string;
  starts: string[];
  ends: string[];
  audits: string[];
  bases: string[];
  revenue: string[];
  profit: string[];
};
// Independently transcribed normalized expectations, never obtained by running the parser.
export const expectedCohort = [
  ['ASMS', '3438.76', '209.32'],
  ['TIGERLOGS', '15252.50', '216.99'],
  ['BLSE', '24398.79', '1752.18'],
  ['COFFEEDAY', '566.90', '1312.60'],
  ['SBC', '7245.51', '346.84'],
  ['CMICABLES', '1495.68', '-478.88'],
  ['SRD', '12226.70', '423.62'],
  ['ALPINETEX', '8973.52', '437.07'],
  ['GHCLTEXTIL', '26775.00', '1352.00'],
  ['MUKKA', '17077.40', '158.90'],
  ['INDOTECH', '16393.00', '1917.00'],
  ['ORIENTELEC', '76908.00', '1752.00'],
  ['SURAJEST', '12687.60', '2377.20'],
  ['SATIA', '37092.07', '3160.31'],
  ['RAMASTEEL', '26813.45', '495.64'],
  ['BIGBLOC', '5635.54', '-496.16'],
  ['SILVERTUC', '6274.92', '403.62'],
  ['LASA', '122.67', '-357.87'],
  ['SONATSOFTW', '27857.00', '2269.00'],
  ['GOKULAGRO', '462494.57', '6420.35'],
  ['LALITHAA', '603123.20', '20821.70'],
  ['HORIZONIND', '4205.20', '6348.30'],
  ['SRPL', '0.00', '-636.40'],
  ['SOLEX', '14860.53', '340.09'],
  ['SHANKESH', '42357.60', '4323.30'],
] as const;
export async function loadCompanyCohort(): Promise<CompanyCohort[]> {
  return JSON.parse(
    await readFile(
      new URL('../fixtures/equity-company-cohort.json', import.meta.url),
      'utf8',
    ),
  ) as CompanyCohort[];
}
export const cohortDay = (value: string) =>
  value.split('-').reverse().join('-');
/** Reconstructed minimum grammar retaining both displayed source columns; not original HTML bytes. */
export async function companyCohortInput(company: CompanyCohort) {
  const scalar = (label: string, value: string) =>
    `<tr><td>${label}</td><td>${value}</td></tr>`;
  const row = (label: string, values: string[]) =>
    `<tr><td>${label}</td>${values.map((value) => `<td>${value}</td>`).join('')}</tr>`;
  return {
    ...(await equityInput()),
    parser: 'nse-integrated-indas-html-v1' as const,
    sourceUrl: company.sourceUrl,
    effectiveOn: company.inspectedOn,
    rightsBasis:
      'TEST-SIMULATION: reconstructed grammar with independently inspected public reported facts; no provider distribution licence claimed.',
    body: `<table class="gITable">${scalar('ISIN', company.isin)}${scalar('Description of presentation currency', company.currency)}${scalar('Level of rounding used in financial results', company.scale)}</table><h3>Financial Results Ind-AS</h3><table class="stockExchnageTableLastColwidth">${row('Date of start of reporting period', company.starts)}${row('Date of end of reporting period', company.ends)}${row('Whether results are audited or unaudited', company.audits)}${row('Nature of report standalone or consolidated', company.bases)}${row('Revenue from operations', company.revenue)}${row('Total profit (loss) for period', company.profit)}</table>`,
  };
}
