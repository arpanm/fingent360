import { test, expect } from '@playwright/test';
import { gdpOriginalInputs } from '../../helpers/bea-gdp-original';
import { originalGdpItem } from '../../../../apps/api/src/bea-gdp-original-provider';
import {
  FeedItemSchema,
  publicEdition,
} from '../../../../packages/contracts/src/index';
import { handleContent } from '../../../../apps/web/src/offline/content';
test('E2E-OFFLINE-1480 downloaded original GDP editions preserve captured basis and exclude withdrawals or tampered source periods @RESEARCH-AUTO-002 @TEST-SIMULATION', async () => {
  const now = '2026-09-15T00:00:00.000Z',
    items = (await gdpOriginalInputs()).map((raw) => ({
      ...originalGdpItem(raw),
      status: 'published' as const,
      reviewedAt: now,
    }));
  const state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    bundle = {
      generatedAt: now,
      feed: items,
      histories: {},
      evidence: {},
      macro: null,
      macroHistory: {},
      macroEvidence: {},
      sources: null,
      learningCatalog: null,
      journeyCatalog: null,
      media: {},
    },
    request = {
      path: '/api/v1/discovery/gdp-vintages',
      method: 'GET',
      body: undefined,
      headers: new Headers(),
      query: new URLSearchParams({ period: '2025-Q2' }),
    };
  expect((await handleContent(request, state, bundle))?.body).toMatchObject({
    items: [
      { original: { value: '3.8', basis: 'captured-original-release-page' } },
      { original: { value: '3.3' } },
    ],
  });
  const withdrawn = { ...items[0]!, version: 2, status: 'withdrawn' as const };
  expect(publicEdition(withdrawn).gdpOriginal).toBeUndefined();
  expect(
    (
      await handleContent(request, state, {
        ...bundle,
        feed: [withdrawn, ...items.slice(1)],
      })
    )?.body,
  ).toMatchObject({ items: [{ original: { value: '3.8' } }] });
  const corrupt = structuredClone(items[0]!);
  corrupt.gdpOriginal!.period = '2025-Q3';
  expect(FeedItemSchema.safeParse(corrupt).success).toBe(false);
});
