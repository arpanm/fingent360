import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import {
  parseOilBenchmarks,
  roundOilSource,
  OilBenchmarkObservationsSchema,
} from '../dist/index.js';

// Every numeric cell is synthetic; the fixture cites only the inspected wire layout.
const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/oil-benchmarks.json', import.meta.url),
    'utf8',
  ),
);
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relns = 'http://schemas.openxmlformats.org/package/2006/relationships';
function workbook(change = {}) {
  const texts = [
    'World Bank Commodity Price Data (The Pink Sheet)',
    'monthly prices in nominal US dollars, 1960 to present',
    'Updated on March 02, 2000',
    'Crude oil, Brent',
    'Crude oil, WTI',
    '($/bbl)',
    '…',
  ];
  const cell = (r, value) =>
    value === null
      ? `<c r="${r}" t="s"><v>6</v></c>`
      : `<c r="${r}" s="0"><v>${value}</v></c>`;
  const part = {
    'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Monthly Prices" sheetId="1" r:id="r1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${relns}"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/sharedStrings.xml': `<sst xmlns="${ns}">${texts.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`,
    'xl/styles.xml': `<styleSheet xmlns="${ns}"><numFmts><numFmt numFmtId="164" formatCode="0.0"/></numFmts><cellXfs><xf numFmtId="164"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row><row r="4"><c r="A4" t="s"><v>2</v></c></row><row r="5"><c r="C5" t="s"><v>3</v></c><c r="E5" t="s"><v>4</v></c></row><row r="6"><c r="C6" t="s"><v>5</v></c><c r="E6" t="s"><v>5</v></c></row>${fixture.rows.map((row, i) => `<row r="${i + 7}"><c r="A${i + 7}" t="inlineStr"><is><t>${row.period}</t></is></c>${cell('C' + (i + 7), row.brent)}${cell('E' + (i + 7), row.wti)}</row>`).join('')}</sheetData></worksheet>`,
  };
  for (const [key, update] of Object.entries(change))
    part[key] = typeof update === 'function' ? update(part[key]) : update;
  return zipSync(
    Object.fromEntries(
      Object.entries(part).map(([key, value]) => [key, strToU8(value)]),
    ),
  );
}
test('oil: synthetic monthly source reconciles lexical tails, negative tie and missing value', () => {
  const result = parseOilBenchmarks(workbook());
  assert.equal(result.reportedUpdatedOn, fixture.reportedUpdatedOn);
  assert.deepEqual(
    result.observations.map((row) => row.value),
    ['12.3', '13.1', '-2.3', null],
  );
  assert.equal(result.observations[0].sourceValue, fixture.rows[0].brent);
  assert.equal(roundOilSource('-0.04'), '0.0');
  assert.equal(roundOilSource('1.25e1'), '12.5');
  assert.equal(roundOilSource('-1.25'), '-1.3');
  assert.throws(() => roundOilSource('NaN'));
  assert.throws(() => roundOilSource('1e99'));
});
test('oil: observed column identity, USD/barrel and one-decimal source precision are required', () => {
  for (const [before, after] of [
    ['Crude oil, Brent', 'Crude oil, Dubai'],
    ['($/bbl)', '(INR/bbl)'],
  ])
    assert.throws(() =>
      parseOilBenchmarks(
        workbook({
          'xl/sharedStrings.xml': (text) => text.replace(before, after),
        }),
      ),
    );
  assert.throws(() =>
    parseOilBenchmarks(
      workbook({ 'xl/styles.xml': (text) => text.replace('0.0', '0.00') }),
    ),
  );
});
test('oil: monthly continuity, date completion and lexical reconciliation fail closed', () => {
  const key = 'xl/worksheets/sheet1.xml';
  assert.throws(() =>
    parseOilBenchmarks(
      workbook({ [key]: (text) => text.replace('2000M02', '2000M03') }),
    ),
  );
  assert.throws(() =>
    parseOilBenchmarks(
      workbook({ [key]: (text) => text.replace('2000M02', '2000M01') }),
    ),
  );
  const rows = parseOilBenchmarks(workbook()).observations;
  assert.equal(
    OilBenchmarkObservationsSchema.safeParse(rows.slice(1)).success,
    false,
  );
  assert.equal(
    OilBenchmarkObservationsSchema.safeParse(
      rows.map((row, i) => (i ? row : { ...row, value: '12.4' })),
    ).success,
    false,
  );
});
test('oil: formulas, DTD, namespace aliases and external relationships are rejected', () => {
  const key = 'xl/worksheets/sheet1.xml';
  for (const change of [
    (text) => text.replace('<v>12.349', '<f>1+1</f><v>12.349'),
    (text) => '<!DOCTYPE worksheet>' + text,
    (text) =>
      text.replace('<sheetData>', '<sheetData xmlns="https://invalid.test">'),
    (text) =>
      text
        .replace(
          '<c r="C7"',
          '<fake:c xmlns:fake="https://invalid.test" r="C7"',
        )
        .replace(
          '<v>12.349999999999998</v></c>',
          '<v>12.349999999999998</v></fake:c>',
        ),
  ])
    assert.throws(() => parseOilBenchmarks(workbook({ [key]: change })));
  assert.throws(() =>
    parseOilBenchmarks(
      workbook({
        'xl/_rels/workbook.xml.rels': (text) =>
          text.replace(
            'Target="worksheets/sheet1.xml"',
            'Target="https://invalid.test/private" TargetMode="External"',
          ),
      }),
    ),
  );
});
test('oil: forbidden ZIP parts, corruption and oversized source fail before observations', () => {
  assert.throws(() =>
    parseOilBenchmarks(workbook({ 'xl/vbaProject.bin': 'not executable' })),
  );
  assert.throws(() => parseOilBenchmarks(new Uint8Array(3000001)));
  const bytes = workbook();
  bytes[60] ^= 1;
  assert.throws(() => parseOilBenchmarks(bytes));
});
test('oil: selected row identity and visibility plus workbook/relationship namespaces are source-bound', () => {
  const key = 'xl/worksheets/sheet1.xml';
  for (const change of [
    (text) => text.replace('<row r="7">', '<row r="9">'),
    (text) => text.replace('<row r="7">', '<row r="7" hidden="1">'),
    (text) =>
      text.replace(
        '<sheetData>',
        '<cols><col min="3" max="3" hidden="1"/></cols><sheetData>',
      ),
  ])
    assert.throws(() => parseOilBenchmarks(workbook({ [key]: change })));
  assert.throws(() =>
    parseOilBenchmarks(
      workbook({
        'xl/workbook.xml': (text) =>
          text.replace('<sheets>', '<sheets xmlns="https://invalid.test">'),
      }),
    ),
  );
  assert.throws(() =>
    parseOilBenchmarks(
      workbook({
        'xl/_rels/workbook.xml.rels': (text) =>
          text.replace(
            '<Relationship Id=',
            '<Relationship xmlns="https://invalid.test" Id=',
          ),
      }),
    ),
  );
});
