import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  configuredProviders,
  generateAssistance,
} from '../dist/ai-providers.js';
import {
  selectAssistanceCandidates,
  validateModelAssistance,
} from '../dist/assistance.js';
test('only configured key/model pairs enable providers', () => {
  assert.deepEqual(configuredProviders({ OPENAI_API_KEY: 'synthetic' }), []);
  assert.deepEqual(
    configuredProviders({
      OPENAI_API_KEY: 'synthetic',
      OPENAI_MODEL: 'test-model',
    }),
    [{ provider: 'openai', model: 'test-model' }],
  );
});
for (const provider of ['openai', 'gemini', 'anthropic'])
  test(`${provider} adapter sends bounded request to fixed host and parses fixture`, async () => {
    const prefix = provider.toUpperCase();
    const config = {
      [`${prefix}_API_KEY`]: 'synthetic-test-key',
      [`${prefix}_MODEL`]: 'test-model',
    };
    let observed;
    const fixture =
      provider === 'openai'
        ? {
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: 'answer' }],
              },
            ],
          }
        : provider === 'gemini'
          ? { candidates: [{ content: { parts: [{ text: 'answer' }] } }] }
          : { content: [{ type: 'text', text: 'answer' }] };
    const result = await generateAssistance(
      config,
      provider,
      'instructions',
      'query',
      async (url, init) => {
        observed = { url, init };
        return new Response(JSON.stringify(fixture));
      },
    );
    assert.equal(result, 'answer');
    assert.equal(observed.init.redirect, 'error');
    assert.ok(observed.init.signal);
    assert.ok(!observed.url.includes('synthetic-test-key'));
    const payload = JSON.parse(observed.init.body);
    assert.equal(payload.model ?? 'test-model', 'test-model');
    if (provider === 'openai') assert.equal(payload.store, false);
  });
test('unknown source IDs and invented values rejected', () => {
  const candidates = [
    {
      id: 'known',
      title: 'Known',
      text: 'An exact grounded explanation.',
      type: 'explanation',
      href: '#learning',
      private: false,
    },
  ];
  assert.throws(() =>
    validateModelAssistance(
      JSON.stringify({
        suggestions: [
          {
            sourceId: 'other',
            text: 'An exact grounded explanation.',
            type: 'explanation',
          },
        ],
      }),
      candidates,
    ),
  );
  assert.throws(() =>
    validateModelAssistance(
      JSON.stringify({
        suggestions: [
          {
            sourceId: 'known',
            text: 'Invest 10000 for guaranteed returns.',
            type: 'explanation',
          },
        ],
      }),
      candidates,
    ),
  );
  assert.equal(
    validateModelAssistance(
      JSON.stringify({
        suggestions: [
          {
            sourceId: 'known',
            text: 'An exact grounded explanation.',
            type: 'explanation',
          },
        ],
      }),
      candidates,
    )[0].source.id,
    'known',
  );
});
test('query matches only provided history and bounded product explanations', () => {
  const candidates = selectAssistanceCandidates(
    'monthly contribution',
    'goals',
    [],
  );
  assert.ok(candidates.some((value) => value.id === 'field-monthly'));
  assert.ok(candidates.every((value) => !value.private));
});
test('provider errors do not expose credentials or provider body', async () => {
  await assert.rejects(
    generateAssistance(
      { OPENAI_API_KEY: 'synthetic-secret', OPENAI_MODEL: 'test-model' },
      'openai',
      'instruction',
      'query',
      async () => new Response('private provider detail', { status: 401 }),
    ),
    { message: 'Provider request failed.' },
  );
});

test('provider cannot strip negation or qualifying context from a reference', () => {
  const source = {
    id: 'cost',
    title: 'Cost',
    type: 'explanation',
    href: '#holdings',
    private: false,
    text: 'Enter the entire purchase cost, not the price of one share.',
  };
  for (const text of [
    'the price of one share',
    'Enter the entire purchase cost',
  ]) {
    assert.throws(() =>
      validateModelAssistance(
        JSON.stringify({
          suggestions: [{ sourceId: source.id, type: source.type, text }],
        }),
        [source],
      ),
    );
  }
  assert.equal(
    validateModelAssistance(
      JSON.stringify({
        suggestions: [
          { sourceId: source.id, type: source.type, text: source.text },
        ],
      }),
      [source],
    )[0].text,
    source.text,
  );
});
