import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { regulatoryCapture } from '../../helpers/regulatory-sources';
import { handleRegulatorySources } from '../../../../apps/web/src/offline/regulatory-sources';
import type {
  OfflineBundle,
  OfflineRequest,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1680 original source snapshot preserves unknown precision flags expired review and denies editorial writes @SRC-014 @TEST-SIMULATION', async () => {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const input = regulatoryCapture(),
    at = new Date().toISOString(),
    edition = {
      id: input.requestId,
      hash: 'a'.repeat(64),
      metadata: { ...input.metadata, reviewBy: '2020-01-01' },
      mime: 'text/html',
      retrievedAt: at,
      recordedAt: at,
      acquisition: 'operator-upload',
      state: 'published',
      error: null,
      reviewedAt: at,
      adviceEnabled: false,
      applicability: 'not-assessed',
    };
  const snapshot = {
      ...bundle,
      regulatorySources: {
        enabled: true,
        editions: [edition],
        capturedAt: at,
        nextCursor: null,
      },
    },
    state: LocalState = {
      schemaVersion: 1,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    request: OfflineRequest = {
      path: '/api/v1/regulatory-sources',
      method: 'GET',
      query: new URLSearchParams(),
      headers: new Headers(),
      body: undefined,
    };
  const result = await handleRegulatorySources(request, state, snapshot);
  expect(result?.body).toMatchObject({
    editions: [
      {
        state: 'stale',
        metadata: { effective: { precision: 'unknown', value: null } },
        adviceEnabled: false,
        applicability: 'not-assessed',
      },
    ],
  });
  await expect(
    handleRegulatorySources(
      {
        ...request,
        path: '/api/v1/ops/regulatory-sources/import',
        method: 'POST',
      },
      state,
      snapshot,
    ),
  ).rejects.toMatchObject({ status: 503 });
  expect(
    (
      await handleRegulatorySources(request, state, {
        ...bundle,
        regulatorySources: {
          enabled: false,
          editions: [edition],
          capturedAt: at,
        },
      })
    )?.body,
  ).toEqual({ enabled: false, editions: [], nextCursor: null });
});
