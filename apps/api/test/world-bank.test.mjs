import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWorldBank, normalizeDecimal } from '../dist/world-bank.js';
// Synthetic wire fixtures test parser invariants only; never used by the app.
const key = 'NY.GDP.MKTP.KD.ZG';
function response(value = '1.234567890123456789', extra = '') {
  return `[{"page":1,"pages":1,"per_page":100,"total":1,"sourceid":"2","lastupdated":"2026-01-01"},[{"indicator":{"id":"${key}","value":"GDP growth"},"country":{"id":"IN","value":"India"},"countryiso3code":"IND","date":"2024","value":${value},"unit":"","obs_status":"","decimal":1${extra}}]]`;
}
test('source numeric lexemes are retained exactly, including exponent and null', () => {
  assert.equal(
    parseWorldBank(response(), key).observations[0].value,
    '1.234567890123456789',
  );
  assert.equal(
    parseWorldBank(response('1.234e-4'), key).observations[0].value,
    '0.0001234',
  );
  assert.equal(
    parseWorldBank(response('null'), key).observations[0].value,
    null,
  );
  assert.equal(normalizeDecimal('-0.000'), '0');
});
test('schema, identity, units, partial pages and future observations quarantine', () => {
  for (const body of [
    response('1', ',"unexpected":true'),
    response().replace('"IND"', '"USA"'),
    response().replace('"pages":1', '"pages":2'),
    response().replace('"unit":""', '"unit":"USD"'),
    response().replace('"2024"', '"2099"'),
    '<html>failure</html>',
  ])
    assert.throws(() => parseWorldBank(body, key, 2026));
});
test('unsupported precision rejects without lossy conversion', () => {
  assert.throws(() => parseWorldBank(response('1e100'), key));
  assert.throws(() => parseWorldBank(response('"1.2"'), key));
  assert.equal(normalizeDecimal('12.340000000000000000000000000000'), '12.34');
});
