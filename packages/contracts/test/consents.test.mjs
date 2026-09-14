import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  ConsentStateSchema,
  ConsentReceiptSchema,
  ConsentListSchema,
  ConsentWriteSchema,
  ConsentExportSchema,
  CompleteConsentExportSchema,
  consentPurposes,
  consentActive,
  consentStatus,
  emptyConsent,
  reviseConsent,
} from '../dist/index.js';
const at = '2026-09-14T10:00:00.000Z',
  later = '2026-09-14T11:00:00.000Z';
const input = (action, expectedVersion, extra = {}) =>
  ConsentWriteSchema.parse({
    requestId: randomUUID(),
    action,
    expectedVersion,
    policyVersion: 'purpose-consent-v1',
    reviewed: true,
    ...(action === 'revoke' ? {} : { expiresAt: null }),
    ...extra,
  });
test('four purposes start without an invented grant; strict list has one of each', () => {
  const purposes = consentPurposes.map((p) => ({
    record: emptyConsent(p),
    status: 'not-granted',
  }));
  assert.equal(purposes.length, 4);
  assert.ok(purposes.every((p) => !consentActive(p.record, at)));
  const value = { ownerId: randomUUID(), evaluatedAt: at, purposes };
  assert.equal(ConsentListSchema.safeParse(value).success, true);
  assert.equal(
    ConsentListSchema.safeParse({
      ...value,
      purposes: purposes.map(() => purposes[0]),
    }).success,
    false,
  );
  assert.equal(
    ConsentStateSchema.safeParse({
      ...emptyConsent(consentPurposes[0]),
      decision: 'granted',
      basis: { kind: 'review', recordedAt: at },
    }).success,
    false,
  );
});
test('grant expiry boundary renewal revocation and version compare preserve prior snapshots', () => {
  const before = emptyConsent('external-ai-private-context');
  const granted = reviseConsent(
    before,
    input('grant', 0, { expiresAt: later }),
    at,
  );
  assert.equal(consentActive(granted.state, at), true);
  assert.equal(consentActive(granted.state, later), false);
  assert.equal(consentStatus(granted.state, later), 'expired');
  const revoked = reviseConsent(granted.state, input('revoke', 1), later);
  assert.equal(revoked.state.expiresAt, later);
  assert.deepEqual(revoked.before, granted.state);
  assert.equal(consentActive(revoked.state, later), false);
  const renewed = reviseConsent(revoked.state, input('renew', 2), later);
  assert.equal(renewed.state.version, 3);
  assert.equal(renewed.state.grantedAt, later);
  assert.equal(granted.state.version, 1);
  assert.equal(granted.state.decision, 'granted');
  assert.throws(() => reviseConsent(renewed.state, input('renew', 1), later));
  assert.throws(() =>
    reviseConsent(before, input('grant', 0, { expiresAt: at }), at),
  );
  assert.throws(() =>
    reviseConsent(
      before,
      input('grant', 0, { expiresAt: '2028-01-01T00:00:00Z' }),
      at,
    ),
  );
});
test('future known dates are unavailable and actual unknown-date legacy reading remains explicit', () => {
  const state = reviseConsent(
    emptyConsent('scheduled-record-reviews'),
    input('grant', 0),
    later,
  ).state;
  assert.equal(consentActive(state, at), false);
  assert.equal(consentStatus(state, at), 'unavailable');
  const legacy = ConsentStateSchema.parse({
    ...emptyConsent('reading-personalization'),
    decision: 'granted',
    basis: { kind: 'legacy-reading-preference', recordedAt: null },
  });
  assert.equal(consentStatus(legacy, at), 'legacy-active');
  assert.equal(legacy.grantedAt, null);
  assert.equal(
    ConsentStateSchema.safeParse({
      ...legacy,
      purpose: 'external-ai-private-context',
    }).success,
    false,
  );
  assert.equal(
    ConsentStateSchema.safeParse({ ...state, changedAt: at }).success,
    false,
  );
});
test('receipts reject forged actions dates basis and catch-up effects', () => {
  const receipt = reviseConsent(
    emptyConsent('scheduled-record-reviews'),
    input('grant', 0),
    at,
  );
  for (const forged of [
    { ...receipt, action: 'revoke' },
    { ...receipt, action: 'renew' },
    { ...receipt, requestId: null },
    {
      ...receipt,
      state: {
        ...receipt.state,
        basis: {
          kind: 'schedule-opt-in',
          recordedAt: at,
          scheduleId: randomUUID(),
          scheduleVersion: 1,
          requestId: randomUUID(),
        },
      },
    },
    {
      ...receipt,
      scheduleEffects: [{ scheduleId: randomUUID(), nextDueAt: at }],
    },
  ])
    assert.equal(ConsentReceiptSchema.safeParse(forged).success, false);
  assert.equal(
    ConsentReceiptSchema.safeParse({
      ...receipt,
      scheduleEffects: [{ scheduleId: randomUUID(), nextDueAt: later }],
    }).success,
    true,
  );
  assert.equal(
    ConsentWriteSchema.safeParse({ ...input('revoke', 0), expiresAt: null })
      .success,
    false,
  );
  assert.equal(
    ConsentWriteSchema.safeParse({ ...input('grant', 0), reviewed: false })
      .success,
    false,
  );
});
test('history uses numerical keysets with gaps and complete boundary reconciliation', () => {
  const receipt = reviseConsent(
      emptyConsent('reading-personalization'),
      input('grant', 0),
      at,
    ),
    ownerId = randomUUID();
  const events = ['2', '10', '101'].map((sequence) => ({ sequence, receipt }));
  assert.equal(
    ConsentExportSchema.safeParse({ ownerId, upper: '101', events, next: null })
      .success,
    true,
  );
  assert.equal(
    CompleteConsentExportSchema.safeParse({
      ownerId,
      upper: '101',
      events,
      complete: true,
    }).success,
    true,
  );
  assert.equal(
    CompleteConsentExportSchema.safeParse({
      ownerId,
      upper: '102',
      events,
      complete: true,
    }).success,
    false,
  );
  assert.equal(
    ConsentExportSchema.safeParse({
      ownerId,
      upper: '101',
      events: [...events].reverse(),
      next: null,
    }).success,
    false,
  );
});
