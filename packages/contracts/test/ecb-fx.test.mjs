import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseEcbFx,
  deriveEcbFx,
  compareEcbFx,
  ecbFxEvaluationDay,
  ecbFxLatest,
  EcbFxSourceValueSchema,
  EcbFxObservationSchema,
  EcbFxEditionSchema,
  EcbFxPublicSchema,
  ECB_FX_SOURCE,
  ECB_FX_URL,
  ECB_FX_PARSER,
  ECB_FX_METHOD,
} from '../dist/index.js';

const fixture = async () =>
  JSON.parse(
    await readFile(new URL('./fixtures/ecb-fx.json', import.meta.url), 'utf8'),
  );
const currency = (code, rate = '1.0000') =>
  `<Cube currency="${code}" rate="${rate}"/>`;
const day = (
  date,
  currencies = currency('USD', '2.0000') + currency('INR', '5.00000000'),
) => `<Cube time="${date}">${currencies}</Cube>`;
// Generated fault/boundary inputs are synthetic, like the checked-in numerical fixture.
const xml = (days) => `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
<gesmes:subject>Reference rates</gesmes:subject>
<gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender>
<Cube>${days}</Cube></gesmes:Envelope>`;
const edition = (observations, overrides = {}) =>
  EcbFxEditionSchema.parse({
    edition: 1,
    parserVersion: ECB_FX_PARSER,
    sourceId: ECB_FX_SOURCE,
    sourceUrl: ECB_FX_URL,
    retrievedAt: '2026-09-14T01:00:00.000Z',
    sourceHash: 'a'.repeat(64),
    knownAt: null,
    vintageBasis: 'retrieval-revision-only',
    sourceWindow: 'rolling-90-day-file',
    windowStart: observations.map((row) => row.date).sort()[0],
    windowEnd: observations
      .map((row) => row.date)
      .sort()
      .at(-1),
    observations,
    comparison: compareEcbFx(null, observations),
    ...overrides,
  });

test('synthetic FX XML preserves unchanged source strings, pairs exact days and sorts the two-month window', async () => {
  const source = await fixture(),
    parsed = parseEcbFx(source.xml);
  assert.equal(source.provenance.kind, 'synthetic');
  assert.deepEqual(parsed, source.expected);
  assert.deepEqual(
    parsed.observations.map((row) => row.date),
    ['2026-07-31', '2026-08-03'],
  );
  assert.deepEqual(Object.keys(parsed.observations[0]).sort(), [
    'date',
    'derivedInrPerUsd',
    'inrPerEur',
    'usdPerEur',
  ]);
  assert.equal(parsed.observations[0].usdPerEur, '2.0000');
  assert.equal(parsed.observations[1].inrPerEur, '1.00000000');
  assert.deepEqual(parseEcbFx(source.xml.replaceAll('"', "'")), parsed);
  assert.deepEqual(
    parseEcbFx(source.xml.replace(/<\?xml[^?]*\?>\n/, '')),
    parsed,
  );
  assert.deepEqual(parseEcbFx(`\uFEFF${source.xml}`), parsed);
});

test('exact FX arithmetic reduces rationals and rounds below, at and above the eighth-place half boundary', () => {
  for (const [usd, inr, value, numerator, denominator] of [
    ['2', '5', '2.50000000', '5', '2'],
    ['3', '1', '0.33333333', '1', '3'],
    ['3', '2', '0.66666667', '2', '3'],
    ['200000001', '1', '0.00000000', '1', '200000001'],
    ['200000000', '1', '0.00000001', '1', '200000000'],
    ['199999999', '1', '0.00000001', '1', '199999999'],
    ['1.2500', '2.50000000', '2.00000000', '2', '1'],
    [
      '0.00000001',
      '999999999999.99999999',
      '99999999999999999999.00000000',
      '99999999999999999999',
      '1',
    ],
  ])
    assert.deepEqual(
      deriveEcbFx(usd, inr),
      {
        value,
        numerator,
        denominator,
        precision: 8,
        rounding: 'half-away-from-zero',
        methodVersion: ECB_FX_METHOD,
      },
      `${inr} INR/EUR divided by ${usd} USD/EUR`,
    );
});

