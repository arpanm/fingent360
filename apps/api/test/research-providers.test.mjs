import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parsePibIndex,
  parsePibRelease,
  parseExtraAnnual,
  extraAnnualIndicators,
  researchSources,
} from '../dist/research-providers.js';
import { parseOfficialRss, sourceHash } from '../dist/discovery-provider.js';
const fixture = (name) =>
  readFileSync(new URL(`./fixtures/research/${name}`, import.meta.url), 'utf8');
const raw = (file, url) => {
  const body = fixture(file);
  return {
    body,
    url,
    retrievedAt: '2026-09-14T00:00:00.000Z',
    hash: sourceHash(url, body),
  };
};
test('real PIB index restricts ministry links and release preserves actual timestamp/provenance', () => {
  assert.ok(parsePibIndex(fixture('pib-index.html')).includes('2309663'));
  const input = raw(
    'pib-release.html',
    'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2309663&lang=1&reg=3',
  );
  const item = parsePibRelease(input);
  assert.equal(item.id, 'pib-2309663');
  assert.match(item.title, /Freight/);
  assert.equal(item.publishedAt, '2026-09-13T06:36:00.000Z');
  assert.equal(item.sourceHash, input.hash);
  assert.equal(item.status, 'draft');
  assert.doesNotMatch(item.body, /<script|<p>/i);
  assert.deepEqual(
    parsePibIndex(
      "<h3>Ministry of Finance</h3><a href='https://evil.example/?PRID=12345'>bad</a>",
    ),
    [],
  );
  assert.throws(() =>
    parsePibRelease({ ...input, body: '<h2>Missing timestamp</h2>' }),
  );
});
test('real World Bank annual observations retain units and reject swapped countries', () => {
  const input = raw(
    'wb-unemployment.json',
    'https://api.worldbank.org/v2/country/IND/indicator/SL.UEM.TOTL.ZS?format=json&per_page=100',
  );
  const items = parseExtraAnnual(input, extraAnnualIndicators[0]);
  assert.ok(items.length);
  assert.equal(items[0].source.name, 'World Bank');
  assert.match(items[0].body, /modeled ILO estimate/);
  assert.equal(items[0].sourceHash, input.hash);
  assert.throws(() =>
    parseExtraAnnual(
      { ...input, body: input.body.replaceAll('"IND"', '"USA"') },
      extraAnnualIndicators[0],
    ),
  );
});
test('ECB headline-only RSS remains exact text and rejects external links', () => {
  const source = researchSources.find((s) => s.id === 'ecb-press');
  const xml =
    '<rss><channel><item><title>Synthetic official headline</title><link>https://www.ecb.europa.eu//press/pr/date/2026/example.html</link><pubDate>Sat, 12 Sep 2026 12:00:00 GMT</pubDate></item></channel></rss>';
  const provider = {
    id: source.id,
    name: source.name,
    url: source.feedUrl,
    rights: source.rights,
    host: 'www.ecb.europa.eu',
    path: '/press/pr/',
    topics: source.topics,
  };
  const [item] = parseOfficialRss(xml, '2026-09-13T00:00:00.000Z', provider);
  assert.equal(item.summary, item.title);
  assert.throws(() =>
    parseOfficialRss(
      xml.replace('www.ecb.europa.eu', 'evil.example'),
      '2026-09-13T00:00:00.000Z',
      provider,
    ),
  );
});

test('PIB paragraph excerpts exclude social embeds, decode entities and end at complete sentences', () => {
  const input = raw(
    'pib-social.html',
    'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2309650&lang=1&reg=3',
  );
  const item = parsePibRelease(input);
  assert.doesNotMatch(
    item.summary,
    /&rsquo;|&mdash;|https:\/\/t.co|@Ashwini|twitter/,
  );
  assert.match(item.summary, /[.!?]$/);
  assert.ok(item.summary.length <= 1000);
  assert.match(item.summary, /Hon’ble/);
});

