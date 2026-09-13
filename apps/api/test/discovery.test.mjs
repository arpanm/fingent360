import { discoveryFingerprint } from '../dist/discovery.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFedRss,
  glossaryItems,
  FED_FEED,
  sourceHash,
} from '../dist/discovery-provider.js';
const fixture = `<rss version="2.0"><channel><item><title>Synthetic fixture &amp; policy</title><link>https://www.federalreserve.gov/newsevents/pressreleases/monetary20260101a.htm</link><description><![CDATA[<p>Synthetic test summary only.</p>]]></description><pubDate>Thu, 01 Jan 2026 14:00:00 GMT</pubDate></item></channel></rss>`;
test('RSS bounded adapter preserves attribution and stable identity without HTML', () => {
  const [item] = parseFedRss(fixture, '2026-01-02T00:00:00.000Z');
  assert.equal(item.title, 'Synthetic fixture & policy');
  assert.equal(item.body, 'Synthetic test summary only.');
  assert.equal(item.status, 'draft');
  assert.equal(item.sourceHash, sourceHash(FED_FEED, fixture));
  assert.equal(parseFedRss(fixture, '2026-01-03T00:00:00.000Z')[0].id, item.id);
});
test('RSS rejects entities, arbitrary links, duplicate required fields and oversize input', () => {
  for (const body of [
    fixture.replace(
      '<rss',
      '<!DOCTYPE rss [<!ENTITY bad SYSTEM "file:///etc/passwd">]><rss',
    ),
    fixture.replace(
      'www.federalreserve.gov/newsevents',
      'evil.example/newsevents',
    ),
    fixture.replace('</item>', '<title>Duplicate</title></item>'),
    'x'.repeat(1000001),
  ])
    assert.throws(() => parseFedRss(body, '2026-01-02T00:00:00.000Z'));
});
test('authored glossary is labelled educational, not fabricated news', () => {
  const items = glossaryItems('2026-09-13T00:00:00.000Z');
  assert.equal(items.length, 3);
  for (const item of items) {
    assert.equal(item.kind, 'term');
    assert.equal(item.sourceHash, null);
    assert.match(item.source.rights, /Original educational/);
    assert.match(item.source.url, /^https:\/\//);
  }
});
test('RSS plain text strips encoded markup and rejects truncated containers', () => {
  const encoded = fixture.replace(
    'Synthetic test summary only.',
    '&lt;strong&gt;Synthetic&lt;/strong&gt; &#60;img src=x onerror=alert(1)&#62;',
  );
  const [item] = parseFedRss(encoded, '2026-01-02T00:00:00.000Z');
  assert.equal(item.body, 'Synthetic');
  assert.deepEqual(item.topics, ['Federal Reserve releases']);
  assert.deepEqual(item.relatedIds, []);
  for (const broken of [
    fixture.replace('</rss>', ''),
    fixture.replace('</item>', ''),
    fixture.replace('</channel>', ''),
  ])
    assert.throws(() => parseFedRss(broken, '2026-01-02T00:00:00.000Z'));
});

test('metadata corrections create a new fingerprint but retrieval-only changes do not', () => {
  const item = glossaryItems('2026-09-13T00:00:00.000Z')[0];
  const original = discoveryFingerprint(item);
  for (const changed of [
    {
      ...item,
      source: { ...item.source, rights: 'Corrected rights restriction' },
    },
    { ...item, source: { ...item.source, name: 'Corrected attribution' } },
    { ...item, topics: ['Corrected topic'] },
    { ...item, relatedIds: ['term-gdp'] },
    { ...item, importance: 3 },
  ])
    assert.notEqual(discoveryFingerprint(changed), original);
  assert.equal(
    discoveryFingerprint({
      ...item,
      source: { ...item.source, retrievedAt: '2026-09-14T00:00:00.000Z' },
      sourceHash: 'a'.repeat(64),
    }),
    original,
  );
});
