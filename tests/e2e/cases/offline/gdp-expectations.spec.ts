import { test, expect } from '@playwright/test';
import { spfInput } from '../../helpers/gdp-expectations';
import {
  parseSpfGdp,
  compareGdpExpectation,
  parseBeaGdpOriginal,
} from '../../../../packages/contracts/src/index';
import { originalGdpItem } from '../../../../apps/api/src/bea-gdp-original-provider';
import { sourceHash } from '../../../../apps/api/src/discovery-provider';
import { gdpOriginalInputs } from '../../helpers/bea-gdp-original';
import { handleGdpExpectations } from '../../../../apps/web/src/offline/gdp-expectations';
test('E2E-OFFLINE-1620 downloaded original expectation preserves retrospective basis and rejects corrupted original quarter @EVENT-SCENARIOS-001 @TEST-SIMULATION', async () => {
  const data = spfInput(),
    expectation = parseSpfGdp({
      url: data.url,
      body: data.body,
      hash: sourceHash(data.url, data.body),
      retrievedAt: '2026-09-15T00:00:00.000Z',
    }),
    actual = parseBeaGdpOriginal((await gdpOriginalInputs())[0]!);
  const originalRaw = (await gdpOriginalInputs())[0]!,
    item = {
      ...originalGdpItem(originalRaw),
      status: 'published' as const,
      reviewedAt: '2026-09-15T00:01:00.000Z',
    };
  const snapshot = {
    capturedAt: expectation.retrievedAt,
    expectations: [
      {
        id: data.requestId,
        expectation,
        reviewedAt: '2026-09-15T00:01:00.000Z',
      },
    ],
    actuals: {
      capturedAt: expectation.retrievedAt,
      items: [
        {
          itemId: item.id,
          version: item.version,
          reviewedAt: item.reviewedAt,
          original: actual,
        },
      ],
      truncated: false,
    },
  };
  const bundle = {
    generatedAt: expectation.retrievedAt,
    feed: [item],
    histories: {},
    evidence: {},
    macro: null,
    macroHistory: {},
    macroEvidence: {},
    sources: null,
    learningCatalog: null,
    journeyCatalog: null,
    media: {},
    gdpExpectations: snapshot,
  };
  const state = {
    schemaVersion: 1 as const,
    revision: 0,
    users: {},
    sessionUserId: null,
    data: {},
  };
  const request = {
    path: '/api/v1/gdp-expectations',
    method: 'GET' as const,
    body: undefined,
    headers: new Headers(),
    query: new URLSearchParams(),
  };
  expect((await handleGdpExpectations(request, state, bundle))?.body).toEqual(
    snapshot,
  );
  expect(
    compareGdpExpectation(
      expectation,
      actual,
      snapshot.expectations[0]!.reviewedAt,
    ),
  ).toMatchObject({ difference: '1.80', contemporaneous: false });
  const removed = await handleGdpExpectations(request, state, {
    ...bundle,
    feed: [],
  });
  expect(removed?.body).toMatchObject({ actuals: { items: [] } });
  const revised = await handleGdpExpectations(request, state, {
    ...bundle,
    feed: [{ ...item, version: 2 }],
  });
  expect(revised?.body).toMatchObject({ actuals: { items: [] } });
  const withdrawn = await handleGdpExpectations(request, state, {
    ...bundle,
    feed: [{ ...item, status: 'withdrawn' as const }],
  });
  expect(withdrawn?.body).toMatchObject({ actuals: { items: [] } });
  await expect(
    async () =>
      await handleGdpExpectations(request, state, {
        ...bundle,
        gdpExpectations: {
          ...snapshot,
          expectations: [
            {
              ...snapshot.expectations[0]!,
              expectation: { ...expectation, period: '2025-Q3' },
            },
          ],
        },
      }),
  ).rejects.toThrow();
});
