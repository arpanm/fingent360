import test from 'node:test';
import assert from 'node:assert/strict';
import { OIL_BENCHMARK_URL } from '@fingent360/contracts';
import {
  fetchOilBenchmarks,
  oilReceiptHash,
} from '../dist/oil-benchmark-provider.js';
const mime =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function response(body, init = {}) {
  const value = new Response(body, {
    status: 200,
    headers: { 'Content-Type': mime },
    ...init,
  });
  Object.defineProperty(value, 'url', { value: OIL_BENCHMARK_URL });
  return value;
}
test('oil transport fixes origin, rejects redirects and binds exact binary bytes plus retrieval context', async () => {
  const original = globalThis.fetch,
    bytes = new Uint8Array([80, 75, 3, 4, 0, 255, 128]);
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, OIL_BENCHMARK_URL);
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Accept, mime);
      assert.equal(options.headers.Authorization, undefined);
      return response(bytes);
    };
    const raw = await fetchOilBenchmarks();
    assert.deepEqual(Buffer.from(raw.body, 'base64'), Buffer.from(bytes));
    assert.equal(raw.hash, oilReceiptHash(raw));
    assert.notEqual(
      raw.hash,
      oilReceiptHash({ ...raw, retrievedAt: '2001-01-01T00:00:00.000Z' }),
    );
    assert.throws(() => oilReceiptHash({ ...raw, body: raw.body + '!' }));
  } finally {
    globalThis.fetch = original;
  }
});
test('oil transport rejects foreign URLs, HTML, incomplete/oversized/errored streams without partial receipt', async () => {
  const original = globalThis.fetch;
  try {
    for (const result of [
      new Response('synthetic', { headers: { 'Content-Type': mime } }),
      response('<html/>', { headers: { 'Content-Type': 'text/html' } }),
      response('synthetic', {
        headers: { 'Content-Type': mime, 'Content-Length': '999' },
      }),
      response(new Uint8Array(3000001)),
      response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([80, 75]));
            controller.error(Error('Synthetic incomplete stream'));
          },
        }),
      ),
    ]) {
      globalThis.fetch = async () => result;
      await assert.rejects(fetchOilBenchmarks());
    }
  } finally {
    globalThis.fetch = original;
  }
});
