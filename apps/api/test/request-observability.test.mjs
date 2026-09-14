import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  requestFamily,
  requestObservation,
} from '../dist/request-observability.js';
test('request observations omit URLs and secrets and record completion once', () => {
  const records = [],
    headers = {};
  const response = new EventEmitter();
  response.statusCode = 403;
  response.setHeader = (key, value) => {
    headers[key] = value;
  };
  let next = false;
  requestObservation((record) => records.push(record))(
    { url: '/api/v1/account/private-person?token=secret-value', method: 'GET' },
    response,
    () => {
      next = true;
    },
  );
  response.emit('finish');
  response.emit('close');
  assert.equal(next, true);
  assert.equal(records.length, 1);
  assert.equal(records[0].family, 'account');
  assert.equal(records[0].completed, true);
  assert.equal(records[0].requestId, headers['X-Request-ID']);
  assert.equal(JSON.stringify(records).includes('secret-value'), false);
  assert.equal(JSON.stringify(records).includes('private-person'), false);
  assert.equal(requestFamily('/api/v1/anything-sensitive/person'), 'other');
  for (const family of [
    'events',
    'policy-rates',
    'oil-benchmarks',
    'reference-fx',
  ]) {
    assert.equal(
      requestFamily(`/api/v1/${family}/private-id?token=secret-value`),
      family,
    );
    assert.equal(requestFamily(`/api/v1/${family}-private-id`), 'other');
  }
});
test('aborted request is distinct from successful completion', () => {
  const records = [];
  const response = new EventEmitter();
  response.statusCode = 200;
  response.setHeader = () => {};
  requestObservation((record) => records.push(record))(
    { url: '/api/v1/feedback', method: 'custom-secret' },
    response,
    () => {},
  );
  response.emit('close');
  response.emit('finish');
  assert.equal(records.length, 1);
  assert.equal(records[0].completed, false);
  assert.equal(records[0].method, 'OTHER');
});
