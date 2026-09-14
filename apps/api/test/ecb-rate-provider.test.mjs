import test from 'node:test';
import assert from 'node:assert/strict';
import { ECB_RATE_URL } from '@fingent360/contracts';
import { fetchEcbRates, ecbReceiptHash } from '../dist/ecb-rate-provider.js';
// Transport faults only. No request in this file reaches the live provider.
function response(body, init = {}) {
  const value = new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.sdmx.genericdata+xml;version=2.1',
    },
    ...init,
  });
  Object.defineProperty(value, 'url', { value: ECB_RATE_URL });
  return value;
}
test('bounded ECB transport uses fixed HTTPS no redirects and hashes retrieval context plus exact bytes', async () => {
  const original = globalThis.fetch,
    body = '<synthetic-document/>';
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, ECB_RATE_URL);
      assert.equal(options.redirect, 'error');
      assert.equal(
        options.headers.Accept,
        'application/vnd.sdmx.genericdata+xml;version=2.1',
      );
      return response(body);
    };
    const raw = await fetchEcbRates();
    assert.equal(raw.body, body);
    assert.equal(raw.hash, ecbReceiptHash(raw));
    assert.notEqual(
      raw.hash,
      ecbReceiptHash({ ...raw, retrievedAt: '2001-01-01T00:00:00.000Z' }),
    );
  } finally {
    globalThis.fetch = original;
  }
});
test('transport rejects foreign responses, HTML, invalid UTF8, incomplete and oversized bodies', async () => {
  const original = globalThis.fetch;
  const foreign = new Response('<synthetic/>', {
    headers: { 'Content-Type': 'text/xml' },
  });
  try {
    for (const value of [
      foreign,
      response('<html/>', { headers: { 'Content-Type': 'text/html' } }),
      response(new Uint8Array([0xc3, 0x28])),
      response('<synthetic/>', {
        headers: { 'Content-Type': 'text/xml', 'Content-Length': '999' },
      }),
      response('x'.repeat(1000001)),
      response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('<partial>'));
            controller.error(Error('Synthetic truncated stream'));
          },
        }),
      ),
    ]) {
      globalThis.fetch = async () => value;
      await assert.rejects(fetchEcbRates());
    }
  } finally {
    globalThis.fetch = original;
  }
});
