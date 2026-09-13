import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceMedia } from '../dist/media.js';
const item = {
  id: 'synthetic-media-fixture',
  version: 2,
  kind: 'news',
  title: 'Synthetic <script>alert(1)</script> fixture',
  summary: 'Synthetic text only; no invented numerical claims.',
  body: 'Synthetic body',
  topics: [],
  publishedAt: '2026-01-01T00:00:00.000Z',
  effectiveLabel: 'Synthetic test',
  source: {
    name: 'Test fixture',
    url: 'https://example.com/fixture',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    rights: 'Test only',
  },
  sourceHash: null,
  importance: 1,
  relatedIds: [],
  status: 'published',
  correctionNote: null,
  reviewedAt: '2026-01-01T00:00:00.000Z',
};
test('source media binds immutable edition and escapes all XML text', () => {
  const asset = buildSourceMedia(item);
  assert.equal(asset.itemVersion, 2);
  assert.deepEqual(asset.sourceIds, [item.id]);
  assert.ok(!asset.svg.includes('<script>'));
  assert.ok(asset.svg.includes('&lt;script&gt;'));
  assert.equal(asset.captions[0].text, item.title);
  assert.ok(asset.captions.some((c) => c.text === item.summary));
  assert.equal(asset.status, 'draft');
  assert.equal(asset.durationMs, asset.captions.at(-1).endMs);
});
test('long source tokens produce bounded captions and SVG title fitting', () => {
  const asset = buildSourceMedia({
    ...item,
    title: 'W'.repeat(500),
    summary: 'X'.repeat(3000),
    source: { ...item.source, name: 'Provider '.repeat(20) },
  });
  assert.ok(asset.captions.every((c) => c.text.length <= 1000));
  assert.match(asset.svg, /lengthAdjust="spacingAndGlyphs"/);
  assert.ok(asset.svg.length < 100000);
  assert.equal(
    asset.captions
      .slice(0, 5)
      .map((c) => c.text)
      .join(''),
    'W'.repeat(500),
  );
  assert.ok(asset.captions.every((c) => c.text.length <= 101));
});

test('provider-selected captions must be exact excerpts bound to source edition', async () => {
  const { selectMediaCaptions } = await import('../dist/media.js');
  assert.deepEqual(
    selectMediaCaptions(
      JSON.stringify({
        sourceId: item.id,
        sourceVersion: item.version,
        captions: [item.summary],
      }),
      item,
    ),
    [item.summary],
  );
  assert.throws(() =>
    selectMediaCaptions(
      JSON.stringify({
        sourceId: 'another-source',
        sourceVersion: item.version,
        captions: [item.summary],
      }),
      item,
    ),
  );
  assert.throws(() =>
    selectMediaCaptions(
      JSON.stringify({
        sourceId: item.id,
        sourceVersion: item.version + 1,
        captions: [item.summary],
      }),
      item,
    ),
  );
  assert.throws(() =>
    selectMediaCaptions(
      JSON.stringify({
        sourceId: item.id,
        sourceVersion: item.version,
        captions: ['Invented guaranteed annual returns.'],
      }),
      item,
    ),
  );
  const built = buildSourceMedia(item, undefined, undefined, [item.summary]);
  assert.equal(built.generation.provider, 'template');
  assert.equal(built.generation.model, null);
});

test('durable prepare reservation prevents a second charged call and reuses immutable asset', async () => {
  const { MediaStore } = await import('../dist/media.js');
  let attempts = [];
  let asset = null;
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const client = {
    release() {},
    query: async (sql, params) => {
      if (sql.includes('pg_try_advisory')) return { rows: [{ locked: true }] };
      if (sql.includes('FROM discovery_versions'))
        return { rows: [{ data: item }] };
      if (sql.startsWith('SELECT id FROM discovery_media'))
        return {
          rowCount: asset ? 1 : 0,
          rows: asset ? [{ id: asset.id }] : [],
        };
      if (sql.startsWith('SELECT started_at')) return { rows: attempts };
      if (sql.startsWith('INSERT INTO discovery_media_attempts')) {
        attempts = [{ started_at: new Date() }];
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO discovery_media(')) {
        asset = JSON.parse(params[3]);
        return { rows: [] };
      }
      if (sql.startsWith('SELECT m.data'))
        return { rows: asset ? [{ data: asset, published: false }] : [] };
      return { rows: [] };
    },
  };
  const store = new MediaStore({
    DATABASE_URL: 'postgres://unused',
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'synthetic-key',
    OPENAI_MODEL: 'synthetic-model',
  });
  const originalPool = store.pool;
  store.pool = { connect: async () => client, end: async () => {} };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls++;
    await gate;
    return new Response(
      JSON.stringify({
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  sourceId: item.id,
                  sourceVersion: item.version,
                  captions: [item.summary],
                }),
              },
            ],
          },
        ],
      }),
    );
  };
  try {
    const first = store.generate(item.id);
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(
      store.generate(item.id),
      (error) => error.getStatus() === 409,
    );
    assert.equal(calls, 1);
    release();
    const result = await first;
    assert.equal(result.generation.provider, 'openai');
    assert.equal(result.generation.model, 'synthetic-model');
    assert.equal((await store.generate(item.id)).id, result.id);
    assert.equal(calls, 1);
  } finally {
    release();
    globalThis.fetch = originalFetch;
    await originalPool.end();
  }
});

test('media selectors preserve entire source blocks including negation', async () => {
  const { selectMediaCaptions, mediaSourceBlocks } =
    await import('../dist/media.js');
  const qualified = {
    ...item,
    summary: 'These are not guaranteed returns. Outcomes remain uncertain.',
  };
  for (const text of ['guaranteed returns', 'Outcomes remain uncertain.']) {
    assert.throws(() =>
      selectMediaCaptions(
        JSON.stringify({
          sourceId: item.id,
          sourceVersion: item.version,
          captions: [text],
        }),
        qualified,
      ),
    );
  }
  assert.deepEqual(
    selectMediaCaptions(
      JSON.stringify({
        sourceId: item.id,
        sourceVersion: item.version,
        captions: [qualified.summary],
      }),
      qualified,
    ),
    [qualified.summary],
  );
  const long = { ...qualified, body: 'Long qualifying context '.repeat(40) };
  assert.equal(
    mediaSourceBlocks(long).includes(long.body.slice(0, 240)),
    false,
  );
  assert.equal(mediaSourceBlocks(long).includes(long.body), false);
});