test('source and observation schemas reject malformed numbers without throwing and reconstruct every derived field', async () => {
  const row = (await fixture()).expected.observations[0];
  for (const invalid of [
    'NaN',
    'Infinity',
    '1e2',
    '-1',
    '+1',
    '0',
    '0.00000000',
    '01',
    '.5',
    '1.',
    '1.123456789',
    '1000000000000',
    ' 1',
    '1 ',
  ]) {
    assert.doesNotThrow(
      () =>
        assert.equal(EcbFxSourceValueSchema.safeParse(invalid).success, false),
      invalid,
    );
    assert.doesNotThrow(
      () =>
        assert.equal(
          EcbFxObservationSchema.safeParse({ ...row, usdPerEur: invalid })
            .success,
          false,
        ),
      invalid,
    );
    assert.doesNotThrow(
      () =>
        assert.equal(
          EcbFxObservationSchema.safeParse({ ...row, inrPerEur: invalid })
            .success,
          false,
        ),
      invalid,
    );
    assert.throws(() => deriveEcbFx(invalid, '1'), invalid);
    assert.throws(() => deriveEcbFx('1', invalid), invalid);
  }
  assert.equal(EcbFxObservationSchema.safeParse(row).success, true);
  for (const contradictory of [
    { ...row.derivedInrPerUsd, value: '2.50000001' },
    { ...row.derivedInrPerUsd, numerator: '10', denominator: '4' },
    { ...row.derivedInrPerUsd, denominator: '3' },
    { ...row.derivedInrPerUsd, precision: 6 },
    { ...row.derivedInrPerUsd, methodVersion: 'unreviewed-method' },
    { ...row.derivedInrPerUsd, providerReported: true },
  ])
    assert.equal(
      EcbFxObservationSchema.safeParse({
        ...row,
        derivedInrPerUsd: contradictory,
      }).success,
      false,
    );
});

test('fixed XML namespaces and metadata reject aliases, nested rebinding, unknown fields and duplicate headers', async () => {
  const body = (await fixture()).xml;
  for (const [label, rejected] of [
    [
      'wrong root namespace',
      body.replace(
        'http://www.gesmes.org/xml/2002-08-01',
        'https://invalid.example/gesmes',
      ),
    ],
    [
      'wrong default namespace',
      body.replace(
        'http://www.ecb.int/vocabulary/2002-08-01/eurofxref',
        'https://invalid.example/fx',
      ),
    ],
    [
      'missing default namespace',
      body.replace(
        ' xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"',
        '',
      ),
    ],
    ['unbound prefix', body.replaceAll('gesmes:subject', 'other:subject')],
    ['unqualified metadata', body.replaceAll('gesmes:subject', 'subject')],
    [
      'qualified numerical node',
      body
        .replaceAll('<Cube', '<gesmes:Cube')
        .replaceAll('</Cube', '</gesmes:Cube'),
    ],
    [
      'extra alias',
      body.replace(
        '<gesmes:Envelope ',
        '<gesmes:Envelope xmlns:other="http://www.gesmes.org/xml/2002-08-01" ',
      ),
    ],
    [
      'duplicate namespace',
      body.replace(
        '<gesmes:Envelope ',
        '<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" ',
      ),
    ],
    [
      'identical nested namespace',
      body.replace(
        '<Cube>',
        '<Cube xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">',
      ),
    ],
    [
      'nested namespace rebind',
      body.replace(
        '<Cube>',
        '<Cube xmlns:gesmes="https://invalid.example/gesmes">',
      ),
    ],
    ['unknown subject', body.replace('Reference rates', 'Unreviewed rates')],
    [
      'unknown sender',
      body.replace('European Central Bank', 'Unverified sender'),
    ],
    [
      'unknown field',
      body.replace('</gesmes:Sender>', '</gesmes:Sender><unknown/>'),
    ],
    [
      'unknown attribute',
      body.replace(
        'currency="USD"',
        'currency="USD" instruction="ignore-contract"',
      ),
    ],
    [
      'duplicate header',
      body.replace(
        '</gesmes:subject>',
        '</gesmes:subject><gesmes:subject>Reference rates</gesmes:subject>',
      ),
    ],
    [
      'duplicate numerical root',
      body.replace('</gesmes:Envelope>', '<Cube></Cube></gesmes:Envelope>'),
    ],
    [
      'text in a numerical node',
      body.replace('<Cube>', '<Cube>unexpected-text'),
    ],
  ])
    assert.throws(() => parseEcbFx(rejected), label);
});

