import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { NSE_INDAS_STATEMENTS_PARSER } from '../../../packages/contracts/src/index';
import { equityInput } from './equity-coverage';
export { test, expect, retentionHeaders } from './equity-coverage';
export { indiaActors } from './india-macro';
export async function statementInput() {
  const original = await readFile(
    new URL(
      '../../../packages/contracts/test/fixtures/equity-indas.html',
      import.meta.url,
    ),
    'utf8',
  );
  const row = (label: string, value: string) =>
    `<tr><th>${label}</th><td>${value}</td></tr>`;
  const metadata =
    row('Date of start of reporting period', '01-04-2024') +
    row('Date of end of reporting period', '31-03-2025') +
    row('Whether results are audited or unaudited', 'Audited') +
    row('Nature of report standalone or consolidated', 'Consolidated');
  const balance = [
    ['Total assets', '100.00'],
    ['Total liabilities', '60.00'],
    ['Total equity', '40.00'],
    ['Cash and cash equivalents', '10.00'],
    ['Borrowings, current', '20.00'],
    ['Borrowings, non-current', '30.00'],
    ['Total equity and liabilites', '100.00'],
  ];
  const cash = [
    ['Net cash flows from (used in) operating activities', '10.00'],
    ['Net cash flows from (used in) investing activities', '(3.00)'],
    ['Net cash flows from (used in) financing activities', '(2.00)'],
    [
      'Net increase (decrease) in cash and cash equivalents before effect of exchange rate changes',
      '5.00',
    ],
    ['Effect of exchange rate changes on cash and cash equivalents', '1.00'],
    ['Net increase (decrease) in cash and cash equivalents', '6.00'],
    [
      'Cash and cash equivalents cash flow statement at beginning of period',
      '(8.00)',
    ],
    [
      'Cash and cash equivalents cash flow statement at end of period',
      '(2.00)',
    ],
  ];
  const table = (heading: string, values: string[][]) =>
    `<h3>${heading}</h3><h3>Amount in (Lakhs)</h3><table class="gridtable">${metadata}${values.map(([label, value]) => row(label!, value!)).join('')}</table>`;
  return {
    ...(await equityInput()),
    requestId: randomUUID(),
    parser: NSE_INDAS_STATEMENTS_PARSER,
    effectiveOn: '2025-04-30',
    sourceUrl:
      'https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_154496_30042026011808_iXBRL_WEB.html',
    body: original.replace(
      '</body>',
      table('Statement of Asset and Liabilities', balance) +
        table('Cash flow statement, indirect', cash) +
        '</body>',
    ),
  };
}
