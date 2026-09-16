import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { publicBeaGdpSeries } from '@fingent360/contracts';
import {
  decodeIdentity,
  encryptIdentity,
  identityLookup,
} from '../dist/private-account-identity.js';
import { releasedResearchPolicies } from '../dist/research-governance.js';
import { WhatsappStore } from '../dist/whatsapp-channel.js';

// Synthetic keys and identity only; no services or provider calls.
const key = Buffer.alloc(32, 7).toString('base64');
const keys = {
  PRIVATE_DATA_ACTIVE_KEY: 'fixture',
  PRIVATE_DATA_KEYS: JSON.stringify({ fixture: key }),
};
const noQuery = {
  async query() {
    assert.fail('This boundary must not query storage');
  },
};

test('SDLC-REPAIR-012 identity decoding preserves authentication and account metadata', async () => {
  const row = {
    id: 'synthetic-owner',
    username: null,
    username_lookup: identityLookup('synthetic_owner', key),
    encrypted_identity: encryptIdentity(
      'synthetic-owner',
      'synthetic_owner',
      keys,
    ),
    password_hash: 'synthetic-hash',
    password_salt: 'synthetic-salt',
    consent_version: 'synthetic-consent',
    created_at: new Date('2026-09-16T00:00:00Z'),
  };
  const before = { ...row };
  const decoded = await decodeIdentity(noQuery, row, keys, key);
  assert.equal(decoded, row);
  assert.deepEqual(decoded, { ...before, username: 'synthetic_owner' });
  await assert.rejects(
    decodeIdentity(noQuery, { ...row, username_lookup: 'mismatch' }, keys, key),
    /lookup could not be verified/,
  );
});

test('SDLC-REPAIR-012 a hashless edition never widens the research context query', async () => {
  const contexts = await releasedResearchPolicies(
    noQuery,
    {},
    'causal-context',
    {
      id: 'synthetic-edition',
      version: 1,
      sourceHash: null,
    },
  );
  assert.deepEqual(contexts, []);
});

test('SDLC-REPAIR-012 missing GDP originals are omitted from public series', () => {
  const edition = {
    id: 'synthetic-edition',
    version: 1,
    status: 'published',
    reviewedAt: '2026-09-16T00:00:00Z',
  };
  const series = publicBeaGdpSeries(
    [edition, { ...edition, gdpOriginal: undefined }],
    '2026-09-16T00:00:00Z',
  );
  assert.deepEqual(series.items, []);
  assert.equal(series.truncated, false);
});

test('SDLC-REPAIR-012 missing WhatsApp identity key fails closed', () => {
  const store = new WhatsappStore({}, {});
  assert.throws(
    () => store.phoneHash('15555550123'),
    (error) => error.getStatus() === 503,
  );
});
