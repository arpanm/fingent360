import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import {
  parseHoldingsWorkbook,
  holdingsWorkbookTemplate,
  workbookParts,
} from '../dist/index.js';
function change(fn) {
  const p = workbookParts(holdingsWorkbookTemplate(true));
  fn(p);
  return zipSync(Object.fromEntries([...p].map(([k, v]) => [k, strToU8(v)])));
}
test('XLSX-001 blank/sample and exact lexical long money reconcile', () => {
  assert.equal(
    parseHoldingsWorkbook(holdingsWorkbookTemplate()).holdings.length,
    0,
  );
  assert.equal(
    parseHoldingsWorkbook(holdingsWorkbookTemplate(true)).holdings[0].quantity,
    '1.000001',
  );
  const bytes = change((p) => {
    for (const name of ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'])
      p.set(name, p.get(name).replace('10001', '9999999999999999'));
  });
  assert.equal(
    parseHoldingsWorkbook(bytes).holdings[0].totalCostMinor,
    '9999999999999999',
  );
});
test('XLSX-001 declaration mismatch formulas external links and DTD rejected', () => {
  for (const mutate of [
    (p) =>
      p.set(
        'xl/worksheets/sheet2.xml',
        p.get('xl/worksheets/sheet2.xml').replace('10001', '10002'),
      ),
    (p) =>
      p.set(
        'xl/worksheets/sheet1.xml',
        p
          .get('xl/worksheets/sheet1.xml')
          .replace('<c r="B2"', '<c r="B2"')
          .replace('<is><t>1.000001</t></is>', '<f>1+1</f><v>2</v>'),
      ),
    (p) =>
      p.set(
        'xl/workbook.xml',
        '<!DOCTYPE workbook [<!ENTITY x "a">]>' + p.get('xl/workbook.xml'),
      ),
    (p) =>
      p.set(
        'xl/_rels/workbook.xml.rels',
        p
          .get('xl/_rels/workbook.xml.rels')
          .replace(
            'Target="worksheets/sheet1.xml"',
            'Target="https://example.invalid" TargetMode="External"',
          ),
      ),
  ])
    assert.throws(() => parseHoldingsWorkbook(change(mutate)));
});
test('XLSX-001 rejects styled date/scientific numeric cells and accepts text cells', () => {
  for (const format of [14, 11])
    assert.throws(
      () =>
        parseHoldingsWorkbook(
          change((p) => {
            p.set(
              'xl/worksheets/sheet1.xml',
              p
                .get('xl/worksheets/sheet1.xml')
                .replace(
                  '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
                  '<c r="B2" s="1"><v>45000</v></c>',
                ),
            );
            p.set(
              'xl/styles.xml',
              `<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="${format}"/></cellXfs></styleSheet>`,
            );
          }),
        ),
      /styled numeric/,
    );
});
test('XLSX-001 forged small inflated size and CRC never accepted', () => {
  const bytes = holdingsWorkbookTemplate(true);
  const bad = bytes.slice();
  bad[40] ^= 1;
  assert.throws(() => parseHoldingsWorkbook(bad));
  // Highly compressed hostile XML with consistent declared-size forgery exercises fixed-output overrun.
  const bomb = zipSync({ 'xl/workbook.xml': strToU8('A'.repeat(600000)) });
  const view = new DataView(bomb.buffer);
  for (let i = 0; i + 46 < bomb.length; i++) {
    const sig = view.getUint32(i, true);
    if (sig === 0x04034b50) view.setUint32(i + 22, 20, true);
    if (sig === 0x02014b50) view.setUint32(i + 24, 20, true);
  }
  assert.throws(() => workbookParts(bomb), /length or CRC/);
});
test('XLSX-001 qualified formula and relationship elements cannot bypass fixed-template checks', () => {
  for (const mutate of [
    (p) =>
      p.set(
        'xl/worksheets/sheet1.xml',
        p
          .get('xl/worksheets/sheet1.xml')
          .replace(
            '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
            '<c r="B2"><x-l:f xmlns:x-l="http://schemas.openxmlformats.org/spreadsheetml/2006/main">1+1</x-l:f><v>1.000001</v></c>',
          ),
      ),
    (p) =>
      p.set(
        'xl/_rels/workbook.xml.rels',
        p
          .get('xl/_rels/workbook.xml.rels')
          .replace(
            '</Relationships>',
            '<x-l:Relationship xmlns:x-l="http://schemas.openxmlformats.org/package/2006/relationships" Id="evil" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/private" TargetMode="External"/></Relationships>',
          ),
      ),
  ])
    assert.throws(
      () => parseHoldingsWorkbook(change(mutate)),
      /qualified XML elements/,
    );
});
test('XLSX-001 inherited row and column date/scientific styles reject numeric serials', () => {
  for (const format of [14, 11])
    for (const inheritance of ['row', 'column'])
      assert.throws(
        () =>
          parseHoldingsWorkbook(
            change((p) => {
              let sheet = p
                .get('xl/worksheets/sheet1.xml')
                .replace(
                  '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
                  '<c r="B2"><v>45000</v></c>',
                );
              sheet =
                inheritance === 'row'
                  ? sheet.replace(
                      '<row r="2">',
                      '<row r="2" s="1" customFormat="1">',
                    )
                  : sheet.replace(
                      '<sheetData>',
                      '<cols><col min="2" max="2" style="1"/></cols><sheetData>',
                    );
              p.set('xl/worksheets/sheet1.xml', sheet);
              p.set(
                'xl/styles.xml',
                `<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="${format}"/></cellXfs></styleSheet>`,
              );
            }),
          ),
        /styled numeric/,
      );
  const unstyled = change((p) =>
    p.set(
      'xl/worksheets/sheet1.xml',
      p
        .get('xl/worksheets/sheet1.xml')
        .replace(
          '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
          '<c r="B2"><v>1.000001</v></c>',
        ),
    ),
  );
  assert.equal(
    parseHoldingsWorkbook(unstyled).holdings[0].quantity,
    '1.000001',
  );
});
test('XLSX-001 numeric cells inherit default xf and reject non-General formats', () => {
  for (const format of [14, 11])
    assert.throws(
      () =>
        parseHoldingsWorkbook(
          change((p) => {
            p.set(
              'xl/worksheets/sheet1.xml',
              p
                .get('xl/worksheets/sheet1.xml')
                .replace(
                  '<c r="B2" t="inlineStr" s="1"><is><t>1.000001</t></is></c>',
                  '<c r="B2"><v>45000</v></c>',
                ),
            );
            p.set(
              'xl/styles.xml',
              `<styleSheet><cellXfs><xf numFmtId="${format}"/></cellXfs></styleSheet>`,
            );
          }),
        ),
      /styled numeric/,
    );
});
test('XLSX-001 actual openpyxl 3.1.5 round trip preserves exact text and rooted internal sheets', async () => {
  const { readFile } = await import('node:fs/promises');
  // Parent-generated with openpyxl3.1.5: load generated synthetic sample, set C2 and
  // Reconciliation!B2 to text 9999999999999999, save. No customer data.
  const bytes = await readFile(
    new URL('./fixtures/SYNTHETIC-openpyxl-holdings.xlsx', import.meta.url),
  );
  const result = parseHoldingsWorkbook(bytes);
  assert.deepEqual(result.holdings, [
    {
      isin: 'INE002A01018',
      quantity: '1.000001',
      totalCostMinor: '9999999999999999',
    },
  ]);
  assert.equal(result.declaredTotalMinor, '9999999999999999');
});

test('XLSX-001 hidden rows and columns cannot conceal imported quantities', () => {
  for (const hidden of ['1', 'true'])
    for (const kind of ['row', 'column'])
      assert.throws(
        () =>
          parseHoldingsWorkbook(
            change((p) => {
              const path = 'xl/worksheets/sheet1.xml';
              let sheet = p.get(path);
              sheet =
                kind === 'row'
                  ? sheet.replace(
                      '<row r="2">',
                      `<row r="2" hidden="${hidden}">`,
                    )
                  : sheet.replace(
                      '<sheetData>',
                      `<cols><col min="2" max="2" hidden="${hidden}"/></cols><sheetData>`,
                    );
              p.set(path, sheet);
            }),
          ),
        /visible/,
      );
});
