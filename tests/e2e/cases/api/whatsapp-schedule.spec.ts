import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/feedback-fixture';
import {
  whatsappAccount,
  whatsappSource,
  verifyWhatsapp,
  whatsappHeaders,
  postWhatsappWebhook,
  inboundWhatsapp,
} from '../../helpers/whatsapp-channel';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  syntheticWhatsappSchedule,
  whatsappScheduleWorker,
} from '../../helpers/whatsapp-schedule';
test.use({ whatsappSimulation: true });
test('E2E-API-1690 recurring schedule actual occurrence idempotency STOP cancellation and encrypted export @DEV-029 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const account = await whatsappAccount(request),
    source = await whatsappSource(feedbackSandbox, new Date().toISOString());
  await verifyWhatsapp(request);
  const body = {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: 'save',
    consent: true,
    config: syntheticWhatsappSchedule,
  };
  for (let i = 0; i < 2; i++)
    expect(
      (
        await request.post('/api/v1/account/whatsapp/schedule', {
          headers: whatsappHeaders,
          data: body,
        })
      ).status(),
    ).toBe(201);
  const pool = await connectionDatabase(feedbackSandbox),
    worker = await whatsappScheduleWorker(feedbackSandbox);
  try {
    // Explicit synthetic publication timing and due clock, actual scheduling/DB/admission/outbox.
    await pool.query(
      "INSERT INTO discovery_items(id,version) SELECT 'fed-synthetic-unselected-'||n,1 FROM generate_series(1,501)n",
    );
    await pool.query(
      "INSERT INTO discovery_versions(item_id,version,data) SELECT i.id,1,jsonb_set(jsonb_set($1::jsonb,'{id}',to_jsonb(i.id)),'{publishedAt}',to_jsonb($2::text)) FROM discovery_items i WHERE i.id LIKE 'fed-synthetic-unselected-%'",
      [source, new Date().toISOString()],
    );
    await pool.query(
      "UPDATE whatsapp_schedules SET next_due_at=clock_timestamp()-interval '1 minute'",
    );
    await worker.run();
    await worker.run();
    const view = await (
      await request.get('/api/v1/account/whatsapp/schedule')
    ).json();
    expect(view.occurrences).toHaveLength(1);
    expect(view.occurrences[0].outcome).toBe('queued');
    expect(view.occurrences[0].jobIds).toHaveLength(1);
    expect(
      (await pool.query('SELECT payload FROM whatsapp_schedules')).rows[0]
        .payload.ciphertext,
    ).toBeTruthy();
    expect(
      (await postWhatsappWebhook(request, inboundWhatsapp('STOP'))).status(),
    ).toBe(200);
    const paused = await (
      await request.get('/api/v1/account/whatsapp/schedule')
    ).json();
    expect(paused.schedule.state).toBe('paused');
    expect(paused.schedule.nextDueAt).toBeNull();
    expect(
      (await pool.query('SELECT state FROM whatsapp_outbox')).rows[0].state,
    ).toBe('cancelled');
    const exported = await (
      await request.get('/api/v1/account/privacy/export')
    ).json();
    expect(exported.whatsapp.scheduling.versions).toHaveLength(2);
    expect(exported.whatsapp.scheduling.occurrences).toHaveLength(1);
    expect(
      (
        await request.delete('/api/v1/account', {
          headers: whatsappHeaders,
          data: { password: account.password },
        })
      ).status(),
    ).toBe(200);
    for (const table of [
      'whatsapp_schedules',
      'whatsapp_schedule_versions',
      'whatsapp_schedule_requests',
      'whatsapp_schedule_occurrences',
    ])
      expect(
        (await pool.query(`SELECT count(*)::int AS count FROM ${table}`))
          .rows[0].count,
      ).toBe(0);
  } finally {
    await worker.close();
    await pool.end();
  }
});
test('E2E-API-1691 recurring missed empty unavailable and stale version outcomes do not catch up @DEV-029 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  await whatsappAccount(request);
  await verifyWhatsapp(request);
  const response = await request.post('/api/v1/account/whatsapp/schedule', {
    headers: whatsappHeaders,
    data: {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: 'save',
      consent: true,
      config: syntheticWhatsappSchedule,
    },
  });
  expect(response.status()).toBe(201);
  const pool = await connectionDatabase(feedbackSandbox),
    worker = await whatsappScheduleWorker(feedbackSandbox);
  try {
    await pool.query(
      "UPDATE whatsapp_schedules SET next_due_at=clock_timestamp()-interval '2 days'",
    );
    await worker.run();
    await pool.query(
      "UPDATE whatsapp_schedules SET next_due_at=clock_timestamp()-interval '1 minute'",
    );
    await worker.run();
    const view = await (
      await request.get('/api/v1/account/whatsapp/schedule')
    ).json();
    expect(
      view.occurrences.map((v: { outcome: string }) => v.outcome).sort(),
    ).toEqual(['empty', 'skipped']);
    worker.config.WHATSAPP_ALLOWED_SOURCE_IDS = '';
    await pool.query(
      "UPDATE whatsapp_schedules SET next_due_at=clock_timestamp()-interval '2 minutes'",
    );
    await worker.run();
    const denied = await (
      await request.get('/api/v1/account/whatsapp/schedule')
    ).json();
    expect(denied.occurrences[0].outcome).toBe('unavailable');
    expect(
      (await pool.query('SELECT count(*)::int AS count FROM whatsapp_outbox'))
        .rows[0].count,
    ).toBe(0);
    expect(
      (
        await request.post('/api/v1/account/whatsapp/schedule', {
          headers: whatsappHeaders,
          data: {
            requestId: randomUUID(),
            expectedVersion: 0,
            action: 'pause',
            consent: true,
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post('/api/v1/account/whatsapp/schedule', {
          headers: whatsappHeaders,
          data: {
            requestId: randomUUID(),
            expectedVersion: 1,
            action: 'save',
            consent: true,
            config: { ...syntheticWhatsappSchedule, sourceIds: ['fed'] },
          },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await worker.close();
    await pool.end();
  }
});
