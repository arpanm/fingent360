import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFedTargetRange } from '../dist/fed-target-range.js';
import { exactEventDelta } from '../dist/event-scenarios.js';
test('actual July and September 2024 policy range fractions yield exact corresponding-bound changes', () => {
  const pack = JSON.parse(
    readFileSync(
      new URL('./fixtures/fomc-2024-policy-pack.json', import.meta.url),
      'utf8',
    ),
  );
  const prior = parseFedTargetRange(pack.sources[0].quote),
    observed = parseFedTargetRange(pack.sources[1].quote);
  assert.equal(prior.lower, '5.25');
  assert.equal(prior.upper, '5.5');
  assert.equal(observed.lower, '4.75');
  assert.equal(observed.upper, '5');
  assert.equal(exactEventDelta(observed.lower, prior.lower), '-0.5');
  assert.equal(exactEventDelta(observed.upper, prior.upper), '-0.5');
  assert.equal(observed.rawLower, '4-3/4');
});
test('other numbers, unsupported fractions and multiple ranges cannot silently become target bounds', () => {
  assert.throws(
    () =>
      parseFedTargetRange(
        'The inflation objective is 2 percent and the dissent preferred 1/4 percentage point.',
      ),
    /supported/,
  );
  assert.throws(
    () =>
      parseFedTargetRange(
        'target range for the federal funds rate at 4-1/3 to 5 percent',
      ),
    /supported/,
  );
  assert.throws(
    () =>
      parseFedTargetRange(
        'target range for the federal funds rate at 4-3/2 to 5 percent',
      ),
    /token/,
  );
  assert.throws(
    () =>
      parseFedTargetRange(
        'target range for the federal funds rate at 6 to 5 percent',
      ),
    /reversed/,
  );
});
