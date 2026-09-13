import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  parseSecurityMapping,
  SecurityRefreshInputSchema,
  SecurityIdentitySchema,
} from '@fingent360/contracts';
import { SecuritiesStore } from '../dist/securities.js';

// Explicitly synthetic provider candidates. These are never application data,
// live mappings, licensed metadata or evidence for a source integration.
const candidate = (patch = {}) => ({
  figi: 'BBG000000001',
  name: 'SYNTHETIC IDENTITY UNIT FIXTURE',
  ticker: 'SYNTHETIC',
  exchCode: 'IN',
  securityType: 'Common Stock',
  marketSector: 'Equity',
  compositeFIGI: null,
  shareClassFIGI: null,
  securityType2: 'Common Stock',
  securityDescription: 'SYNTHETIC ONLY',
  ...patch,
});
const mapping = (...items) => [{ data: items }];

test('synthetic identifier mapping preserves identity fields and resolves exactly one common stock', () => {
  const result = parseSecurityMapping(mapping(candidate()));
  assert.equal(result.resolution, 'matched');
  assert.deepEqual(result.candidates, [
    {
      figi: 'BBG000000001',
      name: 'SYNTHETIC IDENTITY UNIT FIXTURE',
      ticker: 'SYNTHETIC',
      exchCode: 'IN',
      securityType: 'Common Stock',
      marketSector: 'Equity',
      compositeFIGI: null,
      shareClassFIGI: null,
    },
  ]);
});

test('synthetic multiple mappings stay ambiguous and normalize order without choosing a security', () => {
  const a = candidate({ figi: 'BBG000000002', name: 'SYNTHETIC SECOND' });
  const b = candidate();
  const result = parseSecurityMapping(mapping(a, b));
  assert.equal(result.resolution, 'ambiguous');
  assert.deepEqual(
    result.candidates.map((v) => v.figi),
    ['BBG000000001', 'BBG000000002'],
  );
  assert.deepEqual(result, parseSecurityMapping(mapping(b, a)));
});

test('synthetic missing mappings remain unresolved while unknown warnings and errors fail', () => {
  for (const raw of [[{ warning: 'No identifier found.' }], mapping()]) {
    assert.deepEqual(parseSecurityMapping(raw), {
      resolution: 'unresolved',
      candidates: [],
    });
  }
  assert.throws(() =>
    parseSecurityMapping([{ warning: 'Synthetic source maintenance' }]),
  );
  assert.throws(() =>
    parseSecurityMapping([{ error: 'Synthetic upstream error' }]),
  );
});

test('synthetic mappings reject unknown fields changed structure duplicate FIGIs and unbounded batches', () => {
  for (const raw of [
    [{ data: [candidate()], extra: true }],
    mapping(candidate({ extra: true })),
    mapping(candidate(), candidate()),
    [{ data: 'invalid' }],
    [{ data: [candidate()] }, { data: [candidate()] }],
    [],
    mapping(
      ...Array.from({ length: 101 }, (_, i) =>
        candidate({ figi: `BBG${String(i).padStart(9, '0')}` }),
      ),
    ),
  ])
    assert.throws(() => parseSecurityMapping(raw));
});

test('synthetic foreign non-equity and incomplete candidates cannot become India common-stock facts', () => {
  for (const patch of [
    { exchCode: 'US' },
    { marketSector: 'Corp' },
    { securityType: 'ETF' },
    { securityType2: 'Depositary Receipt' },
    { name: null },
    { ticker: null },
    { name: '' },
    { ticker: '' },
    { figi: 'bad' },
    { compositeFIGI: 'bad' },
  ])
    assert.throws(() => parseSecurityMapping(mapping(candidate(patch))));
});

test('identifier refresh rejects invalid checksums duplicate identifiers and caller-controlled provider fields', () => {
  const valid = { requestId: randomUUID(), isins: ['INE002A01018'] };
  assert.deepEqual(SecurityRefreshInputSchema.parse(valid), valid);
  for (const input of [
    { ...valid, isins: ['INE002A01019'] },
    { ...valid, isins: ['US0378331005'] },
    { ...valid, isins: [] },
    { ...valid, isins: ['INE002A01018', 'INE002A01018'] },
    { ...valid, isins: Array(6).fill('INE002A01018') },
    { ...valid, sourceUrl: 'https://untrusted.example' },
    { ...valid, quantity: '10' },
    { ...valid, requestId: 'not-a-uuid' },
  ])
    assert.equal(SecurityRefreshInputSchema.safeParse(input).success, false);
});

async function withSyntheticStore(work, { previous = null, wait = 0 } = {}) {
  const store = new SecuritiesStore({
    DATABASE_URL: 'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic',
    MONGODB_URI: 'mongodb://127.0.0.1:1/synthetic',
  });
  const originalPool = store.pool;
  const originalMongo = store.mongo;
  const statements = [];
  const evidence = [];
  const connection = {
    query: async (sql, args = []) => {
      statements.push({ sql, args });
      if (sql.includes('pg_try_advisory_lock'))
        return { rows: [{ locked: true }] };
      if (sql.startsWith('SELECT payload FROM security_refresh_runs WHERE id='))
        return { rows: previous ? [{ payload: previous }] : [] };
      if (sql.includes('next_allowed_at-now()')) return { rows: [{ wait }] };
      return { rows: [] };
    },
    release() {},
  };
  store.pool = { connect: async () => connection };
  store.mongo = {
    db: () => ({
      collection: () => ({
        updateOne: async (query, document, options) => {
          evidence.push({ query, document, options });
        },
      }),
    }),
  };
  try {
    await work({ store, statements, evidence });
  } finally {
    await Promise.all([originalPool.end(), originalMongo.close()]);
  }
}