test('ECB statistics accepts its official stats path instead of press-release path', () => {
  const source = researchSources.find((s) => s.id === 'ecb-statistics');
  const xml =
    '<rss><channel><item><title>Euro area bank interest rate statistics: July 2026</title><link>https://www.ecb.europa.eu//press/stats/mfi/html/ecb.mir260902~d54675e442.en.html</link><pubDate>Wed, 02 Sep 2026 10:00:00 +0200</pubDate></item></channel></rss>';
  const [item] = parseOfficialRss(xml, '2026-09-13T12:00:00.000Z', {
    id: source.id,
    name: source.name,
    url: source.feedUrl,
    rights: source.rights,
    host: 'www.ecb.europa.eu',
    path: '/press/stats/',
    topics: source.topics,
  });
  assert.equal(item.publishedAt, '2026-09-02T08:00:00.000Z');
  assert.equal(item.summary, item.title);
});

test('extra annual values preserve original decimal lexemes and reject identity/schema/pagination changes', () => {
  const input = raw(
    'wb-unemployment.json',
    'https://api.worldbank.org/v2/country/IND/indicator/SL.UEM.TOTL.ZS?format=json&per_page=100',
  );
  const source = JSON.parse(input.body);
  source[1] = [source[1][0]];
  source[0].total = 1;
  const decimal = '4.219123456789123456';
  const encoded = JSON.stringify(source).replace(
    /"value":4\.219\b/,
    `"value":${decimal}`,
  );
  const [precise] = parseExtraAnnual(
    { ...input, body: encoded },
    extraAnnualIndicators[0],
  );
  assert.ok(precise.summary.includes(decimal));
  assert.match(precise.body, /Dataset updated 2026-07-13/);
  for (const mutate of [
    (s) => {
      s[1][0].unit = 'USD';
    },
    (s) => {
      s[0].pages = 2;
    },
    (s) => {
      s[1].push({ ...s[1][0] });
      s[0].total = 2;
    },
    (s) => {
      s[1][0].unexpected = true;
    },
    (s) => {
      s[0].unknown = true;
    },
    (s) => {
      s[1][0].country.id = 'US';
    },
    (s) => {
      s[1][0].obs_status = 'F';
    },
    (s) => {
      s[1][0].date = '2027';
    },
    (s) => {
      s[0].sourceid = '3';
    },
  ]) {
    const changed = structuredClone(source);
    mutate(changed);
    assert.throws(() =>
      parseExtraAnnual(
        { ...input, body: JSON.stringify(changed) },
        extraAnnualIndicators[0],
      ),
    );
  }
  const unavailable = structuredClone(source);
  unavailable[1][0].value = null;
  const [missing] = parseExtraAnnual(
    { ...input, body: JSON.stringify(unavailable) },
    extraAnnualIndicators[0],
  );
  assert.equal(
    missing.summary,
    `Reported ${unavailable[1][0].date} annual value: Unavailable.`,
  );
  assert.doesNotMatch(missing.body, /Unavailable %/);
});

test(
  'malformed official response is retained before parser rejection and storage failure stops promotion',
  { concurrency: false },
  async () => {
    const { fetchResearchSource } =
      await import('../dist/research-providers.js');
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response('<rss><channel>malformed source', { status: 200 });
      for (const id of ['fed', 'ecb-press', 'world-bank']) {
        const retained = [];
        await assert.rejects(() =>
          fetchResearchSource(id, async (raw) => {
            retained.push(raw);
          }),
        );
        assert.equal(retained.length, 1);
        assert.equal(retained[0].body, '<rss><channel>malformed source');
        assert.equal(
          retained[0].hash,
          sourceHash(retained[0].url, retained[0].body),
        );
      }
      await assert.rejects(
        () =>
          fetchResearchSource('fed', async () => {
            throw Error('Synthetic storage failure');
          }),
        /Synthetic storage failure/,
      );
    } finally {
      globalThis.fetch = original;
    }
  },
);
