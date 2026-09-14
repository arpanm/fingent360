import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectMappedCsv,
  parseMappedHoldings,
  HoldingsImportSchema,
} from '../dist/index.js';
const fixture = () => ({
  format: 'mapped-csv',
  csv: 'Description,Security,Units,Cost\r\n"Synthetic, row",INE002A01018,1,100.00\r\n"Synthetic ""second""",INE002A01018,0.000001,0.01\r\n',
  mapping: {
    isinColumn: 1,
    quantityColumn: 2,
    costColumn: 3,
    costUnit: 'INR-rupees',
    duplicates: 'combine',
  },
  declaredRowCount: 2,
  declaredTotal: '100.01',
});
test('MAPPED-IMPORT-001 explicit quoted mapping reconciles exact source and combined totals without mutating input', () => {
  const input = fixture(),
    before = structuredClone(input),
    result = parseMappedHoldings(input);
  assert.deepEqual(result.holdings, [
    { isin: 'INE002A01018', quantity: '1.000001', totalCostMinor: '10001' },
  ]);
  assert.deepEqual(result.import, {
    parserVersion: 'user-mapped-holdings-csv-v1',
    mapping: input.mapping,
    sourceColumns: 4,
    consolidatedRowCount: 1,
    declaredRowCount: 2,
    declaredTotalMinor: '10001',
  });
  assert.deepEqual(input, before);
  assert.equal(JSON.stringify(result).includes('Synthetic'), false);
});
test('MAPPED-IMPORT-001 whole paise remain exact beyond binary-float precision and zero-row input is explicit', () => {
  const input = fixture();
  input.csv =
    'Ignored,Security,Units,Cost\nSynthetic,INE002A01018,1,9007199254740993';
  input.mapping.costUnit = 'INR-paise';
  input.declaredRowCount = 1;
  input.declaredTotal = '9007199254740993';
  assert.equal(
    parseMappedHoldings(input).holdings[0].totalCostMinor,
    '9007199254740993',
  );
  input.csv = 'Ignored,Security,Units,Cost';
  input.declaredRowCount = 0;
  input.declaredTotal = '0';
  assert.deepEqual(parseMappedHoldings(input).holdings, []);
});
test('MAPPED-IMPORT-001 duplicates units totals columns and numeric ambiguity fail closed', () => {
  for (const mutate of [
    (v) => (v.mapping.duplicates = 'reject'),
    (v) => (v.mapping.costUnit = 'USD'),
    (v) => (v.mapping.costColumn = 2),
    (v) => (v.mapping.costColumn = 9),
    (v) => (v.declaredRowCount = 1),
    (v) => (v.declaredTotal = '100.02'),
    (v) => (v.csv = v.csv.replace('100.00', '=100')),
    (v) => (v.csv = v.csv.replace('100.00', '1e2')),
    (v) => (v.csv = v.csv.replace('100.00', '100.001')),
    (v) => (v.csv = v.csv.replace('0.000001', '-1')),
    (v) => (v.csv = v.csv.replace('0.000001', '0.0000001')),
    (v) => (v.sourceName = 'Invented broker'),
    (v) => (v.csv = v.csv.replace('100.00', '99999999999999.99')),
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => parseMappedHoldings(input));
  }
});
test('MAPPED-IMPORT-001 bounded CSV grammar rejects malformed quoting duplicated headers and ragged records', () => {
  for (const csv of [
    'A,B,a\n1,2,3',
    'A,B,C\n1,2',
    'A,B,C\n\n',
    'A,B,C\n"1"x,2,3',
    'A,B,C\n"1,2,3',
    'A,B,C\n1,2,3\r',
    'A,B,C\n1,\u0000,3',
    'A,B,C\n' + '1,2,3\n'.repeat(201),
    'A,B,C\n' + 'x'.repeat(50000),
  ])
    assert.throws(() => inspectMappedCsv(csv));
  assert.deepEqual(inspectMappedCsv('\uFEFFA,B,C\r\n"a\nb",2,3\r\n').rows, [
    ['a\nb', '2', '3'],
  ]);
});
test('MAPPED-IMPORT-001 control validation rejects C0 and DEL while preserving tabs Unicode and normalized line endings', () => {
  const forbidden = [...Array(32).keys()].filter(
    (code) => code !== 9 && code !== 10,
  );
  forbidden.push(127);
  for (const code of forbidden) {
    assert.throws(
      () => inspectMappedCsv(`A,B,C\n"x${String.fromCharCode(code)}y",2,3`),
      /unsupported control characters/,
    );
  }
  assert.deepEqual(inspectMappedCsv('A,B,C\r\n"界\tline\nnext",2,3\r\n').rows, [
    ['界\tline\nnext', '2', '3'],
  ]);
});
test('MAPPED-IMPORT-001 receipt metadata cannot masquerade as a standard import or declare impossible consolidation', () => {
  const receipt = parseMappedHoldings(fixture()).import;
  for (const change of [
    { parserVersion: 'standard-holdings-csv-v1' },
    { consolidatedRowCount: 3 },
    { sourceColumns: 3 },
    { mapping: undefined },
  ])
    assert.equal(
      HoldingsImportSchema.safeParse({ ...receipt, ...change }).success,
      false,
    );
});

test('MAPPED-IMPORT-001 encoded cost-column requests reject oversized ignored Unicode before connected/local divergence', () => {
  const input = fixture();
  input.csv =
    'Ignored,Security,Units,Cost\n' +
    Array.from(
      { length: 100 },
      () => `${'界'.repeat(350)},INE002A01018,1,1`,
    ).join('\n');
  input.declaredRowCount = 100;
  input.declaredTotal = '100';
  assert.ok(input.csv.length < 50000);
  assert.throws(() => parseMappedHoldings(input), /100,000 encoded bytes/);
});