test(
  'synthetic source request is fixed to India INR equity and only validated evidence is promoted',
  { concurrency: false },
  async () => {
    const original = globalThis.fetch;
    const calls = [];
    try {
      globalThis.fetch = async (url, init) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(mapping(candidate())), {
          status: 200,
        });
      };
      await withSyntheticStore(async ({ store, statements, evidence }) => {
        const run = await store.refresh({
          requestId: randomUUID(),
          isins: ['INE002A01018'],
        });
        assert.equal(run.status, 'completed');
        assert.equal(run.outcomes[0].status, 'matched');
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, 'https://api.openfigi.com/v3/mapping');
        assert.equal(calls[0].init.method, 'POST');
        assert.equal(calls[0].init.redirect, 'error');
        assert.deepEqual(JSON.parse(calls[0].init.body), [
          {
            idType: 'ID_ISIN',
            idValue: 'INE002A01018',
            exchCode: 'IN',
            marketSecDes: 'Equity',
            currency: 'INR',
          },
        ]);
        assert.deepEqual(calls[0].init.headers, {
          'Content-Type': 'application/json',
        });
        assert.equal(evidence.length, 1);
        const insert = statements.find((v) =>
          v.sql.startsWith('INSERT INTO security_identity_revisions'),
        );
        const edition = SecurityIdentitySchema.parse(
          JSON.parse(insert.args[3]),
        );
        assert.equal(edition.sourceHash, evidence[0].query._id);
        assert.equal(
          edition.retrievedAt,
          evidence[0].document.$setOnInsert.retrievedAt,
        );
        // A receipt identifies the ISIN, retrieval time and exact response body.
        assert.equal(
          edition.sourceHash,
          createHash('sha256')
            .update(
              `INE002A01018\n${edition.retrievedAt}\n${evidence[0].document.$setOnInsert.body}`,
            )
            .digest('hex'),
        );
        assert.deepEqual(
          JSON.parse(evidence[0].document.$setOnInsert.body),
          mapping(candidate()),
        );
        assert.equal(
          statements.some((v) => v.sql === 'COMMIT'),
          true,
        );
      });
    } finally {
      globalThis.fetch = original;
    }
  },
);

test(
  'synthetic provider failures never advance a successful check or canonical edition',
  { concurrency: false },
  async () => {
    const original = globalThis.fetch;
    try {
      for (const source of [
        () => new Response('not-json', { status: 200 }),
        () =>
          new Response(
            JSON.stringify(mapping(candidate({ unexpected: true }))),
            { status: 200 },
          ),
        () => new Response('Synthetic upstream unavailable', { status: 503 }),
        () => new Response('Synthetic rate limit', { status: 429 }),
        () => new Response('x'.repeat(200001), { status: 200 }),
      ]) {
        globalThis.fetch = async () => source();
        await withSyntheticStore(async ({ store, statements, evidence }) => {
          const run = await store.refresh({
            requestId: randomUUID(),
            isins: ['INE002A01018'],
          });
          assert.equal(run.status, 'failed');
          assert.equal(run.outcomes[0].version, null);
          assert.equal(evidence.length, 0);
          assert.equal(
            statements.some((v) =>
              /^(INSERT INTO security_identit|UPDATE security_identities)/.test(
                v.sql,
              ),
            ),
            false,
          );
          assert.equal(
            statements.some((v) => v.sql.includes('pg_advisory_unlock')),
            true,
          );
        });
      }
    } finally {
      globalThis.fetch = original;
    }
  },
);

test(
  'synthetic request replay and cooldown do not contact the provider',
  { concurrency: false },
  async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw Error('Synthetic unexpected source request');
    };
    const previous = {
      id: randomUUID(),
      isins: ['INE002A01018'],
      status: 'completed',
      startedAt: '2026-09-13T00:00:00.000Z',
      finishedAt: '2026-09-13T00:00:01.000Z',
      outcomes: [
        {
          isin: 'INE002A01018',
          status: 'matched',
          version: 1,
          message: 'Synthetic replay fixture',
        },
      ],
    };
    try {
      await withSyntheticStore(
        async ({ store }) => {
          assert.deepEqual(
            await store.refresh({
              requestId: previous.id,
              isins: previous.isins,
            }),
            previous,
          );
          await assert.rejects(
            () =>
              store.refresh({
                requestId: previous.id,
                isins: ['INE009A01021'],
              }),
            (error) => error.getStatus() === 409,
          );
        },
        { previous },
      );
      await withSyntheticStore(
        async ({ store }) => {
          const run = await store.refresh({
            requestId: randomUUID(),
            isins: ['INE002A01018'],
          });
          assert.equal(run.status, 'failed');
          assert.match(run.outcomes[0].message, /cooling down/);
        },
        { wait: 120000 },
      );
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = original;
    }
  },
);
