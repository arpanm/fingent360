import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseEcbRates,
  EcbRateEditionSchema,
  EcbRatePublicSchema,
  ecbEvaluationDay,
  ecbRateTimeline,
  ECB_RATE_PARSER,
  ECB_RATE_SOURCE,
  ECB_RATE_URL,
} from '../dist/index.js';
const fixture = () =>
  readFile(new URL('./fixtures/ecb-policy-rates.xml', import.meta.url), 'utf8');
const edition = (parsed) =>
  EcbRateEditionSchema.parse({
    edition: 1,
    parserVersion: ECB_RATE_PARSER,
    sourceId: ECB_RATE_SOURCE,
    sourceUrl: ECB_RATE_URL,
    retrievedAt: '2026-09-14T01:00:00.000Z',
    responsePreparedAt: parsed.responsePreparedAt,
    sourceHash: 'a'.repeat(64),
    unit: 'percent-per-annum',
    region: 'euro-area',
    knownAt: null,
    vintageBasis: 'retrieval-revision-only',
    observations: parsed.observations,
  });

test('synthetic documented SDMX preserves exact signed rates and effective dates, never invents publication time', async () => {
  const parsed = parseEcbRates(await fixture()),
    value = edition(parsed);
  assert.equal(parsed.observations.length, 6);
  assert.deepEqual(parsed.observations[0], {
    series: 'DFR',
    effectiveOn: '2020-01-02',
    value: '-0.125',
  });
  assert.equal(
    parsed.observations.find((row) => row.series === 'MRR_FR').value,
    '1.2345678',
  );
  assert.equal(value.knownAt, null);
  assert.equal(
    EcbRateEditionSchema.safeParse({ ...value, knownAt: value.retrievedAt })
      .success,
    false,
  );
});
test('synthetic future dates stay upcoming until the Berlin effective day', async () => {
  const value = edition(parseEcbRates(await fixture()));
  assert.equal(
    ecbEvaluationDay(new Date('2026-09-13T22:30:00Z')),
    '2026-09-14',
  );
  assert.equal(ecbRateTimeline(value, '2026-09-14')[0].current.value, '-0.125');
  assert.equal(ecbRateTimeline(value, '2026-09-14')[0].upcoming[0].value, '0');
  assert.equal(ecbRateTimeline(value, '2200-01-02')[0].current.value, '0');
});
test('parser rejects unknown prefixes, nested rebinding and declarations before namespace removal', async () => {
  const body = await fixture();
  for (const rejected of [
    body.replaceAll('generic:Obs', 'fake:Obs'),
    body.replace(
      '<generic:Series>',
      '<generic:Series xmlns:generic="https://invalid.example/namespace">',
    ),
    body.replace(
      '<generic:Series>',
      '<generic:Series xmlns:generic="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic">',
    ),
    body.replace(
      '<message:GenericData ',
      '<message:GenericData xmlns:fake="http://www.sdmx.org/resources/sdmxml/schemas/v2_1/data/generic" ',
    ),
    body.replace(
      '<message:GenericData ',
      '<!DOCTYPE x [<!ENTITY boom "x">]><message:GenericData ',
    ),
    body.replace('SYNTHETIC-SDMX', '<![CDATA[untrusted]]>SYNTHETIC-SDMX'),
  ])
    assert.throws(() => parseEcbRates(rejected));
});
test('parser rejects changed dimensions, duplicate dates, malformed decimals and oversized XML', async () => {
  const body = await fixture();
  for (const rejected of [
    body.replace('value="U2"', 'value="IN"'),
    body.replace('value="DFR"', 'value="UNKNOWN"'),
    body.replace('value="2200-01-02"', 'value="2020-01-02"'),
    body.replace('-0.1250000', '1e3'),
    body.replace('-0.1250000', '0.12345678'),
    body.replace('-0.1250000', 'NaN'),
    body.replace('value="2020-01-02"', 'value="2020-02-31"'),
    body.replace(
      '<generic:ObsValue value="-0.1250000"/>',
      '<generic:ObsValue value="-0.1250000" untrusted="true"/>',
    ),
    ' '.repeat(1000001),
  ])
    assert.throws(() => parseEcbRates(rejected));
});
test('public withdrawal contract rejects retained numerical contents', async () => {
  const value = edition(parseEcbRates(await fixture()));
  const current = {
    status: 'withdrawn',
    edition: null,
    checkedAt: value.retrievedAt,
    reviewedAt: value.retrievedAt,
    evaluatedAt: value.retrievedAt,
    evaluatedOn: '2026-09-14',
    timeZone: 'Europe/Berlin',
  };
  assert.equal(EcbRatePublicSchema.safeParse(current).success, true);
  assert.equal(
    EcbRatePublicSchema.safeParse({ ...current, edition: value }).success,
    false,
  );
});
