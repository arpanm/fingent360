import { test, expect } from '@playwright/test';
import { parseCpiCapture } from '../../../../packages/contracts/src/index';
import { sourceHash } from '../../../../apps/api/src/discovery-provider';
import { cpiNowcastInput } from '../../helpers/cpi-expectations';
import { handleCpiExpectations } from '../../../../apps/web/src/offline/cpi-expectations';
test('E2E-OFFLINE-1670 downloaded model preserves unknown publication and rejects altered cells @EVENT-SCENARIOS-001 @TEST-SIMULATION', async () => {
  const input = cpiNowcastInput(),
    expectation = parseCpiCapture({
      ...input,
      hash: sourceHash(input.url, input.body),
      retrievedAt: '2026-09-15T00:00:00.000Z',
    }),
    snapshot = {
      capturedAt: expectation.retrievedAt,
      editions: [
        {
          id: input.requestId,
          expectation,
          reviewedAt: '2026-09-15T00:00:01.000Z',
        },
      ],
    },
    bundle = {
      generatedAt: expectation.retrievedAt,
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
  expect((await handleCpiExpectations(request, state, bundle))?.body).toEqual(
    snapshot,
  );
  await expect(
    async () =>
      await handleCpiExpectations(request, state, {
        ...bundle,
        cpiExpectations: {
          ...snapshot,
          editions: [
            {
              ...snapshot.editions[0]!,
              expectation: {
                ...expectation,
                points: [{ ...expectation.points[0]!, value: '9.9' }],
              },
            },
          ],
        },
      }),
  ).rejects.toThrow();
  expect(
    (
      await handleCpiExpectations(request, state, {
        ...bundle,
        cpiExpectations: { ...snapshot, editions: [] },
      })
    )?.body,
  ).toMatchObject({ editions: [] });
  await expect(
    async () =>
      await handleCpiExpectations(
        { ...request, path: '/api/v1/ops/cpi-expectations' },
        state,
        bundle,
      ),
  ).rejects.toThrow();
});
