import { randomUUID } from 'node:crypto';
import { equityInput } from './equity-coverage';
import {
  BANK_AMOUNT_LABELS,
  BANK_RATIO_LABELS,
  NSE_BANKING_PARSER,
} from '../../../packages/contracts/src/index';
export { test, expect, retentionHeaders } from './equity-coverage';
export { indiaActors } from './india-macro';
/** Synthetic balanced figures in the inspected official two-column rendered grammar; not an exchange capture. */
export async function bankingInput() {
  const metadata = (label: string, value: string) =>
    `<tr><th>${label}</th><td>${value}</td></tr>`;
  const row = (label: string, value: string) =>
    `<tr><th></th><th>${label}</th><td>${value}</td><td>${value}</td></tr>`;
  const values = [
    '1,00,000.00',
    '20,000.00',
    '1,20,000.00',
    '50,000.00',
    '30,000.00',
    '80,000.00',
    '40,000.00',
    '10,000.00',
    '30,000.00',
    '9,000.00',
    '21,000.00',
    '5,000.00',
    '2,000.00',
  ];
  const body = `<html><body><h1>INTEGRATED FILING — BANKING</h1><table class="gridtable gITable">${metadata('ISIN', 'INE545U01014')}${metadata('Name of bank', 'Synthetic Bank')}${metadata('Description of presentation currency', 'INR')}${metadata('Level of rounding used in financial results', 'Lakhs')}${metadata('Date of board meeting when results were approved', '28-04-2026')}</table><h3>Financial Results - Banking</h3><h3>Amount in (Lakhs)</h3><table class="customTablewidth3Col"><tr><th colspan="2">Particulars</th><th>3 months/ 6 months ended (dd-mm-yyyy)</th><th>Year to date figures for current period ended (dd-mm-yyyy)</th></tr><tr><th>A</th><th>Date of start of reporting period</th><td>01-01-2026</td><td>01-04-2025</td></tr>${row('Date of end of reporting period', '31-03-2026')}${row('Nature of report standalone or consolidated', 'Standalone')}${row('Whether results are audited or unaudited', 'Audited')}${Object.values(
    BANK_AMOUNT_LABELS,
  )
    .map((label, index) => row(label, values[index]!))
    .join('')}${Object.values(BANK_RATIO_LABELS)
    .map((label, index) =>
      row(label, ['18.0400', '0', '3.2700', '0.9700'][index]!),
    )
    .join('')}${row('Exceptional items', '0.00')}</table></body></html>`;
  return {
    ...(await equityInput()),
    requestId: randomUUID(),
    parser: NSE_BANKING_PARSER,
    effectiveOn: '2026-04-28',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_BANKING_153854_28042026202816_iXBRL_WEB.html',
    body,
  };
}
