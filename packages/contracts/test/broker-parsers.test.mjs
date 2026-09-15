import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  brokerCapabilities,
  BrokerCapabilitiesSchema,
  requireVerifiedBrokerParser,
} from '../dist/broker-parsers.js';

test('BROKER-PARSERS-002 all five brokers fail closed without invented format versions', () => {
  const catalogue = brokerCapabilities();
  assert.equal(catalogue.brokers.length, 5);
  assert.equal(new Set(catalogue.brokers.map((b) => b.id)).size, 5);
  for (const broker of catalogue.brokers) {
    assert.equal(broker.parserVersion, null);
    assert.throws(
      () => requireVerifiedBrokerParser(broker.id),
      /automatic format is not enabled/,
    );
  }
  assert.throws(() => requireVerifiedBrokerParser('some-file-zerodha.csv'));
  assert.throws(() =>
    BrokerCapabilitiesSchema.parse({ ...catalogue, enabled: true }),
  );
});

test('BROKER-PARSERS-002 caller edits cannot enable a shared broker capability', () => {
  const catalogue = brokerCapabilities();
  catalogue.brokers.pop();
  assert.equal(brokerCapabilities().brokers.length, 5);
  assert.throws(() =>
    BrokerCapabilitiesSchema.parse({
      ...brokerCapabilities(),
      brokers: brokerCapabilities().brokers.map((broker) => ({
        ...broker,
        parserVersion: 'invented-v1',
      })),
    }),
  );
});
