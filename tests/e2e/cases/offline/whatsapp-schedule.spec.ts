import { test, expect } from '@playwright/test';
import {
  WhatsappScheduleWriteSchema,
  nextWhatsappDue,
} from '../../../../packages/contracts/src/whatsapp-schedule';
import { handleWhatsappChannel } from '../../../../apps/web/src/offline/whatsapp-channel';
import { syntheticWhatsappSchedule } from '../../helpers/whatsapp-schedule';
test('E2E-OFFLINE-1690 recurring schedule rejects implicit consent offline writes and handles DST once @DEV-029 @TEST-SIMULATION', async () => {
  expect(
    WhatsappScheduleWriteSchema.safeParse({
      requestId: 'a4b70339-963f-41e7-9c59-c40b69ed1191',
      expectedVersion: 0,
      action: 'save',
      config: syntheticWhatsappSchedule,
    }).success,
  ).toBe(false);
  const config = WhatsappScheduleWriteSchema.parse({
    requestId: 'a4b70339-963f-41e7-9c59-c40b69ed1191',
    expectedVersion: 0,
    action: 'save',
    consent: true,
    config: {
      ...syntheticWhatsappSchedule,
      time: '01:30',
      timezone: 'America/New_York',
    },
  }).config!;
  expect(nextWhatsappDue(config, '2026-11-01T04:00:00.000Z')).toBe(
    '2026-11-01T05:30:00.000Z',
  );
  expect(nextWhatsappDue(config, '2026-11-01T05:30:00.000Z')).toBe(
    '2026-11-02T06:30:00.000Z',
  );
  const state = {
      schemaVersion: 1 as const,
      revision: 0,
      users: {},
      sessionUserId: null,
      data: {},
    },
    bundle = {
      generatedAt: '2026-09-15T00:00:00.000Z',
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
    };
  await expect(
    Promise.resolve().then(() =>
      handleWhatsappChannel(
        {
          path: '/api/v1/account/whatsapp/schedule',
          method: 'POST',
          body: {},
          headers: new Headers(),
          query: new URLSearchParams(),
        },
        state,
        bundle,
      ),
    ),
  ).rejects.toMatchObject({ status: 503 });
  expect(state.data).toEqual({});
});
