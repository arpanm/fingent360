import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import { registerRecoverable, authHeaders } from '../../helpers/auth-wait';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import { setSyntheticScheduleDue } from '../../helpers/private-schedule-fixture';
import {
  startWorker,
  loginWorkerOperator,
  workerOverview,
  workerControl,
} from '../../helpers/worker-health';
import { ScheduleReceiptSchema } from '../../../../packages/contracts/src/index';

test('E2E-API-1408 encrypted schedule head, immutable receipts and actual due capture retain consent/export @DEV-017 @TEST-SIMULATION', async ({
  request,
  feedbackSandbox,
}) => {
  const owner = await registerRecoverable(request),
    db = await connectionDatabase(feedbackSandbox),
    worker = await startWorker(feedbackSandbox);
  try {
    await loginWorkerOperator(request);
    const control = (await workerOverview(request)).workers.find(
      (row) => row.worker === 'reports',
    );
    if (control?.paused)
      await workerControl(request, 'reports', false, control.version);
    const id = randomUUID(),
      path = '/api/v1/account/report-schedules/' + id;
    const data = {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: 'save',
      config: {
        label: 'Synthetic private scheduled review',
        frequency: 'daily',
        time: '09:00',
        timezone: 'Asia/Kolkata',
        weekday: 1,
        policy: 'saved-record-review-v1',
      },
      consent: true,
    };
    const first = await request.post(path, { headers: authHeaders, data });
    expect(first.status()).toBe(201);
    const receipt = ScheduleReceiptSchema.parse(await first.json());
    expect(
      await (await request.post(path, { headers: authHeaders, data })).json(),
    ).toEqual(receipt);
    for (const table of [
      'report_schedules',
      'report_schedule_editions',
      'report_schedule_requests',
    ]) {
      const row = (
        await db.query(
          `SELECT payload,encrypted_payload FROM ${table} WHERE user_id=$1`,
          [owner.id],
        )
      ).rows[0];
      expect(row.payload).toBeNull();
      expect(JSON.stringify(row.encrypted_payload)).not.toContain(
        data.config.label,
      );
    }
    await setSyntheticScheduleDue(
      db,
      feedbackSandbox,
      id,
      new Date(Date.now() - 86400000).toISOString(),
    );
    expect(await worker.run('schedule')).toBe(true);
    const occurrence = (
      await db.query(
        'SELECT payload,encrypted_payload FROM report_schedule_occurrences WHERE user_id=$1',
        [owner.id],
      )
    ).rows[0];
    expect(occurrence.payload).toBeNull();
    expect(occurrence.encrypted_payload).toBeTruthy();
    const job = (
      await db.query(
        'SELECT snapshot,label,encrypted_payload FROM record_report_jobs WHERE user_id=$1',
        [owner.id],
      )
    ).rows[0];
    expect(job.snapshot).toBeNull();
    expect(job.label).toBeNull();
    expect(job.encrypted_payload).toBeTruthy();
    expect(
      (await request.get('/api/v1/account/report-schedules/export')).status(),
    ).toBe(200);
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      200,
    );
  } finally {
    await worker.close();
    await db.end();
  }
});
