import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  InboxSchema,
  PrivacyExportSchema,
} from '../../../../packages/contracts/src/index';
import {
  seedMaterialObservation,
  gdp,
} from '../../helpers/material-alert-fixture';
import {
  connectionHeaders,
  connectionPassword,
} from '../../helpers/research-connection-fixture';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
test('E2E-API-041 actual stored correction and withdrawal keep old acknowledgement separate @ALERT-001 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const original = await seedMaterialObservation(feedbackSandbox, 2025, '1.25');
  const username = `inbox_${randomUUID().slice(0, 12)}`;
  expect(
    (
      await request.post('/api/v1/account/register', {
        headers: connectionHeaders,
        data: { username, password: connectionPassword, consent: true },
      })
    ).status(),
  ).toBe(201);
  try {
    expect(
      (
        await request.put('/api/v1/account/watchlist', {
          headers: connectionHeaders,
          data: { indicators: [gdp] },
        })
      ).status(),
    ).toBe(200);
    const inbox = async () => {
      const response = await request.get('/api/v1/account/inbox');
      expect(response.status()).toBe(200);
      return InboxSchema.parse(await response.json()).items;
    };
    expect(await inbox()).toEqual([
      expect.objectContaining({
        observationId: original.id,
        revision: 1,
        kind: 'observation',
        read: false,
      }),
    ]);
    expect(
      (
        await request.post('/api/v1/account/inbox/acknowledge', {
          headers: connectionHeaders,
          data: { observationId: original.id },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/account/logout', {
          headers: connectionHeaders,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post('/api/v1/account/login', {
          headers: connectionHeaders,
          data: { username, password: connectionPassword },
        })
      ).status(),
    ).toBe(200);
    expect((await inbox())[0]?.read).toBe(true);
    const corrected = await seedMaterialObservation(
      feedbackSandbox,
      2025,
      '1.75',
    );
    expect(corrected.supersedesId).toBe(original.id);
    expect(await inbox()).toEqual([
      expect.objectContaining({
        observationId: corrected.id,
        revision: 2,
        kind: 'correction',
        read: false,
        value: expect.stringMatching(/^1\.75(?:0*)$/),
      }),
    ]);
    // Replaying the old acknowledgement cannot mark the correction read.
    expect(
      (
        await request.post('/api/v1/account/inbox/acknowledge', {
          headers: connectionHeaders,
          data: { observationId: original.id },
        })
      ).status(),
    ).toBe(200);
    expect((await inbox())[0]?.read).toBe(false);
    expect(
      (
        await request.post('/api/v1/account/inbox/acknowledge', {
          headers: connectionHeaders,
          data: { observationId: corrected.id },
        })
      ).status(),
    ).toBe(200);
    const withdrawn = await seedMaterialObservation(
      feedbackSandbox,
      2025,
      null,
    );
    expect(await inbox()).toEqual([
      expect.objectContaining({
        observationId: withdrawn.id,
        revision: 3,
        kind: 'correction',
        value: null,
        read: false,
      }),
    ]);
    const exported = PrivacyExportSchema.parse(
      await (await request.get('/api/v1/account/privacy/export')).json(),
    );
    expect(
      exported.acknowledgments.map((entry) => entry.observationId).sort(),
    ).toEqual([original.id, corrected.id].sort());
  } finally {
    await request.delete('/api/v1/account', {
      headers: connectionHeaders,
      data: { password: connectionPassword },
    });
  }
});
