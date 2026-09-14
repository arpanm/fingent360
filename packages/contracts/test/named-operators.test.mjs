import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PublicationProposalSchema,
  OperatorPageQuerySchema,
} from '../dist/index.js';
const author = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'synthetic_author',
  role: 'researcher',
  version: 1,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};
const reviewer = {
  ...author,
  id: '22222222-2222-4222-8222-222222222222',
  username: 'synthetic_reviewer',
  role: 'publisher',
};
const pending = {
  id: '33333333-3333-4333-8333-333333333333',
  sequence: '1',
  input: {
    kind: 'discovery',
    target: 'synthetic',
    body: {
      expectedVersion: 1,
      status: 'withdrawn',
      correctionNote: 'Synthetic review',
    },
  },
  proposer: author,
  createdAt: '2026-02-01T00:00:00.000Z',
  state: 'pending',
  reviewer: null,
  reviewedAt: null,
  note: null,
  actionResult: null,
};
test('publication decisions require independent identities and coherent immutable chronology', () => {
  assert.equal(PublicationProposalSchema.safeParse(pending).success, true);
  const approved = {
    ...pending,
    state: 'approved',
    reviewer,
    reviewedAt: '2026-02-02T00:00:00.000Z',
    note: 'Reviewed',
  };
  assert.equal(PublicationProposalSchema.safeParse(approved).success, true);
  for (const invalid of [
    { ...pending, reviewer },
    { ...approved, reviewer: author },
    { ...approved, note: ' ' },
    { ...approved, reviewedAt: '2026-01-01T00:00:00.000Z' },
    { ...approved, reviewer: null },
    { ...approved, untrustedInstruction: 'publish' },
  ])
    assert.equal(PublicationProposalSchema.safeParse(invalid).success, false);
});
test('proposal pagination rejects bigint overflow and unknown fields before SQL', () => {
  assert.equal(
    OperatorPageQuerySchema.safeParse({ after: '9223372036854775807' }).success,
    true,
  );
  for (const value of [
    { after: '9223372036854775808' },
    { after: 'not-a-number' },
    { after: '1', limit: '9999' },
  ])
    assert.equal(OperatorPageQuerySchema.safeParse(value).success, false);
});