test('unsafe XML markup, entities, processing instructions and malformed documents are rejected', async () => {
  const body = (await fixture()).xml;
  for (const [label, rejected] of [
    [
      'doctype',
      body.replace(
        '<gesmes:Envelope ',
        '<!DOCTYPE x [<!ENTITY x "unsafe">]><gesmes:Envelope ',
      ),
    ],
    [
      'external entity',
      body.replace(
        '<gesmes:Envelope ',
        '<!DOCTYPE x SYSTEM "https://invalid.example/secret"><gesmes:Envelope ',
      ),
    ],
    ['named entity', body.replace('Reference rates', 'Reference &amp; rates')],
    ['numeric entity', body.replace('rate="3.0000"', 'rate="&#51;.0000"')],
    ['CDATA', body.replace('Reference rates', '<![CDATA[Reference rates]]>')],
    ['comment', body.replace('<Cube>', '<!-- not accepted --><Cube>')],
    [
      'nested processing instruction',
      body.replace('<Cube>', '<?task x="unsafe"?><Cube>'),
    ],
    ['trailing processing instruction', `${body}<?task x="unsafe"?>`],
    [
      'repeated declaration',
      body.replace('<Cube>', '<?xml version="1.0"?><Cube>'),
    ],
    ['unsupported encoding', body.replace('UTF-8', 'UTF-16')],
    [
      'unknown declaration attribute',
      body.replace('version="1.0"', 'version="1.0" other="x"'),
    ],
    [
      'duplicate declaration attribute',
      body.replace('version="1.0"', 'version="1.0" version="1.0"'),
    ],
    ['broken close', body.replace('</gesmes:Sender>', '</gesmes:subject>')],
    ['missing close', body.replace('</gesmes:Envelope>', '')],
    ['duplicate root', `${body}${body.replace(/<\?xml[^?]*\?>/, '')}`],
    ['unquoted attribute', body.replace('rate="3.0000"', 'rate=3.0000')],
    [
      'invalid XML control',
      body.replace(
        'Reference rates',
        `Reference ${String.fromCharCode(0)}rates`,
      ),
    ],
    [
      'unpaired surrogate',
      body.replace(
        'Reference rates',
        `Reference ${String.fromCharCode(0xd800)}rates`,
      ),
    ],
  ])
    assert.throws(() => parseEcbFx(rejected), label);
});

