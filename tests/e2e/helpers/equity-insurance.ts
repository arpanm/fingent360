import { randomUUID } from 'node:crypto';
import { equityInput } from './equity-coverage';
import {
  GI_LABELS,
  NSE_GI_PARSER,
} from '../../../packages/contracts/src/index';
export { test, expect, retentionHeaders } from './equity-coverage';
export { indiaActors } from './india-macro';
/** Reconstructed minimal original table grammar; amounts independently encoded from the dated ICICI GI report, not original source bytes. */
export async function insuranceInput() {
  const scalar = (label: string, value: string) =>
    `<tr><td>${label}</td><td>${value}</td></tr>`;
  const row = (label: string, value: string, metadata = false) =>
    `<tr>${metadata ? '' : '<td></td>'}<td>${label}</td><td>${value}</td><td>${value}</td></tr>`;
  const values = [
    '8,86,027.00',
    '6,60,373.00',
    '5,95,004.00',
    '85,787.00',
    '580.00',
    '6,81,371.00',
    '1,25,018.00',
    '78,522.00',
    '0.00',
    '3,51,161.00',
    '1,03,291.00',
    '4,54,452.00',
    '6,57,992.00',
    '(62,988.00)',
    '0.00',
    '0.00',
    '23,379.00',
  ];
  const body = `<h1>INTEGRATED FILING — GI</h1><table class="gITabl gridtable">${scalar('ISIN', 'INE765G01017')}${scalar('Description of presentation currency', 'INR')}${scalar('Level of rounding used in financial results', 'Lakhs')}${scalar('Date of board meeting when results were approved', '15-07-2026')}</table><h3>Format for financial results by general insurance companies filed with stock exchanges</h3><h3>Amount in (Lakhs)</h3><table><tr><td>Partiuclars</td><td>Current Quarter</td><td>Year to Date Figures</td></tr>${row('Date of start of reporting period', '01-04-2026', true)}${row('Date of end of reporting period', '30-06-2026', true)}${row('Nature of report standalone or consolidated', 'Standalone', true)}${row('Whether results are audited or unaudited', 'Audited', true)}<tr><td>OPERATING RESULTS</td></tr>${Object.values(
    GI_LABELS,
  )
    .map((label, index) => row(label, values[index]!))
    .join(
      '',
    )}</table><table><tr><td>NON-OPERATING RESULTS</td></tr>${row('Total income', '52,190.00')}${row('Total Expense', '(1,380.00)')}</table><table class="stockExchnageTableLastColwidth"><tr><td>Analytical Ratios</td></tr>${row('Solvency ratio', '2.7100')}${row('Incurred Claim Ratio', '76.400')}${row('Combined ratio', '107.200')}</table><p>Solvency ratio are in times and other ratios mentioned below are in %</p>`;
  return {
    ...(await equityInput()),
    requestId: randomUUID(),
    parser: NSE_GI_PARSER,
    effectiveOn: '2026-07-15',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_GI_174881_15072026211206_iXBRL_WEB.html',
    body,
  };
}
