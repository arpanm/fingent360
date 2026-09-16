import { test, expect } from '@playwright/test';
import { handleWhatsappChannel } from '../../../../apps/web/src/offline/whatsapp-channel';
import { whatsappAdvance } from '../../../../packages/contracts/src/whatsapp-channel';
test('E2E-OFFLINE-1600 installed app refuses recipient and delivery mutation without a server and never reports a sent message @DEV-029', async () => {
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
    },
    before = JSON.stringify(state);
  for (const path of [
    '/api/v1/account/whatsapp/verify',
    '/api/v1/account/whatsapp/deliveries',
  ]) {
    await expect(
      Promise.resolve().then(() =>
        handleWhatsappChannel(
          {
            path,
            method: 'POST',
            body: {},
            headers: new Headers(),
            query: new URLSearchParams(),
          },
          state,
          bundle,
        ),
      ),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('nothing was queued'),
    });
  }
  expect(JSON.stringify(state)).toBe(before);
  expect(whatsappAdvance('read', 'failed')).toBe('read');
  expect(whatsappAdvance('delivered', 'sent')).toBe('delivered');
  expect(whatsappAdvance('cancelled', 'read')).toBe('cancelled');
});
