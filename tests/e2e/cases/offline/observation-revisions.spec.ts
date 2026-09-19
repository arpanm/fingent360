import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import {
  MacroDashboardSchema,
  MacroObservationSchema,
} from '../../../../packages/contracts/src/index';
import { localInbox } from '../../../../apps/web/src/offline/accounts';
import type {
  LocalState,
  OfflineBundle,
} from '../../../../apps/web/src/offline/types';

test('E2E-OFFLINE-041 exact on-device receipts do not acknowledge a later correction or withdrawal @ALERT-001 @TEST-SIMULATION', async () => {
  const bundle = JSON.parse(
    await readFile(
      new URL(
        '../../../../apps/web/src/offline/content-bundle.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as OfflineBundle;
  const macro = MacroDashboardSchema.parse(bundle.macro);
  const source = macro.sources.find(
    (item) => item.indicator === 'NY.GDP.MKTP.KD.ZG',
  );
  expect(source).toBeDefined();
  if (!source)
    throw new Error('Installed bundle must include GDP observations.');
  const original = source.observations.find(
    (item) => item.value !== null || item.revision > 1,
  );
  expect(original).toBeDefined();
  if (!original)
    throw new Error(
      'Installed bundle must contain an observation for the inbox.',
    );
  const owner = randomUUID();
  const state: LocalState = {
    schemaVersion: 1,
    revision: 1,
    users: {},
    sessionUserId: null,
    data: {
      localAccounts: {
        [owner]: {
          watchlist: [source.indicator],
          acknowledgments: { [original.id]: new Date().toISOString() },
          alertPreferences: {},
          session: null,
        },
      },
    },
  };
  expect(localInbox(state, owner, bundle).items).toEqual([
    expect.objectContaining({ observationId: original.id, read: true }),
  ]);
  // Synthetic bundle-transition input exercises the real local inbox reducer;
  // it does not claim an actual provider correction or modify the installed bundle.
  const corrected = MacroObservationSchema.parse({
    ...original,
    id: randomUUID(),
    value: '1.75',
    revision: original.revision + 1,
    supersedesId: original.id,
    retrievedAt: new Date().toISOString(),
    sourceHash: 'c'.repeat(64),
    sourceUrl: 'https://example.com/synthetic-observation-correction',
  });
  source.observations = [
    corrected,
    ...source.observations.filter((item) => item.year !== original.year),
  ];
  bundle.macro = macro;
  const restored = JSON.parse(JSON.stringify(state)) as LocalState;
  expect(localInbox(restored, owner, bundle).items).toEqual([
    expect.objectContaining({
      observationId: corrected.id,
      revision: corrected.revision,
      kind: 'correction',
      read: false,
    }),
  ]);
  const withdrawn = MacroObservationSchema.parse({
    ...corrected,
    id: randomUUID(),
    revision: corrected.revision + 1,
    supersedesId: corrected.id,
    value: null,
  });
  source.observations[0] = withdrawn;
  expect(localInbox(restored, owner, bundle).items).toEqual([
    expect.objectContaining({
      observationId: withdrawn.id,
      value: null,
      kind: 'correction',
      read: false,
    }),
  ]);
  expect(restored.data).toEqual(state.data);
});
