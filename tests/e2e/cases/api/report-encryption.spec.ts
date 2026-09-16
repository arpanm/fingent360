import { randomUUID } from 'node:crypto';
import { test, expect } from '../../helpers/app-fixture';
import {
  registerRecoverable,
  authHeaders,
  authGoal,
} from '../../helpers/auth-wait';
import { connectionDatabase } from '../../helpers/research-connection-fixture';
import {
  startWorker,
  loginWorkerOperator,
  workerOverview,
  workerControl,
} from '../../helpers/worker-health';
import { ReportJobSchema } from '../../../../packages/contracts/src/index';

test('E2E-API-1407 encrypted report job and issued output preserve worker, replay, export and removal @DEV-017 @TEST-SIMULATION', async ({
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
    expect(
      (
        await request.post('/api/v1/account/goals', {
          headers: authHeaders,
          data: authGoal,
        })
      ).status(),
    ).toBe(201);
    const data = {
      requestId: randomUUID(),
      label: 'Synthetic private encrypted review',
      consent: true,
    };
    const response = await request.post('/api/v1/account/reports', {
      headers: authHeaders,
      data,
    });
    expect(response.status()).toBe(201);
    const job = ReportJobSchema.parse(await response.json());
    const stored = (
      await db.query(
        'SELECT label,snapshot,encrypted_payload FROM record_report_jobs WHERE id=$1',
        [job.id],
      )
    ).rows[0];
    expect(stored.label).toBeNull();
    expect(stored.snapshot).toBeNull();
    expect(JSON.stringify(stored.encrypted_payload)).not.toContain(data.label);
    expect(
      ReportJobSchema.parse(
        await (
          await request.post('/api/v1/account/reports', {
            headers: authHeaders,
            data,
          })
        ).json(),
      ).snapshot,
    ).toEqual(job.snapshot);
    expect(await worker.run('work')).toBe(true);
    const issued = ReportJobSchema.parse(
      await (await request.get('/api/v1/account/reports/' + job.id)).json(),
    );
    expect(issued.status).toBe('succeeded');
    expect(issued.snapshot).toEqual(job.snapshot);
    const report = (
      await db.query(
        'SELECT payload,encrypted_payload FROM record_reports WHERE job_id=$1',
        [job.id],
      )
    ).rows[0];
    expect(report.payload).toBeNull();
    expect(JSON.stringify(report.encrypted_payload)).not.toContain(
      authGoal.name,
    );
    expect((await request.get('/api/v1/account/privacy/export')).status()).toBe(
      200,
    );
    expect(
      (
        await request.delete('/api/v1/account/reports/' + job.id, {
          headers: authHeaders,
          data: { expectedVersion: issued.version, confirm: true },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await db.query('SELECT id FROM record_report_jobs WHERE user_id=$1', [
          owner.id,
        ])
      ).rows,
    ).toHaveLength(0);
  } finally {
    await worker.close();
    await db.end();
  }
});
