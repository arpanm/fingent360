import { test, expect } from '@playwright/test';
import {
  parseCpiCapture,
  compareCpiSnapshots,
  CpiExpectationPublicSchema,
} from '../../../../packages/contracts/src/index';
import { sourceHash } from '../../../../apps/api/src/discovery-provider';
import {
  cpiHistoryInput,
  cpiHistoricalActualInput,
} from '../../helpers/cpi-history';
import { handleCpiExpectations } from '../../../../apps/web/src/offline/cpi-expectations';
test('E2E-OFFLINE-1850 downloaded historical model comparison preserves exact vintage and retrospective limitation @EVENT-SCENARIOS-001 @SOURCE-EXCERPT', async () => {
  const time = '2026-09-15T00:00:00.000Z',
    editions = [cpiHistoryInput(), cpiHistoricalActualInput()].map((input) => ({
      id: input.requestId,
      expectation: parseCpiCapture({
        ...input,
        hash: sourceHash(input.url, input.body),
        retrievedAt: time,
      }),
      reviewedAt: time,
    })),
    snapshot = { capturedAt: time, editions },
    bundle = {
      generatedAt: time,
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
      cpiExpectations: snapshot,
    },
    state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    request = {
      path: '/api/v1/cpi-expectations',
      method: 'GET' as const,
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  const result = CpiExpectationPublicSchema.parse(
    (await handleCpiExpectations(request, state, bundle))?.body,
  );
  expect(
    compareCpiSnapshots(result.editions[0]!, result.editions[1]!, '2025-01'),
  ).toMatchObject({
    difference: '0.257575370852849',
    prospective: false,
    priorHistoricalVintage: true,
  });
  const changed = {
    ...snapshot,
    editions: [
      {
        ...editions[0]!,
        expectation: {
          ...editions[0]!.expectation,
          history: { ...editions[0]!.expectation.history!, asOf: '2025-02-10' },
        },
      },
    ],
  };
  await expect(async () =>
    handleCpiExpectations(request, state, {
      ...bundle,
      cpiExpectations: changed,
    }),
  ).rejects.toThrow();
});
