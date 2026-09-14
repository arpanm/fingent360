import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMappedHoldings, HoldingsImportSchema } from '../dist/index.js';
const fixture = () => ({
  format: 'supplemented-csv',
  csv: 'Identifier,Units,Displayed average,Private note\nINE002A01018,3,33.33,SYNTHETIC discarded\nINE002A01018,0.000001,N/A,SYNTHETIC discarded',
  mapping: {
    isinColumn: 0,
    quantityColumn: 1,
    costUnit: 'INR-rupees',
    duplicates: 'combine',
  },
  declaredRowCount: 2,
  declaredTotal: '100.01',
  supplement: {
    origin: 'user-attested-acquisition-cost',
    basis: 'trade-confirmations',
    attested: true,
    rows: [
      {
        sourceRow: 2,
        isin: 'INE002A01018',
        quantity: '3',
        totalCost: '100.00',
      },
      {
        sourceRow: 3,
        isin: 'INE002A01018',
        quantity: '0.000001',
        totalCost: '0.01',
      },
    ],
  },
});
test('BROKER-DIALECTS-001 supplemental costs preserve exact attested row receipts and never multiply displayed averages', () => {
  const input = fixture(),
    original = structuredClone(input),
    result = parseMappedHoldings(input);
  assert.deepEqual(result.holdings, [
    { isin: 'INE002A01018', quantity: '3.000001', totalCostMinor: '10001' },
  ]);
  assert.equal(
    result.import.parserVersion,
    'user-supplemented-holdings-csv-v1',
  );
  assert.deepEqual(result.import.supplement.rows, [
    {
      sourceRow: 2,
      isin: 'INE002A01018',
      quantity: '3',
      totalCostMinor: '10000',
    },
    {
      sourceRow: 3,
      isin: 'INE002A01018',
      quantity: '0.000001',
      totalCostMinor: '1',
    },
  ]);
  assert.equal(
    result.import.supplement.origin,
    'user-attested-acquisition-cost',
  );
  assert.equal(JSON.stringify(result).includes('33.33'), false);
  assert.equal(JSON.stringify(result).includes('SYNTHETIC'), false);
  assert.deepEqual(input, original);
});
test('BROKER-DIALECTS-001 supplemental two-column source, zero rows and high precision remain explicit', () => {
  const input = fixture();
  input.csv = 'Identifier,Units\nINE002A01018,1';
  input.declaredRowCount = 1;
  input.mapping.costUnit = 'INR-paise';
  input.declaredTotal = '9007199254740993';
  input.supplement.rows = [
    {
      sourceRow: 2,
      isin: 'INE002A01018',
      quantity: '1',
      totalCost: '9007199254740993',
    },
  ];
  assert.equal(
    parseMappedHoldings(input).holdings[0].totalCostMinor,
    '9007199254740993',
  );
  input.csv = 'Identifier,Units';
  input.declaredRowCount = 0;
  input.declaredTotal = '0';
  input.supplement.rows = [];
  assert.deepEqual(parseMappedHoldings(input).holdings, []);
  input.supplement.attested = false;
  assert.throws(() => parseMappedHoldings(input));
});
test('BROKER-DIALECTS-001 missing reordered changed or extra supplemental row bindings reject atomically', () => {
  for (const mutate of [
    (v) => v.supplement.rows.pop(),
    (v) => v.supplement.rows.reverse(),
    (v) => v.supplement.rows.push(v.supplement.rows[0]),
    (v) => {
      v.supplement.rows[0].sourceRow = 3;
    },
    (v) => {
      v.supplement.rows[0].isin = 'INE009A01021';
    },
    (v) => {
      v.supplement.rows[0].quantity = '3.0';
    },
    (v) => {
      v.csv = v.csv.replace(',3,', ',4,');
    },
    (v) => {
      v.mapping.quantityColumn = 0;
    },
    (v) => {
      v.mapping.isinColumn = 12;
    },
    (v) => {
      v.mapping.costColumn = 2;
    },
    (v) => {
      v.declaredRowCount = 1;
    },
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => parseMappedHoldings(input));
  }
});
test('BROKER-DIALECTS-001 unknown provenance false attestation missing or estimated numeric costs cannot be accepted', () => {
  for (const mutate of [
    (v) => {
      v.supplement.attested = false;
    },
    (v) => {
      delete v.supplement.attested;
    },
    (v) => {
      v.supplement.origin = 'broker-verified';
    },
    (v) => {
      v.supplement.basis = 'rounded-average';
    },
    (v) => {
      v.supplement.rawStatement = 'private';
    },
    (v) => {
      v.declaredTotal = '99.99';
    },
    (v) => {
      v.mapping.duplicates = 'reject';
    },
    (v) => {
      v.mapping.costUnit = 'USD';
    },
    ...['', '-1', '1e2', '=100', '100.001', '1,000', '99999999999999.99'].map(
      (cost) => (v) => {
        v.supplement.rows[0].totalCost = cost;
      },
    ),
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => parseMappedHoldings(input));
  }
});
test('BROKER-DIALECTS-001 supplemental metadata rejects masquerading and unreconciled immutable receipts', () => {
  const result = parseMappedHoldings(fixture());
  for (const mutate of [
    (v) => {
      v.parserVersion = 'user-mapped-holdings-csv-v1';
    },
    (v) => {
      v.parserVersion = 'standard-holdings-csv-v1';
    },
    (v) => {
      v.supplement.rows[0].totalCostMinor = '9999';
    },
    (v) => {
      v.supplement.rows[0].sourceRow = 4;
    },
    (v) => {
      v.supplement.rows[0].totalCostMinor = 'invalid';
    },
    (v) => {
      v.supplement.mapping.quantityColumn = 31;
    },
    (v) => {
      v.consolidatedRowCount = 2;
    },
    (v) => {
      v.declaredRowCount = 1;
    },
    (v) => {
      delete v.supplement;
    },
  ]) {
    const receipt = structuredClone(result.import);
    mutate(receipt);
    assert.equal(HoldingsImportSchema.safeParse(receipt).success, false);
  }
});
test('BROKER-DIALECTS-001 legacy cost-column input retains its exact version and requires three columns', () => {
  const legacy = {
    format: 'mapped-csv',
    csv: 'ISIN,Quantity,Cost\nINE002A01018,1,123.45',
    mapping: {
      isinColumn: 0,
      quantityColumn: 1,
      costColumn: 2,
      costUnit: 'INR-rupees',
      duplicates: 'reject',
    },
    declaredRowCount: 1,
    declaredTotal: '123.45',
  };
  const result = parseMappedHoldings(legacy);
  assert.equal(result.import.parserVersion, 'user-mapped-holdings-csv-v1');
  assert.equal(result.import.supplement, undefined);
  assert.equal(result.holdings[0].totalCostMinor, '12345');
  assert.throws(() =>
    parseMappedHoldings({ ...legacy, csv: 'ISIN,Quantity\nINE002A01018,1' }),
  );
});
test('BROKER-DIALECTS-001 supplemental encoded request is bounded for connected and local parity', () => {
  const input = fixture();
  input.csv =
    'ISIN,Units,Ignored\n' +
    Array.from(
      { length: 200 },
      () => `INE002A01018,1,"${'""'.repeat(110)}"`,
    ).join('\n');
  input.declaredRowCount = 200;
  input.declaredTotal = '200';
  input.supplement.rows = Array.from({ length: 200 }, (_, i) => ({
    sourceRow: i + 2,
    isin: 'INE002A01018',
    quantity: '1',
    totalCost: '1',
  }));
  assert.ok(input.csv.length < 50000);
  assert.throws(() => parseMappedHoldings(input), /100,000 encoded bytes/);
});
