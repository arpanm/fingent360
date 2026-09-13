import test from 'node:test';
import assert from 'node:assert/strict';
import { learningGrade } from '../dist/learning.js';
import { LearningSubmitSchema } from '@fingent360/contracts';
test('reviewed glossary quiz rubric distinguishes identifier and reconciliation', () => {
  assert.equal(learningGrade('isin-meaning', 'security').correct, true);
  assert.equal(learningGrade('isin-meaning', 'account').correct, false);
  assert.equal(learningGrade('reconciliation', 'totals').correct, true);
  assert.equal(learningGrade('reconciliation', 'nothing').correct, false);
  assert.match(
    learningGrade('reconciliation', 'nothing').explanation,
    /source/,
  );
  assert.throws(() => learningGrade('reconciliation', 'invented'));
  assert.throws(() => learningGrade('learning-interest', 'sources'));
});
test('learning submissions reject unknown input and absent consent', () => {
  const input = {
    questionId: 'isin-meaning',
    version: 1,
    choiceId: 'security',
    requestId: '00000000-0000-4000-8000-000000000001',
    consent: true,
  };
  assert.equal(LearningSubmitSchema.safeParse(input).success, true);
  assert.equal(
    LearningSubmitSchema.safeParse({ ...input, consent: false }).success,
    false,
  );
  assert.equal(
    LearningSubmitSchema.safeParse({ ...input, userId: 'someone-else' })
      .success,
    false,
  );
  assert.equal(
    LearningSubmitSchema.safeParse({ ...input, version: 2 }).success,
    false,
  );
});
