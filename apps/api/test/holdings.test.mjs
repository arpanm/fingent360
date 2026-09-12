import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validIndianIsin,
  parseHoldingsCsv,
  holdingsTotal,
  holdingsCsv,
} from '@fingent360/contracts';
// Public identifiers are only parser fixtures; amounts are synthetic, not market data.
const header = 'isin,quantity,total_cost_paise';
test('holdings CSV exact precision and valid ISIN checksums', () => {
  assert.equal(validIndianIsin('INE002A01018'), true);
  assert.equal(validIndianIsin('INE002A01019'), false);
  const csv = `${header}\nINE002A01018,1.000001,9007199254740993`;
  const rows = parseHoldingsCsv(csv);
  assert.equal(holdingsTotal(rows), '9007199254740993');
  assert.equal(holdingsCsv(rows), csv);
  assert.deepEqual(parseHoldingsCsv(header), []);
});
test('holdings parser rejects malformed, duplicate and ambiguous input', () => {
  for (const csv of [
    `${header}\nINE002A01019,1,1`,
    `${header}\nINE002A01018,0,1`,
    `${header}\nINE002A01018,1,1.2`,
    `${header}\nINE002A01018,1,1\nINE002A01018,2,2`,
    `${header}\nINE002A01018,1,=1+1`,
    `${header}\nINE002A01018,0.0000001,1`,
    `${header},extra\nINE002A01018,1,1,x`,
  ])
    assert.throws(() => parseHoldingsCsv(csv));
});
