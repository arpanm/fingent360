import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import {
  CCIL_LIQUIDITY_HEADERS,
  CcilLiquidityEditionSchema,
} from '../../../packages/contracts/src/index';
import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { governanceHeaders as headers } from './research-governance';
/** Reconstructed minimal XLSX container, not a copied original. The two numeric
 * fact rows were independently read from CCIL July2026, source hash in task.
 * Additional rows below are explicitly synthetic only when requested. */
export function ccilLiquidityWorkbook(extraRows = 0) {
  const rows: string[][] = [
    [...CCIL_LIQUIDITY_HEADERS],
    [
      '05.74 GS 2026',
      'CENTRAL GOVERMENT',
      '46204',
      '5.74',
      '46205',
      '1.34254584763383E-3',
      '0.13428571428571001',
      '0.363480128893651',
      '0.189999999999998',
      '4.9999999999997199E-2',
      '-',
      '-',
      'Orders Not Adding to 25Cr On Bid/Ask Side',
    ],
    [
      '06.01 GS 2028',
      'CENTRAL GOVERMENT',
      '46204',
      '6.01',
      '46205',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      'No Orders on Bid/Ask Side',
    ],
  ];
  for (let i = 0; i < extraRows; i++)
    rows.push([
      'TEST-SIMULATION source description ' + i,
      'STATE GOVERMENT',
      '46234',
      'TEST-SIMULATION floating coupon',
      '46237',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      'No Orders on Bid/Ask Side',
    ]);
  const strings: string[] = [],
    esc = (s: string) =>
      s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
  const sheet =
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows
      .map(
        (r, i) =>
          '<row r="' +
          (i + 1) +
          '">' +
          r
            .map((v, j) => {
              const numeric =
                i > 0 &&
                (j === 2 || j === 4 || (/^\d/.test(v) && j >= 3 && j <= 11));
              if (!numeric && !strings.includes(v)) strings.push(v);
              return `<c r="${String.fromCharCode(65 + j)}${i + 1}"${numeric ? '' : ' t="s"'}><v>${numeric ? v : strings.indexOf(v)}</v></c>`;
            })
            .join('') +
          '</row>',
      )
      .join('') +
    '</sheetData></worksheet>';
  return zipSync(
    Object.fromEntries(
      Object.entries({
        '[Content_Types].xml':
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
        '_rels/.rels':
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml':
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><sheets><sheet name="Sheet 1" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels':
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml': sheet,
        'xl/sharedStrings.xml':
          '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
          strings.map((s) => '<si><t>' + esc(s) + '</t></si>').join('') +
          '</sst>',
      }).map(([name, value]) => [name, strToU8(value)]),
    ),
  );
}
/** Mutates only locally generated test ZIPs, never untrusted provider input. */
export function changedLiquidityWorkbook(
  part: string,
  change: (xml: string) => string,
) {
  const parts = unzipSync(ccilLiquidityWorkbook());
  parts[part] = strToU8(change(strFromU8(parts[part] ?? new Uint8Array())));
  return zipSync(parts);
}
export async function captureLiquidity(
  request: APIRequestContext,
  bytes = ccilLiquidityWorkbook(),
  id: string = randomUUID(),
) {
  const response = await request.post('/api/v1/ops/bond-liquidity/import', {
    headers,
    data: { requestId: id, body: Buffer.from(bytes).toString('base64') },
  });
  expect(response.status()).toBe(201);
  return CcilLiquidityEditionSchema.parse(await response.json());
}
export async function reviewLiquidity(
  request: APIRequestContext,
  id: string,
  decision: 'publish' | 'withdraw' = 'publish',
) {
  const response = await request.post(
    `/api/v1/ops/bond-liquidity/${id}/review`,
    {
      headers,
      data: {
        requestId: randomUUID(),
        decision,
        reason:
          'TEST-SIMULATION independent historical liquidity source review.',
      },
    },
  );
  expect(response.status()).toBe(201);
  return CcilLiquidityEditionSchema.parse(await response.json());
}