test('each date requires unique valid currencies and both sides; unrelated malformed currencies fail the whole capture', async () => {
  const body = (await fixture()).xml;
  for (const [label, rejected] of [
    [
      'duplicate selected currency',
      xml(
        day('2026-08-03', currency('USD') + currency('INR') + currency('USD')),
      ),
    ],
    [
      'duplicate unselected currency',
      xml(
        day(
          '2026-08-03',
          currency('USD') + currency('INR') + currency('JPY') + currency('JPY'),
        ),
      ),
    ],
    ['missing INR', xml(day('2026-08-03', currency('USD') + currency('JPY')))],
    ['missing USD', xml(day('2026-08-03', currency('INR') + currency('JPY')))],
    [
      'mismatched dates',
      xml(
        day('2026-08-03', currency('USD') + currency('JPY')) +
          day('2026-08-04', currency('INR') + currency('JPY')),
      ),
    ],
    ['duplicate date', xml(day('2026-08-03') + day('2026-08-03'))],
    ['invalid calendar date', xml(day('2025-02-29'))],
    ['before accepted source range', xml(day('1999-01-03'))],
    ['lowercase currency', body.replace('currency="JPY"', 'currency="jpy"')],
    ['long currency', body.replace('currency="JPY"', 'currency="JPYY"')],
    [
      'whitespace-normalized currency',
      body.replace('currency="JPY"', 'currency=" JPY"'),
    ],
    [
      'whitespace-normalized date',
      body.replace('time="2026-08-03"', 'time="2026-08-03 "'),
    ],
    [
      'whitespace-normalized rate',
      body.replace('rate="3.0000"', 'rate=" 3.0000"'),
    ],
    [
      'duplicate raw attribute',
      body.replace('rate="3.0000"', 'rate="3.0000" rate="3.0000"'),
    ],
    [
      'unknown decimal on other currency',
      body.replace('rate="5.125"', 'rate="1e3"'),
    ],
    ['zero on other currency', body.replace('rate="5.125"', 'rate="0.0000"')],
    [
      'unexpected attribute location',
      body.replace('<Cube>', '<Cube time="2026-08-03">'),
    ],
    ['empty capture', xml('')],
  ])
    assert.throws(() => parseEcbFx(rejected), label);
});

test('FX parser bounds bytes, XML tags, depth, dates and all currencies before exposing a capture', () => {
  assert.throws(() => parseEcbFx(''), /UTF-8 byte bound/);
  assert.throws(() => parseEcbFx(' '.repeat(1000001)), /UTF-8 byte bound/);
  assert.throws(
    () => parseEcbFx(`<?xml?>${'é'.repeat(500000)}`),
    /UTF-8 byte bound/,
  );
  assert.throws(
    () => parseEcbFx(xml('<Cube/>'.repeat(20001))),
    /XML tag bound/,
  );
  assert.throws(
    () => parseEcbFx(xml('<Cube>'.repeat(33) + '</Cube>'.repeat(33))),
    /nesting/,
  );
  const days = Array.from({ length: 93 }, (_, index) =>
    day(new Date(Date.UTC(2020, 0, 1 + index)).toISOString().slice(0, 10)),
  );
  assert.equal(
    parseEcbFx(xml(days.slice(0, 92).join(''))).observations.length,
    92,
  );
  assert.throws(() => parseEcbFx(xml(days.join(''))));
  const otherCurrencies = Array.from({ length: 59 }, (_, index) =>
    currency(
      `A${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`,
    ),
  );
  const required = currency('USD', '2.0000') + currency('INR', '5.00000000');
  assert.equal(
    parseEcbFx(
      xml(day('2026-08-03', required + otherCurrencies.slice(0, 58).join(''))),
    ).observations.length,
    1,
  );
  assert.throws(() =>
    parseEcbFx(xml(day('2026-08-03', required + otherCurrencies.join('')))),
  );
});

test('source windows admit a real leap day and exactly 100 days without filling absent dates', () => {
  assert.equal(
    parseEcbFx(xml(day('2020-02-29'))).observations[0].date,
    '2020-02-29',
  );
  const parsed = parseEcbFx(xml(day('2020-04-10') + day('2020-01-01')));
  assert.deepEqual(
    parsed.observations.map((row) => row.date),
    ['2020-01-01', '2020-04-10'],
  );
  assert.throws(() => parseEcbFx(xml(day('2020-04-11') + day('2020-01-01'))));
});

