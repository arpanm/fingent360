import { test, expect } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { parseEiaSpot } from '../../../../packages/contracts/src/index';
import { handleEiaSpot } from '../../../../apps/web/src/offline/eia-spot';
import { eiaInput } from '../../helpers/eia-spot';
test('E2E-OFFLINE-1940 daily spot snapshot preserves missing cells and refuses undownloaded history or mutation @SRC-009 @TEST-SIMULATION', async () => {
  const input = eiaInput(),
    at = '2026-09-15T00:00:00.000Z',
    receipt = parseEiaSpot(
      input.body,
      input.requestId,
      createHash('sha256').update(input.body).digest('hex'),
      at,
    ),
    state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    bundle = {
      generatedAt: at,
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
      eiaSpot: {
        receipt,
        reviewedAt: at,
        editions: [receipt.id, randomUUID()],
      },
    },
    request = {
      path: '/api/v1/eia-spot',
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams(),
    };
  expect((await handleEiaSpot(request, state, bundle))?.body).toMatchObject({
    editions: [receipt.id],
    receipt: { unit: 'USD-per-barrel' },
  });
  await expect(
    Promise.resolve().then(() =>
      handleEiaSpot(
        { ...request, query: new URLSearchParams({ edition: randomUUID() }) },
        state,
        bundle,
      ),
    ),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    Promise.resolve().then(() =>
      handleEiaSpot(
        { ...request, path: '/api/v1/ops/eia-spot/capture', method: 'POST' },
        state,
        bundle,
      ),
    ),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    Promise.resolve().then(() =>
      handleEiaSpot(request, state, {
        ...bundle,
        eiaSpot: {
          ...bundle.eiaSpot,
          receipt: { ...receipt, unit: 'USD-per-gallon' },
        },
      }),
    ),
  ).rejects.toMatchObject({ status: 503 });
});
