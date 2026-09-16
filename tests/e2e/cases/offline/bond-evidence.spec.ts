import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CorporateRatingSnapshotSchema,
  CORPORATE_RATING_SOURCE,
  CORPORATE_RATING_VERSION,
  CORPORATE_RATINGS,
} from '../../../../packages/contracts/src/corporate-rating';
import {
  handleFundsBonds,
  exportLocalBondComparisons,
} from '../../../../apps/web/src/offline/funds-bonds';
import { fundFixture } from '../../helpers/funds-bonds';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1980 downloaded exact credit attaches to local receipt and withdrawn snapshot prevents new save without changing historical export @FUNDS-BONDS-001', async () => {
  const bundle = JSON.parse(
      await readFile(
        new URL(
          '../../../../apps/web/src/offline/content-bundle.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as OfflineBundle,
    at = new Date().toISOString(),
    editionId = randomUUID(),
    userId = randomUUID();
  bundle.corporateRatings = CorporateRatingSnapshotSchema.parse({
    capturedAt: at,
    editions: [
      {
        id: editionId,
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
      users: {
        [userId]: {
          id: userId,
          username: 'synthetic',
          createdAt: at,
          consentedAt: at,
          passwordHash: 'synthetic',
          passwordSalt: 'synthetic',
        },
      },
      sessionUserId: userId,
      data: {},
    },
    id = randomUUID(),
    body = {
      ...(await fundFixture()).comparison,
      settlementOn: '2026-05-14',
      previousCouponOn: '2026-02-12',
      nextCouponOn: '2026-08-12',
      cashflows: [{ date: '2035-02-12', amountPaise: '120000' }],
      creditEvidence: { editionId, isin: 'INE031A08939' },
    },
    req = {
      path: '/api/v1/account/bond-comparisons/' + id,
      method: 'PUT',
      query: new URLSearchParams(),
      headers: new Headers(),
      body,
    };
  const saved = await handleFundsBonds(req, state, bundle);
  expect(saved?.body).toMatchObject({
    result: {
      evidencePolicy: {
        credit: { editionId, status: 'historical-original-attached' },
      },
    },
  });
  const withdrawn = CorporateRatingSnapshotSchema.parse(
    bundle.corporateRatings,
  );
  withdrawn.editions[0]!.state = 'withdrawn';
  bundle.corporateRatings = withdrawn;
  await expect(
    handleFundsBonds(
      { ...req, path: '/api/v1/account/bond-comparisons/' + randomUUID() },
      state,
      bundle,
    ),
  ).rejects.toThrow('downloaded credit evidence');
  expect((await handleFundsBonds(req, state, bundle))?.body).toEqual(
    saved?.body,
  );
  expect(exportLocalBondComparisons(state, userId).comparisons[0]).toEqual(
    saved?.body,
  );
  await handleFundsBonds({ ...req, method: 'DELETE' }, state, bundle);
  expect(exportLocalBondComparisons(state, userId).comparisons).toEqual([]);
});

test('E2E-OFFLINE-1982 replay validates historical receipt integrity without re-admitting withdrawn source @FUNDS-BONDS-001', async () => {
  const { calculateBondComparison, BondComparisonInputSchema } =
    await import('../../../../packages/contracts/src/index');
  const bundle = JSON.parse(
      await readFile(
        new URL(
          '../../../../apps/web/src/offline/content-bundle.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as OfflineBundle,
    at = new Date().toISOString(),
    editionId = randomUUID(),
    userId = randomUUID(),
    id = randomUUID(),
    input = {
      ...(await fundFixture()).comparison,
      settlementOn: '2026-05-14',
      previousCouponOn: '2026-02-12',
      nextCouponOn: '2026-08-12',
      cashflows: [{ date: '2035-02-12', amountPaise: '120000' }],
      creditEvidence: { editionId, isin: 'INE031A08939' as const },
    },
    source = {
      id: editionId,
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
    value = {
      id,
      createdAt: at,
      input,
      result: calculateBondComparison(input, source),
    };
  const { createHash } = await import('node:crypto');
  const entry = {
    fingerprint: createHash('sha256')
      .update(JSON.stringify(BondComparisonInputSchema.parse(input)))
      .digest('hex'),
    value,
  };
  const state: LocalState = {
    schemaVersion: 1,
    revision: 0,
    users: {
      [userId]: {
        id: userId,
        username: 'synthetic',
        createdAt: at,
        consentedAt: at,
        passwordHash: 'synthetic',
        passwordSalt: 'synthetic',
      },
    },
    sessionUserId: userId,
    data: { localBondComparisons: { [userId]: { [id]: entry } } },
  };
  bundle.corporateRatings = CorporateRatingSnapshotSchema.parse({
    capturedAt: at,
    editions: [{ ...source, state: 'withdrawn' }],
  });
  const req = {
    path: '/api/v1/account/bond-comparisons/' + id,
    method: 'PUT',
    query: new URLSearchParams(),
    headers: new Headers(),
    body: input,
  };
  expect((await handleFundsBonds(req, state, bundle))?.body).toEqual(value);
  const credit = value.result.evidencePolicy!.credit;
  if (credit.status !== 'historical-original-attached')
    throw Error('Expected attached receipt');
  Object.assign(credit, { sourceHash: '0'.repeat(64) });
  await expect(handleFundsBonds(req, state, bundle)).rejects.toMatchObject({
    status: 409,
  });
});
