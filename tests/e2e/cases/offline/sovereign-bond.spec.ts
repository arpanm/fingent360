import { test, expect } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  SovereignSnapshotSchema,
  SOVEREIGN_ORIGINALS,
  SOVEREIGN_TERMS,
} from '../../../../packages/contracts/src/sovereign-bond';
import { handleSovereignBonds } from '../../../../apps/web/src/offline/sovereign-bond';
import type {
  OfflineBundle,
  LocalState,
} from '../../../../apps/web/src/offline/types';
test('E2E-OFFLINE-1920 downloaded source version calculates exact auction settlement without private mutation and refuses withdrawal @SRC-017 @TEST-SIMULATION', async () => {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const at = new Date().toISOString(),
    id = randomUUID();
  bundle.sovereignBonds = SovereignSnapshotSchema.parse({
    capturedAt: at,
    editions: [
      {
        id,
        terms: SOVEREIGN_TERMS,
        recordedAt: at,
        retrievedAt: null,
        originals: SOVEREIGN_ORIGINALS.map((o) => ({
          ...o,
          hash: createHash('sha256')
            .update('TEST-SIMULATION ' + o.kind)
            .digest('hex'),
        })),
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
  };
  const before = JSON.stringify(state),
    req = {
      path: '/api/v1/sovereign-bonds/' + id + '/calculate',
      method: 'POST',
      query: new URLSearchParams(),
      headers: new Headers(),
      body: { nominalPaise: '1000000', price: 'cutoff' },
    };
  expect((await handleSovereignBonds(req, state, bundle))?.body).toMatchObject({
    dirtyPaise: '967960',
    holdingMutation: false,
  });
  expect(JSON.stringify(state)).toBe(before);
  const withdrawn = SovereignSnapshotSchema.parse(bundle.sovereignBonds);
  withdrawn.editions[0]!.state = 'withdrawn';
  bundle.sovereignBonds = withdrawn;
  expect(() => handleSovereignBonds(req, state, bundle)).toThrow(
    'Exact reviewed source pack is not downloaded.',
  );
});
