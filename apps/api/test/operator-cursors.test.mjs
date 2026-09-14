import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { OperatorAuditController } from '../dist/operator-audit.js';
import { PublishingQueueController } from '../dist/publishing-queue.js';
import { INTERNAL_OPERATOR } from '../dist/operator-internal.js';

const time = '2026-09-14T00:00:00.000000Z';
const cases = [
  {
    Controller: OperatorAuditController,
    domain: 'operator-audit-v1',
    value: {
      version: 1,
      filters: {},
      upper: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', recordedAt: time },
      before: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', recordedAt: time },
    },
  },
  {
    Controller: PublishingQueueController,
    domain: 'publishing-queue-v1',
    value: {
      version: 1,
      filters: {},
      upper: { id: 'synthetic-source', changedAt: time },
      after: { id: 'synthetic-source', changedAt: time },
      openedAt: '2026-09-14T00:00:00.000Z',
    },
  },
];
for (const { Controller, domain, value } of cases) {
  test(`${domain} named cursor rejects tampering, public capability text and another instance`, () => {
    // Exercise the actual codec without constructing a database or authorizing a read.
    const ops = { serverAuthorization: () => INTERNAL_OPERATOR };
    const first = new Controller({}, ops);
    const second = new Controller({}, ops);
    const encoded = first.encode(value);
    assert.deepEqual(first.decode(encoded), value);
    assert.throws(() => second.decode(encoded));
    const [body, signature] = encoded.split('.');
    const changed = Buffer.from(signature, 'base64url');
    changed[0] ^= 1;
    assert.throws(() =>
      first.decode(`${body}.${changed.toString('base64url')}`),
    );
    for (const publicText of [
      String(INTERNAL_OPERATOR),
      INTERNAL_OPERATOR.description,
    ]) {
      const forged = createHmac('sha256', publicText)
        .update(`${domain}:${body}`)
        .digest('base64url');
      assert.throws(() => first.decode(`${body}.${forged}`));
    }
  });
  test(`${domain} bootstrap cursor retains its existing key and domain binding`, () => {
    const key = `Bearer ${'a'.repeat(64)}`;
    const ops = { serverAuthorization: () => key };
    const first = new Controller({}, ops);
    const second = new Controller({}, ops);
    const encoded = first.encode(value);
    const [body, signature] = encoded.split('.');
    assert.equal(
      signature,
      createHmac('sha256', key).update(`${domain}:${body}`).digest('base64url'),
    );
    assert.deepEqual(second.decode(encoded), value);
    const otherDomain = createHmac('sha256', key)
      .update(`other:${body}`)
      .digest('base64url');
    assert.throws(() => first.decode(`${body}.${otherDomain}`));
  });
}
