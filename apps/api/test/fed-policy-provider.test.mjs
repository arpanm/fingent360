import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  parseHistoricalFedPolicy,
  FED_POLICY_HISTORY_URLS,
} from '../dist/fed-policy-provider.js';
import { sourceHash } from '../dist/discovery-provider.js';
test('historical official FOMC documents retain raw identities and explicit historical draft metadata', () => {
  const pack = JSON.parse(
    readFileSync(
      new URL(
        '../../../packages/contracts/test/fixtures/fomc-2024-policy-pack.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  for (const [index, day] of ['20240731', '20240918'].entries()) {
    const body = readFileSync(
      new URL(
        `../../../packages/contracts/test/fixtures/fomc-${day}.html.txt`,
        import.meta.url,
      ),
      'utf8',
    );
    assert.equal(
      createHash('sha256').update(body).digest('hex'),
      pack.sources[index].rawHash,
    );
    const url = FED_POLICY_HISTORY_URLS[index],
      raw = {
        url,
        body,
        hash: sourceHash(url, body),
        retrievedAt: new Date(pack.sources[index].retrievedAt).toISOString(),
      };
    const item = parseHistoricalFedPolicy(raw);
    assert.equal(item.body, pack.sources[index].quote);
    assert.equal(item.status, 'draft');
    assert.match(item.effectiveLabel, /not a current rate/);
    assert.throws(
      () =>
        parseHistoricalFedPolicy({
          ...raw,
          url: 'https://untrusted.example/release',
        }),
      /Unsupported/,
    );
    assert.throws(
      () => parseHistoricalFedPolicy({ ...raw, hash: 'a'.repeat(64) }),
      /inconsistent/,
    );
  }
});
