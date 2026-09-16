import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOilEducationSource,
  OIL_EDUCATION_ANCHOR,
} from '../dist/index.js';
const input = {
  requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  body: '<p>National, 1 April 2026:</p><p>' + OIL_EDUCATION_ANCHOR + '</p>',
  rightsEvidence:
    'TEST-SIMULATION reconstructed original excerpt; not official page bytes.',
  rightsConfirmed: true,
};
test('actual minimal issuer anchor retains source date precision and exact issuer identity', () => {
  const value = parseOilEducationSource(
    input,
    'a'.repeat(64),
    'b'.repeat(64),
    '2026-09-15T00:00:00.000Z',
  );
  assert.equal(value.isin, 'INE646L01027');
  assert.equal(value.sourceDate, '2026-04-01');
  assert.equal(value.datePrecision, 'date-only');
  assert.equal(value.anchor, OIL_EDUCATION_ANCHOR);
});
test('different disclosure date or script-only evidence cannot become supported issuer facts', () => {
  assert.throws(() =>
    parseOilEducationSource(
      { ...input, body: input.body.replace('1 April', '2 April') },
      'a'.repeat(64),
      'b'.repeat(64),
      '2026-09-15T00:00:00.000Z',
    ),
  );
  assert.throws(() =>
    parseOilEducationSource(
      { ...input, body: '<script>' + input.body + '</script>' },
      'a'.repeat(64),
      'b'.repeat(64),
      '2026-09-15T00:00:00.000Z',
    ),
  );
});
