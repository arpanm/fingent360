import { test, expect } from '@playwright/test';
import { positioningInput } from '../../helpers/participant-positioning';
import {
  parseParticipantPositioning,
  PositioningPublicSchema,
} from '../../../../packages/contracts/src/index';
import { handleParticipantPositioning } from '../../../../apps/web/src/offline/participant-positioning';
test('E2E-OFFLINE-1391 preserved positioning snapshot reconstructs totals and rejects tampering or operator writes @SRC-011 @TEST-SIMULATION', async () => {
  const now = '2025-06-07T00:00:00.000Z',
    edition = {
      ...parseParticipantPositioning(positioningInput(), 'a'.repeat(64), now),
      reviewedAt: now,
    },
    snapshot = { editions: [edition], capturedAt: now },
    state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    bundle = {
      generatedAt: now,
      feed: [],
      histories: {},
      evidence: {},
      macro: null,
      macroHistory: {},
      macroEvidence: {},
      sources: null,
      learningCatalog: null,
      journeyCatalog: null,
      media: {},
      participantPositioning: snapshot,
    },
    request = {
      path: '/api/v1/positioning',
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  expect(
    (await handleParticipantPositioning(request, state, bundle))?.body,
  ).toEqual(snapshot);
  const corrupt = structuredClone(snapshot);
  corrupt.editions[0]!.rows[0]!.counts[0] = '99';
  expect(PositioningPublicSchema.safeParse(corrupt).success).toBe(false);
  expect(() =>
    handleParticipantPositioning(
      { ...request, path: '/api/v1/ops/positioning/capture', method: 'POST' },
      state,
      bundle,
    ),
  ).toThrow('connected API');
});
