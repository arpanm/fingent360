import { randomUUID } from 'node:crypto';
import { equityInput } from './equity-coverage';
import {
  LI_LABELS,
  NSE_LI_PARSER,
} from '../../../packages/contracts/src/index';
export { test, expect, retentionHeaders } from './equity-coverage';
export { indiaActors } from './india-macro';
/** Minimal reconstructed official grammar and independently encoded HDFC dated facts; not original exchange bytes. */
export async function lifeInsuranceInput() {
  const scalar = (label: string, value: string) =>
    `<tr><td>${label}</td><td>${value}</td></tr>`;
  const row = (label: string, value: string, metadata = false) =>
    `<tr>${metadata ? '' : '<td></td>'}<td>${label}</td><td>${value}</td><td>${value}</td></tr>`;
  const values = [
    '1672763.00',
    '1668548.00',
    '9458.00',
    '3401.00',
    '3354170.00',
    '390003.00',
    '0.00',
    '(3765.00)',
    '863.00',
    '4694.00',
    '823822.00',
    '2106831.00',
    '3322448.00',
    '31722.00',
    '37260.00',
    '(5538.00)',
    '37260.00',
    '34540.00',
    '4273.00',
    '76073.00',
    '10246.00',
    '3401.00',
    '0.00',
    '(593.00)',
    '13054.00',
    '63019.00',
    '1900.00',
    '61119.00',
    '61119.00',
  ];
  const account = (name: string) =>
    Object.values(LI_LABELS)
      .map(([section, label], index) =>
        section === name ? row(label, values[index]!) : '',
      )
      .join('');
  const body = `<h1>INTEGRATED FILING — LI</h1><table class="gridtable gITable">${scalar('ISIN', 'INE795G01014')}${scalar('Description of presentation currency', 'INR')}${scalar('Level of rounding used in financial results', 'Lakhs')}${scalar('Date of board meeting when results were approved', '15-07-2026')}</table><h3>Format for financial results by life insurance companies filed with stock exchanges</h3><h3>Amount in (Lakhs)</h3><table><tr><td>Partiuclars</td><td>Current Quarter</td><td>Year to Date Figures</td></tr>${row('Date of start of reporting period', '01-04-2026', true)}${row('Date of end of reporting period', '30-06-2026', true)}${row('Nature of report standalone or consolidated', 'Consolidated', true)}${row('Whether results are audited or unaudited', 'Unaudited', true)}<tr><td>Policyholders' Accounts</td></tr>${account('policy')}</table><table><tr><td>Appropriations</td></tr>${account('appropriations')}</table><h3>SHAREHOLDERS ' Account</h3><h3>Amount in (Lakhs)</h3><table>${account('shareholders')}${row('Extraordinary Items (Net of tax expenses)', '0.00')}</table>`;
  return {
    ...(await equityInput()),
    requestId: randomUUID(),
    parser: NSE_LI_PARSER,
    effectiveOn: '2026-07-15',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_LI_174781_15072026175112_iXBRL_WEB.html',
    body,
  };
}