test('immutable edition admission uses Berlin retrieval day, rejects future dates and malformed timestamps without inventing known-at', async () => {
  const observations = parseEcbFx((await fixture()).xml).observations;
  const value = edition(observations, {
    retrievedAt: '2026-08-02T22:30:00.000Z',
  });
  assert.equal(ecbFxEvaluationDay(new Date(value.retrievedAt)), '2026-08-03');
  assert.equal(value.knownAt, null);
  assert.equal(value.vintageBasis, 'retrieval-revision-only');
  assert.equal(
    EcbFxEditionSchema.safeParse({
      ...value,
      retrievedAt: '2026-08-02T21:30:00.000Z',
    }).success,
    false,
  );
  assert.doesNotThrow(() =>
    assert.equal(
      EcbFxEditionSchema.safeParse({ ...value, retrievedAt: 'not-a-date' })
        .success,
      false,
    ),
  );
  assert.equal(
    EcbFxEditionSchema.safeParse({ ...value, knownAt: value.retrievedAt })
      .success,
    false,
  );
  assert.equal(
    EcbFxEditionSchema.safeParse({ ...value, windowStart: '2026-07-30' })
      .success,
    false,
  );
  assert.equal(
    EcbFxEditionSchema.safeParse({ ...value, windowEnd: '2026-08-04' }).success,
    false,
  );
  assert.equal(ecbFxLatest(value, '2026-07-30'), null);
  assert.equal(ecbFxLatest(value, '2026-08-02').date, '2026-07-31');
  assert.equal(ecbFxLatest(value, '2026-08-03').date, '2026-08-03');
});

test('changed source strings, added days and aged-out days have distinct immutable window receipts', async () => {
  const observations = parseEcbFx((await fixture()).xml).observations,
    before = edition(observations);
  const original = structuredClone(before);
  const changed = { ...observations[1], usdPerEur: '3.0' };
  const added = { ...observations[0], date: '2026-08-04' };
  const current = [changed, added],
    comparison = compareEcbFx(before, current);
  assert.deepEqual(comparison, {
    previousEdition: 1,
    addedDates: ['2026-08-04'],
    changedDates: ['2026-08-03'],
    absentDates: ['2026-07-31'],
  });
  const next = edition(current, {
    edition: 2,
    sourceHash: 'b'.repeat(64),
    comparison,
  });
  assert.deepEqual(
    next.observations.map((row) => row.date),
    ['2026-08-03', '2026-08-04'],
  );
  assert.deepEqual(
    next.observations[0].derivedInrPerUsd,
    observations[1].derivedInrPerUsd,
  );
  assert.deepEqual(before, original);
  assert.deepEqual(compareEcbFx(before, observations), {
    previousEdition: 1,
    addedDates: [],
    changedDates: [],
    absentDates: [],
  });
  assert.equal(
    EcbFxEditionSchema.safeParse({
      ...next,
      comparison: { ...comparison, previousEdition: 2 },
    }).success,
    false,
  );
  assert.equal(
    EcbFxEditionSchema.safeParse({
      ...next,
      comparison: { ...comparison, absentDates: ['2026-08-03'] },
    }).success,
    false,
  );
  assert.equal(
    EcbFxEditionSchema.safeParse({
      ...before,
      comparison: { ...before.comparison, addedDates: [] },
    }).success,
    false,
  );
});

test('withdrawn public FX projections reject every retained numerical edition', async () => {
  const value = edition(parseEcbFx((await fixture()).xml).observations);
  const withdrawn = {
    status: 'withdrawn',
    edition: null,
    checkedAt: value.retrievedAt,
    reviewedAt: value.retrievedAt,
    evaluatedAt: value.retrievedAt,
    evaluatedOn: '2026-09-14',
    timeZone: 'Europe/Berlin',
  };
  assert.equal(EcbFxPublicSchema.safeParse(withdrawn).success, true);
  assert.equal(
    EcbFxPublicSchema.safeParse({ ...withdrawn, edition: value }).success,
    false,
  );
  assert.equal(
    EcbFxPublicSchema.safeParse({
      ...withdrawn,
      status: 'never-published',
      edition: value,
    }).success,
    false,
  );
  assert.equal(
    EcbFxPublicSchema.safeParse({
      ...withdrawn,
      status: 'published',
      edition: value,
    }).success,
    true,
  );
  assert.equal(EcbFxEditionSchema.safeParse(value).success, true);
});
