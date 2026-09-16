import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CorporateRatingSnapshotSchema,
  CORPORATE_RATING_SOURCE,
  CORPORATE_RATING_VERSION,
  CORPORATE_RATINGS,
} from '../../../../packages/contracts/src/corporate-rating';
import { handleCorporateRatings } from '../../../../apps/web/src/offline/corporate-rating';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1960 downloaded credit evidence preserves agency withdrawal and drops editorially withdrawn source without private mutation @SRC-018', async () => {
  const bundle = JSON.parse(
      await readFile(
        new URL(
          '../../../../apps/web/src/offline/content-bundle.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as OfflineBundle,
    at = new Date().toISOString();
  bundle.corporateRatings = CorporateRatingSnapshotSchema.parse({
    capturedAt: at,
    editions: [
      {
        id: randomUUID(),
        version: CORPORATE_RATING_VERSION,
        sourceUrl: CORPORATE_RATING_SOURCE.url,
        hash: CORPORATE_RATING_SOURCE.hash,
        recordedAt: at,
        retrievedAt: null,
        publishedOn: '2026-05-13',
        annexureAsOf: '2026-03-31',
        observations: CORPORATE_RATINGS,
        state: 'published',
        error: null,
        reviewedAt: at,
      },
    ],
  });
  const state: LocalState = {
      schemaVersion: 1,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    before = JSON.stringify(state),
    req = {
      path: '/api/v1/corporate-ratings',
      method: 'GET',
      query: new URLSearchParams(),
      headers: new Headers(),
      body: {},
    };
  expect(
    (await handleCorporateRatings(req, state, bundle))?.body,
  ).toMatchObject({
    editions: [{ observations: CORPORATE_RATINGS }],
  });
  expect(JSON.stringify(state)).toBe(before);
  const withdrawn = CorporateRatingSnapshotSchema.parse(
    bundle.corporateRatings,
  );
  withdrawn.editions[0]!.state = 'withdrawn';
  bundle.corporateRatings = withdrawn;
  expect(
    (await handleCorporateRatings(req, state, bundle))?.body,
  ).toMatchObject({
    editions: [],
  });
  expect(() =>
    handleCorporateRatings(
      { ...req, path: '/api/v1/ops/corporate-ratings', method: 'POST' },
      state,
      bundle,
    ),
  ).toThrow('Rating editorial review requires connected Operations.');
});
