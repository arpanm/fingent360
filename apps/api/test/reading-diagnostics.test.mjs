import test from 'node:test';
import assert from 'node:assert/strict';
import { readingFailure } from '../dist/reading-diagnostics.js';

test('reading faults retain safe phase/state without raw exception content', () => {
  const error = Object.assign(new Error('secret SQL and user content'), {
    code: '42P01',
    detail: 'private parameter',
    table: 'private_name',
  });
  assert.deepEqual(readingFailure(error, 'incident', 'capture'), {
    event: 'reading-transaction-failed',
    incident: 'incident',
    phase: 'capture',
    category: 'schema',
    sqlState: '42P01',
  });
  for (const code of ['secret', '42P01\nprivate', 'https://private.invalid']) {
    const result = readingFailure(
      { code, message: 'secret' },
      'id',
      'admission',
    );
    assert.equal(result.sqlState, null);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  }
});

test('reading diagnostic separates repairable schema/rights faults from connection and integrity faults', () => {
  for (const [code, category] of [
    ['42501', 'permissions'],
    ['23503', 'integrity'],
    ['08006', 'connection'],
    ['57014', 'timeout'],
  ]) {
    assert.equal(readingFailure({ code }, 'id', 'capture').category, category);
  }
  assert.equal(readingFailure(null, 'id', 'work').category, 'unexpected');
});
