import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEquitySource, EquityDatasetSchema } from '../dist/index.js';
const fixture = async () =>
  JSON.parse(
    await readFile(
      new URL('./fixtures/equity-coverage.json', import.meta.url),
      'utf8',
    ),
  );
test('equity coverage synthetic golden preserves decimal scales, large volume and five families', async () => {
  const data = await fixture();
  const parsed = parseEquitySource(
    'f360-equity-evidence-v1',
    JSON.stringify(data),
    '2025-01-31',
  );
  assert.deepEqual(parsed, data);
  assert.equal(parsed.observations[1].volume, '9007199254740993');
});
test('equity coverage rejects duplicated observations, unknown fields and future financial periods', async () => {
  const data = await fixture();
  assert.equal(
    EquityDatasetSchema.safeParse({
      ...data,
      observations: [...data.observations, data.observations[0]],
    }).success,
    false,
  );
  assert.equal(
    EquityDatasetSchema.safeParse({ ...data, untrustedInstruction: 'run tool' })
      .success,
    false,
  );
  data.observations[3].periodEnd = '2026-01-01';
  assert.equal(EquityDatasetSchema.safeParse(data).success, false);
});
test('official NSE master shape maps synthetic row and rejects changed header', () => {
  const csv =
    'SYMBOL,NAME OF COMPANY,SERIES,DATE OF LISTING,PAID UP VALUE,MARKET LOT,ISIN NUMBER,FACE VALUE\nSYNTHETIC,"Synthetic, Company",EQ,01-JAN-2000,10,1,INE002A01018,10';
  const value = parseEquitySource('nse-equity-master-v1', csv, '2025-01-31');
  assert.equal(value.observations[0].name, 'Synthetic, Company');
  assert.equal(value.observations[0].listedOn, '2000-01-01');
  assert.throws(() =>
    parseEquitySource(
      'nse-equity-master-v1',
      csv.replace('FACE VALUE', 'CHANGED'),
      '2025-01-31',
    ),
  );
});
test('Nifty synthetic constituent has no invented weight or past membership', () => {
  const value = parseEquitySource(
    'nifty50-constituents-v1',
    'Company Name,Industry,Symbol,Series,ISIN Code\nSynthetic,Software,SYNTHETIC,EQ,INE002A01018',
    '2025-01-31',
  );
  assert.equal(value.observations[0].weightPercent, null);
  assert.equal(value.observations[0].effectiveOn, '2025-01-31');
});

test('official UDiFF schema-attributed synthetic fixture preserves six-place prices and large exact counts', async () => {
  const body = await readFile(
    new URL('./fixtures/equity-udiff.csv', import.meta.url),
    'utf8',
  );
  const parse = (
    csv = body,
    date = '2025-01-31',
    name = 'BhavCopy_NSE_CM_0_0_0_20250131_F_0000.csv',
  ) => parseEquitySource('nse-udiff-cm-v20260630', csv, date, name);
  const result = parse();
  assert.equal(result.observations[0].close, '123.450000');
  assert.equal(result.observations[0].volume, '9007199254740993');
  assert.equal(result.observations[0].udiff.high, '124.000000');
  assert.equal(result.coverage.acceptedRows, 1);
  assert.throws(() => parse(body, '2025-02-01'));
  assert.throws(() => parse(body, '2025-01-31', 'incorrect.csv'));
  assert.throws(() => parse(body.replace('TradDt', 'Changed')));
  assert.throws(() => parse(body.replace('124.000000', '120.000000')));
  assert.throws(() => parse(body + body.split('\n')[1] + '\n'));
  const excluded = body.split('\n')[1].replace(',EQ,', ',BE,');
  const mixed = parse(body + excluded + '\n');
  assert.equal(mixed.coverage.excludedRows, 1);
});

test('NSE action source uses exact identity, dates and retained edition; ambiguous joins fail closed', async () => {
  const body = await readFile(
    new URL('./fixtures/equity-actions.csv', import.meta.url),
    'utf8',
  );
  const identity = {
    isin: 'INE002A01018',
    symbol: 'SYNTHETIC',
    series: 'EQ',
    effectiveOn: '2025-01-31',
    editionId: '10000000-0000-4000-8000-000000000001',
    hash: 'a'.repeat(64),
  };
  const parse = (value, identities = [identity]) =>
    parseEquitySource(
      'nse-corporate-actions-csv-v1',
      value,
      '2025-01-31',
      undefined,
      identities,
    );
  const [row] = parse(body).observations;
  assert.equal(row.effectiveOn, '2025-01-31');
  assert.equal(row.nseAction.exOn, '2025-02-03');
  assert.equal(row.nseAction.identityHash, identity.hash);
  assert.equal(row.nseAction.bookClosureStart, null);
  assert.equal(row.adjustment, 'not-applied');
  assert.throws(() => parse(body, []));
  assert.throws(() =>
    parse(body, [identity, { ...identity, isin: 'INE009A01021' }]),
  );
  assert.throws(() => parse(body.replace('03-Feb-2025', '31-Feb-2025')));
  assert.throws(() => parse(body.replace('FACE VALUE', 'UNRECOGNIZED')));
});

test('NSE historical actions bind identity at ex-date, never a later reused symbol', async () => {
  const body = (
    await readFile(
      new URL('./fixtures/equity-actions.csv', import.meta.url),
      'utf8',
    )
  ).replace('03-Feb-2025', '15-Jan-2025');
  const recent = {
    isin: 'INE002A01018',
    symbol: 'SYNTHETIC',
    series: 'EQ',
    effectiveOn: '2025-01-31',
    editionId: '10000000-0000-4000-8000-000000000001',
    hash: 'a'.repeat(64),
  };
  const historical = {
    ...recent,
    isin: 'INE009A01021',
    effectiveOn: '2024-12-01',
    editionId: '10000000-0000-4000-8000-000000000002',
  };
  const parse = (identities) =>
    parseEquitySource(
      'nse-corporate-actions-csv-v1',
      body,
      '2025-01-31',
      undefined,
      identities,
    );
  assert.throws(() => parse([recent]));
  assert.equal(
    parse([recent, historical]).observations[0].isin,
    historical.isin,
  );
});

test('official rendered Ind AS layout preserves both periods, scale and loss, rejecting ambiguous metadata', async () => {
  const body = await readFile(
    new URL('./fixtures/equity-indas.html', import.meta.url),
    'utf8',
  );
  const parse = (value) =>
    parseEquitySource('nse-integrated-indas-html-v1', value, '2025-04-30');
  const { observations } = parse(body);
  assert.equal(observations.length, 4);
  assert.equal(observations[0].value, '1234.5600');
  assert.equal(observations[1].value, '-12.3400');
  assert.equal(observations[2].periodStart, '2024-04-01');
  assert.equal(observations[0].scale, 'lakhs');
  for (const invalid of [
    body.replace('INR', 'USD'),
    body.replace('Lakhs', 'Unspecified'),
    body.replace('Audited', 'Unknown'),
    body.replace('1,234.5600', '1,23.4'),
    body.replace('31-03-2025', '31-03-2027'),
    body.replace('</body>', '<script>unsafe()</script></body>'),
  ])
    assert.throws(() => parse(invalid));
});
